import { and, asc, desc, eq, gte, inArray, lte, ilike } from 'drizzle-orm';
import { addMonths, setDate, startOfDay } from 'date-fns';
import { getDb } from '../db';
import {
  accounts,
  categories,
  installmentPlans,
  installments,
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
  calculateCreditAvailable,
  calculateCreditDebt,
  calculateSavingTotal,
  effectOfTransaction,
  makeBalancePool,
  splitInstallmentAmounts,
  sumBalances,
  type BalancePool,
} from './balances';
import {
  isCheckingAccount,
  isCreditAccount,
  MAX_ACCOUNTS,
  MIN_ACCOUNTS_FOR_TRANSFER,
  getNextAvailableColor,
} from './account-colors';
import { hashPassword } from './auth';
import { DEFAULT_CATEGORY_EMOJI, normalizeCategoryEmoji } from './category-emoji';
import bcrypt from 'bcryptjs';

const TRANSFER_CATEGORY_NAME = 'transferencia entre cuentas';
const SAVINGS_CATEGORY_NAME = 'ahorro';
const UNCATEGORIZED_CATEGORY_NAME = 'otros';
const INSTALLMENT_PURCHASE_NOTE = 'Compra en cuotas';

function asTxEffect(tx: { type: string; amount: number; savingsId?: string | null }) {
  return effectOfTransaction({
    type: tx.type as 'ingreso' | 'gasto',
    amount: tx.amount,
    savingsId: tx.savingsId,
  });
}

function sortAccounts<T extends { isFavorite: boolean; createdAt: Date }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export async function getAccountBalancePool(userId: string, accountId: string): Promise<BalancePool> {
  const accs = await listAccounts(userId);
  const acc = accs.find((a) => a.id === accountId);
  if (!acc) throw new Error('Cuenta no encontrada');
  if (isCreditAccount(acc.type)) {
    return makeBalancePool(0, 0);
  }
  const savs = await listSavings(userId, { accountId });
  return makeBalancePool(acc.balance, sumBalances(savs.map((s) => s.total)));
}

/** Pool de todas las corrientes (validaciones globales residuales). */
export async function getBalancePool(userId: string): Promise<BalancePool> {
  const accs = await listAccounts(userId);
  const corrientes = accs.filter((a) => isCheckingAccount(a.type));
  const savs = await listSavings(userId);
  return makeBalancePool(
    sumBalances(corrientes.map((a) => a.balance)),
    sumBalances(savs.map((s) => s.total))
  );
}

export async function listAccounts(userId: string) {
  const db = getDb();
  const rows = await db.select().from(accounts).where(eq(accounts.userId, userId));
  const txs = await db.select().from(transactions).where(eq(transactions.userId, userId));
  const mapped = rows.map((a) => {
    if (isCreditAccount(a.type)) {
      const debt = calculateCreditDebt(a.initialBalance, txs, a.id);
      const limit = a.creditLimit ?? 0;
      return {
        ...a,
        balance: debt,
        debt,
        creditAvailable: calculateCreditAvailable(limit, debt),
      };
    }
    const balance = calculateAccountBalance(a.initialBalance, txs, a.id);
    return {
      ...a,
      balance,
      debt: 0,
      creditAvailable: 0,
    };
  });
  return sortAccounts(mapped);
}

export async function createAccount(
  userId: string,
  data: {
    name: string;
    type: string;
    initialBalance: number;
    creditLimit?: number | null;
    colorId?: string;
    isFavorite?: boolean;
  }
) {
  const type = data.type === 'credito' ? 'credito' : 'corriente';
  const initialBalance = Math.max(0, data.initialBalance);
  let creditLimit: number | null = null;

  if (type === 'credito') {
    const limit = data.creditLimit ?? 0;
    if (limit < 1) throw new Error('El cupo debe ser mayor a 0');
    if (initialBalance > limit) throw new Error('El gastado no puede superar el cupo');
    creditLimit = limit;
  }

  const db = getDb();
  const existing = await db.select().from(accounts).where(eq(accounts.userId, userId));
  if (existing.length >= MAX_ACCOUNTS) {
    throw new Error(`Máximo ${MAX_ACCOUNTS} cuentas`);
  }
  const used = existing.map((a) => a.colorId);
  const colorId = data.colorId && !used.includes(data.colorId) ? data.colorId : getNextAvailableColor(used);

  const makeFavorite = Boolean(data.isFavorite) || existing.length === 0;
  if (makeFavorite) {
    await db.update(accounts).set({ isFavorite: false }).where(eq(accounts.userId, userId));
  }

  const [row] = await db
    .insert(accounts)
    .values({
      userId,
      name: data.name.trim(),
      type,
      initialBalance,
      creditLimit,
      isFavorite: makeFavorite,
      colorId,
    })
    .returning();
  return row;
}

