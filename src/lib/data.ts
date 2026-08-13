import { and, desc, eq, gte, lte, ilike } from 'drizzle-orm';
import { getDb } from '../db';
import {
  accounts,
  categories,
  savings,
  transactions,
  transfers,
  users,
  type Category,
} from '../db/schema';
import {
  applyPoolDelta,
  assertGastableNonNegative,
  calculateAccountBalance,
  calculateSavingTotal,
  effectOfTransaction,
  makeBalancePool,
  sumBalances,
  type BalancePool,
} from './balances';
import { MAX_ACCOUNTS, getNextAvailableColor } from './account-colors';
import { hashPassword } from './auth';
import { DEFAULT_CATEGORY_EMOJI, normalizeCategoryEmoji } from './category-emoji';
import bcrypt from 'bcryptjs';

const TRANSFER_CATEGORY_NAME = 'transferencia entre cuentas';

export async function getBalancePool(userId: string): Promise<BalancePool> {
  const accs = await listAccounts(userId);
  const savs = await listSavings(userId);
  return makeBalancePool(
    sumBalances(accs.map((a) => a.balance)),
    sumBalances(savs.map((s) => s.total))
  );
}

export async function listAccounts(userId: string) {
  const db = getDb();
  const rows = await db.select().from(accounts).where(eq(accounts.userId, userId)).orderBy(accounts.createdAt);
  const txs = await db.select().from(transactions).where(eq(transactions.userId, userId));
  return rows.map((a) => ({
    ...a,
    balance: calculateAccountBalance(a.initialBalance, txs, a.id),
  }));
}

export async function createAccount(
  userId: string,
  data: { name: string; type: string; initialBalance: number; colorId?: string }
) {
  const db = getDb();
  const existing = await db.select().from(accounts).where(eq(accounts.userId, userId));
  if (existing.length >= MAX_ACCOUNTS) {
    throw new Error(`Máximo ${MAX_ACCOUNTS} cuentas`);
  }
  const used = existing.map((a) => a.colorId);
  const colorId = data.colorId && !used.includes(data.colorId) ? data.colorId : getNextAvailableColor(used);
  const [row] = await db
    .insert(accounts)
    .values({
      userId,
      name: data.name.trim(),
      type: data.type,
      initialBalance: data.initialBalance,
      colorId,
    })
    .returning();
  return row;
}

export async function updateAccount(
  userId: string,
  id: string,
  data: Partial<{ name: string; type: string; initialBalance: number; colorId: string }>
) {
  const db = getDb();
  if (data.initialBalance !== undefined) {
    const accs = await listAccounts(userId);
    const current = accs.find((a) => a.id === id);
    if (!current) throw new Error('Cuenta no encontrada');
    const pool = await getBalancePool(userId);
    const delta = data.initialBalance - current.initialBalance;
    assertGastableNonNegative(applyPoolDelta(pool, { accountsDelta: delta, savingsDelta: 0 }));
  }
  const [row] = await db
    .update(accounts)
    .set(data)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning();
  return row;
}

export async function deleteAccount(userId: string, id: string) {
  const db = getDb();
  const linked = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.accountId, id)))
    .limit(1);
  if (linked.length) throw new Error('La cuenta tiene transacciones asociadas');
  await db.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
}

export async function listCategories(userId: string, opts?: { includeSystem?: boolean }) {
  const db = getDb();
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(categories.createdAt);
  if (opts?.includeSystem) return rows;
  return rows.filter((c) => !c.isSystem && c.name !== TRANSFER_CATEGORY_NAME);
}

export async function createCategory(userId: string, data: { name: string; icon?: string }) {
  const db = getDb();
  const [row] = await db
    .insert(categories)
    .values({
      userId,
      name: data.name.trim(),
      icon: normalizeCategoryEmoji(data.icon || DEFAULT_CATEGORY_EMOJI),
    })
    .returning();
  return row;
}

export async function updateCategory(
  userId: string,
  id: string,
  data: Partial<{ name: string; icon: string }>
) {
  const db = getDb();
  const patch = {
    ...data,
    ...(data.icon !== undefined ? { icon: normalizeCategoryEmoji(data.icon) } : {}),
  };
  const [row] = await db
    .update(categories)
    .set(patch)
    .where(and(eq(categories.id, id), eq(categories.userId, userId), eq(categories.isSystem, false)))
    .returning();
  return row;
}

export async function deleteCategory(userId: string, id: string) {
  const db = getDb();
  const linked = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.categoryId, id)))
    .limit(1);
  if (linked.length) throw new Error('La categoría tiene transacciones asociadas');
  const sav = await db
    .select({ id: savings.id })
    .from(savings)
    .where(and(eq(savings.userId, userId), eq(savings.categoryId, id)))
    .limit(1);
  if (sav.length) throw new Error('La categoría está vinculada a un ahorro');
  await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId), eq(categories.isSystem, false)));
}