export async function updateAccount(
  userId: string,
  id: string,
  data: Partial<{
    name: string;
    type: string;
    initialBalance: number;
    creditLimit: number | null;
    colorId: string;
  }>
) {
  const db = getDb();
  const accs = await listAccounts(userId);
  const current = accs.find((a) => a.id === id);
  if (!current) throw new Error('Cuenta no encontrada');

  const nextType = data.type ? (data.type === 'credito' ? 'credito' : 'corriente') : current.type;
  const nextInitial =
    data.initialBalance !== undefined ? Math.max(0, data.initialBalance) : current.initialBalance;
  let nextLimit =
    data.creditLimit !== undefined ? data.creditLimit : current.creditLimit;

  if (nextType === 'credito') {
    const limit = nextLimit ?? 0;
    if (limit < 1) throw new Error('El cupo debe ser mayor a 0');
    // deuda proyectada con nuevo initialBalance
    const debtDelta = nextInitial - current.initialBalance;
    const projectedDebt = current.debt + debtDelta;
    if (projectedDebt > limit) throw new Error('La deuda no puede superar el cupo');
    nextLimit = limit;
  } else {
    nextLimit = null;
    if (data.initialBalance !== undefined) {
      const pool = await getAccountBalancePool(userId, id);
      const delta = nextInitial - current.initialBalance;
      assertGastableNonNegative(applyPoolDelta(pool, { accountsDelta: delta, savingsDelta: 0 }));
    }
  }

  if (current.type === 'corriente' && nextType === 'credito') {
    const savs = await listSavings(userId, { accountId: id });
    if (savs.length) throw new Error('No puedes convertir a crédito una cuenta con ahorros');
  }

  const [row] = await db
    .update(accounts)
    .set({
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      type: nextType,
      initialBalance: nextInitial,
      creditLimit: nextLimit,
      ...(data.colorId !== undefined ? { colorId: data.colorId } : {}),
    })
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning();
  return row;
}

export async function setFavoriteAccount(userId: string, id: string) {
  const db = getDb();
  const [acc] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .limit(1);
  if (!acc) throw new Error('Cuenta no encontrada');
  await db.update(accounts).set({ isFavorite: false }).where(eq(accounts.userId, userId));
  const [row] = await db
    .update(accounts)
    .set({ isFavorite: true })
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

  const sav = await db
    .select({ id: savings.id })
    .from(savings)
    .where(and(eq(savings.userId, userId), eq(savings.accountId, id)))
    .limit(1);
  if (sav.length) throw new Error('La cuenta tiene ahorros asociados');

  const plans = await db
    .select({ id: installmentPlans.id })
    .from(installmentPlans)
    .where(and(eq(installmentPlans.userId, userId), eq(installmentPlans.creditAccountId, id)))
    .limit(1);
  if (plans.length) throw new Error('La cuenta tiene compras en cuotas asociadas');

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
  await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId), eq(categories.isSystem, false)));
}

async function getOrCreateSystemCategory(
  userId: string,
  name: string,
  icon: string
): Promise<Category> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.name, name)))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(categories)
    .values({
      userId,
      name,
      icon,
      isSystem: true,
    })
    .returning();
  return created;
}

async function getOrCreateTransferCategory(userId: string): Promise<Category> {
  return getOrCreateSystemCategory(userId, TRANSFER_CATEGORY_NAME, '↔️');
}

async function getOrCreateSavingsCategory(userId: string): Promise<Category> {
  return getOrCreateSystemCategory(userId, SAVINGS_CATEGORY_NAME, '🐷');
}

async function getOrCreateUncategorizedCategory(userId: string): Promise<Category> {
  return getOrCreateSystemCategory(userId, UNCATEGORIZED_CATEGORY_NAME, '📦');
}

async function resolveCategoryId(
  userId: string,
  categoryId: string | undefined | null,
  savingsId?: string | null
): Promise<string> {
  if (savingsId) {
    const savingsCategory = await getOrCreateSavingsCategory(userId);
    return savingsCategory.id;
  }
  if (categoryId) return categoryId;
  const uncategorized = await getOrCreateUncategorizedCategory(userId);
  return uncategorized.id;
}

export async function listSavings(userId: string, opts?: { accountId?: string }) {
  const db = getDb();
  const conditions = [eq(savings.userId, userId)];
  if (opts?.accountId) conditions.push(eq(savings.accountId, opts.accountId));
  const rows = await db
    .select()
    .from(savings)
    .where(and(...conditions))
    .orderBy(desc(savings.createdAt));
  const txs = await db.select().from(transactions).where(eq(transactions.userId, userId));
  const accs = await db.select().from(accounts).where(eq(accounts.userId, userId));
  return rows.map((s) => ({
    ...s,
    total: calculateSavingTotal(s.baseAmount, s.id, txs),
    accountName: accs.find((a) => a.id === s.accountId)?.name,
  }));
}

export async function createSaving(
  userId: string,
  data: { name: string; baseAmount: number; accountId: string }
) {
  const accs = await listAccounts(userId);
  const acc = accs.find((a) => a.id === data.accountId);
  if (!acc) throw new Error('Cuenta no encontrada');
  if (!isCheckingAccount(acc.type)) throw new Error('Los ahorros solo aplican a cuentas corrientes');

  const baseAmount = Math.max(0, data.baseAmount);
  const pool = await getAccountBalancePool(userId, data.accountId);
  assertGastableNonNegative(applyPoolDelta(pool, { accountsDelta: 0, savingsDelta: baseAmount }));

  const db = getDb();
  const name = data.name.trim();
  const nameNormalized = name.toLowerCase();
  const [row] = await db
    .insert(savings)
    .values({
      userId,
      accountId: data.accountId,
      name,
      nameNormalized,
      baseAmount,
    })
    .returning();
  return row;
}