async function getOrCreateTransferCategory(userId: string): Promise<Category> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.name, TRANSFER_CATEGORY_NAME)))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(categories)
    .values({
      userId,
      name: TRANSFER_CATEGORY_NAME,
      icon: '↔️',
      isSystem: true,
    })
    .returning();
  return created;
}

export async function listSavings(userId: string) {
  const db = getDb();
  const rows = await db.select().from(savings).where(eq(savings.userId, userId)).orderBy(desc(savings.createdAt));
  const txs = await db.select().from(transactions).where(eq(transactions.userId, userId));
  const cats = await listCategories(userId, { includeSystem: true });
  return rows.map((s) => ({
    ...s,
    total: calculateSavingTotal(s.baseAmount, s.id, txs),
    categoryName: cats.find((c) => c.id === s.categoryId)?.name,
  }));
}

export async function createSaving(
  userId: string,
  data: { name: string; categoryId: string; baseAmount: number }
) {
  const baseAmount = Math.max(0, data.baseAmount);
  const pool = await getBalancePool(userId);
  assertGastableNonNegative(applyPoolDelta(pool, { accountsDelta: 0, savingsDelta: baseAmount }));

  const db = getDb();
  const name = data.name.trim();
  const nameNormalized = name.toLowerCase();
  const [row] = await db
    .insert(savings)
    .values({
      userId,
      name,
      nameNormalized,
      categoryId: data.categoryId,
      baseAmount,
    })
    .returning();
  return row;
}

export async function updateSaving(
  userId: string,
  id: string,
  data: Partial<{ name: string; categoryId: string; baseAmount: number }>
) {
  const db = getDb();
  if (data.baseAmount !== undefined) {
    const savs = await listSavings(userId);
    const current = savs.find((s) => s.id === id);
    if (!current) throw new Error('Ahorro no encontrado');
    const nextBase = Math.max(0, data.baseAmount);
    const delta = nextBase - current.baseAmount;
    const pool = await getBalancePool(userId);
    assertGastableNonNegative(applyPoolDelta(pool, { accountsDelta: 0, savingsDelta: delta }));
  }
  const patch: Record<string, unknown> = { ...data };
  if (data.name) {
    patch.name = data.name.trim();
    patch.nameNormalized = data.name.trim().toLowerCase();
  }
  if (data.baseAmount !== undefined) {
    patch.baseAmount = Math.max(0, data.baseAmount);
  }
  const [row] = await db
    .update(savings)
    .set(patch)
    .where(and(eq(savings.id, id), eq(savings.userId, userId)))
    .returning();
  return row;
}

export async function deleteSaving(userId: string, id: string) {
  const db = getDb();
  await db
    .update(transactions)
    .set({ savingsId: null })
    .where(and(eq(transactions.userId, userId), eq(transactions.savingsId, id)));
  await db.delete(savings).where(and(eq(savings.id, id), eq(savings.userId, userId)));
}

export type TxFilters = {
  type?: 'ingreso' | 'gasto' | '';
  accountId?: string;
  from?: Date;
  to?: Date;
  note?: string;
  limit?: number;
};

export async function listTransactions(userId: string, filters: TxFilters = {}) {
  const db = getDb();
  const conditions = [eq(transactions.userId, userId)];
  if (filters.type) conditions.push(eq(transactions.type, filters.type));
  if (filters.accountId) conditions.push(eq(transactions.accountId, filters.accountId));
  if (filters.from) conditions.push(gte(transactions.date, filters.from));
  if (filters.to) conditions.push(lte(transactions.date, filters.to));
  if (filters.note) conditions.push(ilike(transactions.note, `%${filters.note}%`));

  let q = db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.date));

  const rows = filters.limit ? await q.limit(filters.limit) : await q;
  return rows;
}

export async function createTransaction(
  userId: string,
  data: {
    type: 'ingreso' | 'gasto';
    amount: number;
    date: Date;
    accountId: string;
    categoryId: string;
    note?: string;
    savingsId?: string;
  }
) {
  if (data.amount < 1) throw new Error('El monto debe ser mayor a 0');

  if (data.type === 'gasto' && data.savingsId) {
    const savs = await listSavings(userId);
    const saving = savs.find((s) => s.id === data.savingsId);
    if (!saving) throw new Error('Ahorro no encontrado');
    if (saving.total < data.amount) {
      throw new Error(`Saldo insuficiente en el ahorro ${saving.name}`);
    }
  }

  const pool = await getBalancePool(userId);
  const next = applyPoolDelta(
    pool,
    effectOfTransaction({
      type: data.type,
      amount: data.amount,
      savingsId: data.savingsId || null,
    })
  );
  assertGastableNonNegative(next);

  const db = getDb();
  const [row] = await db
    .insert(transactions)
    .values({
      userId,
      type: data.type,
      amount: data.amount,
      date: data.date,
      accountId: data.accountId,
      categoryId: data.categoryId,
      note: data.note || null,
      savingsId: data.savingsId || null,
    })
    .returning();
  return row;
}