export async function updateSaving(
  userId: string,
  id: string,
  data: Partial<{ name: string; baseAmount: number; accountId: string }>
) {
  const db = getDb();
  const savs = await listSavings(userId);
  const current = savs.find((s) => s.id === id);
  if (!current) throw new Error('Ahorro no encontrado');

  const accountId = data.accountId ?? current.accountId;
  if (data.accountId) {
    const accs = await listAccounts(userId);
    const acc = accs.find((a) => a.id === data.accountId);
    if (!acc || !isCheckingAccount(acc.type)) {
      throw new Error('Los ahorros solo aplican a cuentas corrientes');
    }
  }

  if (data.baseAmount !== undefined) {
    const nextBase = Math.max(0, data.baseAmount);
    const delta = nextBase - current.baseAmount;
    const pool = await getAccountBalancePool(userId, accountId);
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

  const q = db
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
    categoryId?: string;
    note?: string;
    savingsId?: string;
  }
) {
  if (data.amount < 1) throw new Error('El monto debe ser mayor a 0');

  const accs = await listAccounts(userId);
  const acc = accs.find((a) => a.id === data.accountId);
  if (!acc) throw new Error('Cuenta no encontrada');

  if (data.savingsId) {
    if (!isCheckingAccount(acc.type)) throw new Error('Los ahorros solo aplican a cuentas corrientes');
    const savs = await listSavings(userId, { accountId: data.accountId });
    const saving = savs.find((s) => s.id === data.savingsId);
    if (!saving) throw new Error('Ahorro no encontrado');
    if (saving.accountId !== data.accountId) {
      throw new Error('El ahorro no pertenece a esta cuenta');
    }
    if (data.type === 'gasto' && saving.total < data.amount) {
      throw new Error(`Saldo insuficiente en el ahorro ${saving.name}`);
    }
  }

  const categoryId = await resolveCategoryId(userId, data.categoryId, data.savingsId);

  if (isCreditAccount(acc.type)) {
    if (data.savingsId) throw new Error('Los ahorros solo aplican a cuentas corrientes');
    if (data.type === 'gasto') {
      const limit = acc.creditLimit ?? 0;
      if (acc.debt + data.amount > limit) {
        throw new Error('El gasto supera el cupo disponible');
      }
    }
  } else {
    const pool = await getAccountBalancePool(userId, data.accountId);
    const next = applyPoolDelta(
      pool,
      effectOfTransaction({
        type: data.type,
        amount: data.amount,
        savingsId: data.savingsId || null,
      })
    );
    assertGastableNonNegative(next);
  }

  const db = getDb();
  const [row] = await db
    .insert(transactions)
    .values({
      userId,
      type: data.type,
      amount: data.amount,
      date: data.date,
      accountId: data.accountId,
      categoryId,
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
  if (existing.transferId) {
    throw new Error('Las transferencias no se pueden editar; elimínalas y créalas de nuevo');
  }

  const nextTx = {
    type: (data.type ?? existing.type) as 'ingreso' | 'gasto',
    amount: data.amount ?? existing.amount,
    accountId: data.accountId ?? existing.accountId,
    savingsId: data.savingsId !== undefined ? data.savingsId : existing.savingsId,
  };
  if (nextTx.amount < 1) throw new Error('El monto debe ser mayor a 0');

  const accs = await listAccounts(userId);
  const acc = accs.find((a) => a.id === nextTx.accountId);
  if (!acc) throw new Error('Cuenta no encontrada');

  if (nextTx.savingsId) {
    if (!isCheckingAccount(acc.type)) throw new Error('Los ahorros solo aplican a cuentas corrientes');
    const savs = await listSavings(userId, { accountId: nextTx.accountId });
    const saving = savs.find((s) => s.id === nextTx.savingsId);
    if (!saving) throw new Error('Ahorro no encontrado');
    if (nextTx.type === 'gasto') {
      const available =
        saving.id === existing.savingsId && existing.type === 'gasto'
          ? saving.total + existing.amount
          : saving.total;
      if (available < nextTx.amount) {
        throw new Error(`Saldo insuficiente en el ahorro ${saving.name}`);
      }
    }
  }

  if (isCheckingAccount(acc.type)) {
    const pool = await getAccountBalancePool(userId, nextTx.accountId);
    // revert old if same account
    let withoutOld = pool;
    if (existing.accountId === nextTx.accountId) {
      withoutOld = applyPoolDelta(pool, {
        accountsDelta: -asTxEffect(existing).accountsDelta,
        savingsDelta: -asTxEffect(existing).savingsDelta,
      });
    } else {
      const oldPool = await getAccountBalancePool(userId, existing.accountId);
      const oldNext = applyPoolDelta(oldPool, {
        accountsDelta: -asTxEffect(existing).accountsDelta,
        savingsDelta: -asTxEffect(existing).savingsDelta,
      });
      assertGastableNonNegative(oldNext);
    }
    const withNew = applyPoolDelta(withoutOld, asTxEffect(nextTx));
    assertGastableNonNegative(withNew);
  } else if (nextTx.type === 'gasto') {
    let debt = acc.debt;
    if (existing.accountId === nextTx.accountId && existing.type === 'gasto') {
      debt -= existing.amount;
    } else if (existing.accountId === nextTx.accountId && existing.type === 'ingreso') {
      debt += existing.amount;
    }
    debt += nextTx.amount;
    if (debt > (acc.creditLimit ?? 0)) throw new Error('El gasto supera el cupo disponible');
  }

  const patch: typeof data = { ...data };
  if (data.categoryId !== undefined || data.savingsId !== undefined || nextTx.savingsId) {
    patch.categoryId = await resolveCategoryId(
      userId,
      data.categoryId !== undefined ? data.categoryId || null : existing.categoryId,
      nextTx.savingsId
    );
  }

  const [row] = await db
    .update(transactions)
    .set(patch)
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

  const legs = existing.transferId
    ? await db
        .select()
        .from(transactions)
        .where(
          and(eq(transactions.userId, userId), eq(transactions.transferId, existing.transferId))
        )
    : [existing];

  const accs = await listAccounts(userId);
  for (const leg of legs) {
    const acc = accs.find((a) => a.id === leg.accountId);
    if (acc && isCheckingAccount(acc.type)) {
      const pool = await getAccountBalancePool(userId, leg.accountId);
      const next = applyPoolDelta(pool, {
        accountsDelta: -asTxEffect(leg).accountsDelta,
        savingsDelta: -asTxEffect(leg).savingsDelta,
      });
      assertGastableNonNegative(next);
    }
  }

  if (existing.transferId) {
    await db
      .delete(transactions)
      .where(
        and(eq(transactions.userId, userId), eq(transactions.transferId, existing.transferId))
      );
    await db
      .delete(transfers)
      .where(and(eq(transfers.id, existing.transferId), eq(transfers.userId, userId)));
    return;
  }

  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
}

export async function createTransfer(
  userId: string,
  data: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    note?: string;
    date?: Date;
    /** Solo cuentas corrientes (transferencia manual entre corrientes). */
    requireCheckingAccounts?: boolean;
  }
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

  if (isCreditAccount(from.type)) {
    throw new Error('No se puede transferir desde una cuenta de crédito');
  }

  if (data.requireCheckingAccounts) {
    const checking = accs.filter((a) => isCheckingAccount(a.type));
    if (checking.length < MIN_ACCOUNTS_FOR_TRANSFER) {
      throw new Error('Necesitas al menos dos cuentas corrientes para transferir');
    }
    if (!isCheckingAccount(from.type) || !isCheckingAccount(to.type)) {
      throw new Error('La transferencia solo es entre cuentas corrientes');
    }
  }

  const pool = await getAccountBalancePool(userId, from.id);
  assertGastableNonNegative(applyPoolDelta(pool, { accountsDelta: -data.amount, savingsDelta: 0 }));

  const transferCat = await getOrCreateTransferCategory(userId);
  const transferDate = data.date || new Date();

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
      date: transferDate,
      accountId: data.fromAccountId,
      categoryId: transferCat.id,
      note: data.note || `Transferencia a ${to.name}`,
      transferId: transfer.id,
    },
    {
      userId,
      type: 'ingreso',
      amount: data.amount,
      date: transferDate,
      accountId: data.toAccountId,
      categoryId: transferCat.id,
      note: data.note || `Transferencia desde ${from.name}`,
      transferId: transfer.id,
    },
  ]);

  return transfer;
}

export async function payCreditBalance(
  userId: string,
  data: {
    creditAccountId: string;
    fromAccountId: string;
    amount: number;
    note?: string;
  }
) {
  if (data.amount < 1) throw new Error('El monto debe ser mayor a 0');

  const accs = await listAccounts(userId);
  const from = accs.find((account) => account.id === data.fromAccountId);
  const credit = accs.find((account) => account.id === data.creditAccountId);

  if (!from || !isCheckingAccount(from.type)) {
    throw new Error('Debes pagar desde una cuenta corriente');
  }
  if (!credit || !isCreditAccount(credit.type)) {
    throw new Error('Cuenta de crédito no encontrada');
  }
  if (credit.debt <= 0) {
    throw new Error('La cuenta de crédito no tiene deuda pendiente');
  }
  if (data.amount > credit.debt) {
    throw new Error('El abono no puede superar la deuda actual');
  }

  return createTransfer(userId, {
    fromAccountId: from.id,
    toAccountId: credit.id,
    amount: data.amount,
    note: data.note || `Abono a ${credit.name}`,
  });
}

function buildInstallmentDueDates(
  firstDueDate: Date,
  count: number,
  scheduleMode: 'consecutive' | 'billing_day',
  billingDay?: number | null
): Date[] {
  const dates: Date[] = [];
  if (scheduleMode === 'billing_day') {
    const day = Math.min(Math.max(billingDay || firstDueDate.getDate(), 1), 28);
    let cursor = startOfDay(setDate(firstDueDate, Math.min(day, 28)));
    if (cursor < startOfDay(firstDueDate)) {
      cursor = addMonths(cursor, 1);
      cursor = setDate(cursor, day);
    }
    for (let i = 0; i < count; i++) {
      dates.push(startOfDay(setDate(addMonths(cursor, i), day)));
    }
  } else {
    for (let i = 0; i < count; i++) {
      dates.push(startOfDay(addMonths(firstDueDate, i)));
    }
  }
  return dates;
}