export async function updateTransaction(
  userId: string,
  id: string,
  data: Partial<{
    type: 'ingreso' | 'gasto';
    amount: number;
    date: Date;
    accountId: string;
    categoryId: string;
    note: string | null;
    savingsId: string | null;
  }>
) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .limit(1);
  if (!existing) throw new Error('Movimiento no encontrado');

  const nextTx = {
    type: (data.type ?? existing.type) as 'ingreso' | 'gasto',
    amount: data.amount ?? existing.amount,
    savingsId: data.savingsId !== undefined ? data.savingsId : existing.savingsId,
  };
  if (nextTx.amount < 1) throw new Error('El monto debe ser mayor a 0');

  if (nextTx.type === 'gasto' && nextTx.savingsId) {
    const savs = await listSavings(userId);
    const saving = savs.find((s) => s.id === nextTx.savingsId);
    if (!saving) throw new Error('Ahorro no encontrado');
    const available =
      saving.id === existing.savingsId && existing.type === 'gasto'
        ? saving.total + existing.amount
        : saving.total;
    if (available < nextTx.amount) {
      throw new Error(`Saldo insuficiente en el ahorro ${saving.name}`);
    }
  }

  const pool = await getBalancePool(userId);
  const withoutOld = applyPoolDelta(pool, {
    accountsDelta: -effectOfTransaction(existing).accountsDelta,
    savingsDelta: -effectOfTransaction(existing).savingsDelta,
  });
  const withNew = applyPoolDelta(withoutOld, effectOfTransaction(nextTx));
  assertGastableNonNegative(withNew);

  const [row] = await db
    .update(transactions)
    .set(data)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning();
  return row;
}

export async function deleteTransaction(userId: string, id: string) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .limit(1);
  if (!existing) throw new Error('Movimiento no encontrado');

  const pool = await getBalancePool(userId);
  const next = applyPoolDelta(pool, {
    accountsDelta: -effectOfTransaction(existing).accountsDelta,
    savingsDelta: -effectOfTransaction(existing).savingsDelta,
  });
  assertGastableNonNegative(next);

  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
}

export async function createTransfer(
  userId: string,
  data: { fromAccountId: string; toAccountId: string; amount: number; note?: string }
) {
  if (data.fromAccountId === data.toAccountId) {
    throw new Error('Las cuentas deben ser distintas');
  }
  if (data.amount < 1) throw new Error('El monto debe ser mayor a 0');

  const db = getDb();
  const accs = await listAccounts(userId);
  const from = accs.find((a) => a.id === data.fromAccountId);
  const to = accs.find((a) => a.id === data.toAccountId);
  if (!from || !to) throw new Error('Cuenta no encontrada');
  if (from.balance < data.amount) {
    throw new Error(`Saldo insuficiente en ${from.name}`);
  }

  const transferCat = await getOrCreateTransferCategory(userId);
  const now = new Date();

  const [transfer] = await db
    .insert(transfers)
    .values({
      userId,
      fromAccountId: data.fromAccountId,
      toAccountId: data.toAccountId,
      amount: data.amount,
      note: data.note || null,
    })
    .returning();

  await db.insert(transactions).values([
    {
      userId,
      type: 'gasto',
      amount: data.amount,
      date: now,
      accountId: data.fromAccountId,
      categoryId: transferCat.id,
      note: data.note || `Transferencia a ${to.name}`,
      transferId: transfer.id,
    },
    {
      userId,
      type: 'ingreso',
      amount: data.amount,
      date: now,
      accountId: data.toAccountId,
      categoryId: transferCat.id,
      note: data.note || `Transferencia desde ${from.name}`,
      transferId: transfer.id,
    },
  ]);

  return transfer;
}

export async function updateUserSettings(
  userId: string,
  data: Partial<{ monthCutoffDay: number; theme: string; dashboardRecentCount: number }>
) {
  const db = getDb();
  const [row] = await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
  return row;
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error('Usuario no encontrado');
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new Error('Contraseña actual incorrecta');
  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function periodSummary(userId: string, from: Date, to: Date) {
  const txs = await listTransactions(userId, { from, to });
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === 'gasto') expense += t.amount;
    else if (t.type === 'ingreso' && !t.savingsId) income += t.amount;
  }
  return { income, expense, transactions: txs };
}