export async function createInstallmentPurchase(
  userId: string,
  data: {
    creditAccountId: string;
    totalAmount: number;
    installmentCount: number;
    firstDueDate: Date;
    scheduleMode: 'consecutive' | 'billing_day';
    billingDay?: number;
    categoryId?: string;
    note?: string;
  }
) {
  if (data.totalAmount < 1) throw new Error('El monto debe ser mayor a 0');
  if (data.installmentCount < 1) throw new Error('Debes indicar al menos 1 cuota');
  if (data.installmentCount > 48) throw new Error('Máximo 48 cuotas');

  const accs = await listAccounts(userId);
  const credit = accs.find((a) => a.id === data.creditAccountId);
  if (!credit || !isCreditAccount(credit.type)) {
    throw new Error('La cuenta debe ser de crédito');
  }
  const limit = credit.creditLimit ?? 0;
  if (credit.debt + data.totalAmount > limit) {
    throw new Error('La compra supera el cupo disponible');
  }

  const categoryId = await resolveCategoryId(userId, data.categoryId);

  const amounts = splitInstallmentAmounts(data.totalAmount, data.installmentCount);
  const dueDates = buildInstallmentDueDates(
    data.firstDueDate,
    data.installmentCount,
    data.scheduleMode,
    data.billingDay
  );

  const db = getDb();
  const [plan] = await db
    .insert(installmentPlans)
    .values({
      userId,
      creditAccountId: data.creditAccountId,
      totalAmount: data.totalAmount,
      installmentCount: data.installmentCount,
      scheduleMode: data.scheduleMode,
      firstDueDate: data.firstDueDate,
      billingDay: data.scheduleMode === 'billing_day' ? data.billingDay || data.firstDueDate.getDate() : null,
      categoryId,
      note: data.note || null,
    })
    .returning();

  const [purchaseTx] = await db
    .insert(transactions)
    .values({
      userId,
      type: 'gasto',
      amount: data.totalAmount,
      date: new Date(),
      accountId: data.creditAccountId,
      categoryId,
      note: data.note || `${INSTALLMENT_PURCHASE_NOTE} (${data.installmentCount}x)`,
      installmentPlanId: plan.id,
    })
    .returning();

  await db
    .update(installmentPlans)
    .set({ purchaseTransactionId: purchaseTx.id })
    .where(eq(installmentPlans.id, plan.id));

  await db.insert(installments).values(
    amounts.map((plannedAmount, i) => ({
      userId,
      planId: plan.id,
      sequence: i + 1,
      dueDate: dueDates[i],
      plannedAmount,
      status: 'pending' as const,
    }))
  );

  return plan;
}

export async function listInstallments(
  userId: string,
  opts?: { creditAccountId?: string; status?: 'pending' | 'paid'; from?: Date; to?: Date }
) {
  const db = getDb();
  const conditions = [eq(installments.userId, userId)];
  if (opts?.status) conditions.push(eq(installments.status, opts.status));
  if (opts?.from) conditions.push(gte(installments.dueDate, opts.from));
  if (opts?.to) conditions.push(lte(installments.dueDate, opts.to));

  let rows = await db
    .select({
      installment: installments,
      plan: installmentPlans,
    })
    .from(installments)
    .innerJoin(installmentPlans, eq(installments.planId, installmentPlans.id))
    .where(and(...conditions))
    .orderBy(asc(installments.dueDate), asc(installments.sequence));

  if (opts?.creditAccountId) {
    rows = rows.filter((r) => r.plan.creditAccountId === opts.creditAccountId);
  }

  const today = startOfDay(new Date());
  const cats = await listCategories(userId, { includeSystem: true });

  return rows.map(({ installment, plan }) => {
    const due = startOfDay(new Date(installment.dueDate));
    const overdue = installment.status === 'pending' && due < today;
    return {
      ...installment,
      overdue,
      planNote: plan.note,
      planTotal: plan.totalAmount,
      installmentCount: plan.installmentCount,
      creditAccountId: plan.creditAccountId,
      categoryId: plan.categoryId,
      categoryName: cats.find((c) => c.id === plan.categoryId)?.name,
    };
  });
}

export async function payInstallments(
  userId: string,
  data: { installmentIds: string[]; fromAccountId: string; amount: number; note?: string }
) {
  if (!data.installmentIds.length) throw new Error('Selecciona al menos una cuota');
  if (data.amount < 1) throw new Error('El monto debe ser mayor a 0');

  const db = getDb();
  const rows = await db
    .select({
      installment: installments,
      plan: installmentPlans,
    })
    .from(installments)
    .innerJoin(installmentPlans, eq(installments.planId, installmentPlans.id))
    .where(and(eq(installments.userId, userId), inArray(installments.id, data.installmentIds)));

  if (rows.length !== data.installmentIds.length) {
    throw new Error('Alguna cuota no fue encontrada');
  }
  if (rows.some((r) => r.installment.status === 'paid')) {
    throw new Error('Alguna cuota ya está pagada');
  }

  const creditAccountId = rows[0].plan.creditAccountId;
  if (rows.some((r) => r.plan.creditAccountId !== creditAccountId)) {
    throw new Error('Las cuotas deben ser de la misma cuenta de crédito');
  }

  const accs = await listAccounts(userId);
  const from = accs.find((a) => a.id === data.fromAccountId);
  const credit = accs.find((a) => a.id === creditAccountId);
  if (!from || !isCheckingAccount(from.type)) {
    throw new Error('Debes pagar desde una cuenta corriente');
  }
  if (!credit || !isCreditAccount(credit.type)) {
    throw new Error('Cuenta de crédito no encontrada');
  }

  const pool = await getAccountBalancePool(userId, from.id);
  assertGastableNonNegative(applyPoolDelta(pool, { accountsDelta: -data.amount, savingsDelta: 0 }));

  const transferCat = await getOrCreateTransferCategory(userId);
  const now = new Date();
  const note =
    data.note ||
    (rows.length === 1
      ? `Pago cuota ${rows[0].installment.sequence}/${rows[0].plan.installmentCount}`
      : `Pago ${rows.length} cuotas tarjeta`);

  const [transfer] = await db
    .insert(transfers)
    .values({
      userId,
      fromAccountId: data.fromAccountId,
      toAccountId: creditAccountId,
      amount: data.amount,
      note,
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
      note: `${note} → ${credit.name}`,
      transferId: transfer.id,
    },
    {
      userId,
      type: 'ingreso',
      amount: data.amount,
      date: now,
      accountId: creditAccountId,
      categoryId: transferCat.id,
      note: `${note} ← ${from.name}`,
      transferId: transfer.id,
    },
  ]);

  await db
    .update(installments)
    .set({
      status: 'paid',
      paidAt: now,
      paymentTransferId: transfer.id,
    })
    .where(and(eq(installments.userId, userId), inArray(installments.id, data.installmentIds)));

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

export async function periodSummary(userId: string, from: Date, to: Date, accountId?: string) {
  const txs = await listTransactions(userId, { from, to, accountId });
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === 'gasto') expense += t.amount;
    else if (t.type === 'ingreso' && !t.savingsId) income += t.amount;
  }
  return { income, expense, transactions: txs };
}
