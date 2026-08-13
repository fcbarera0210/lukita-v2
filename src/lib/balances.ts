import type { Transaction } from '../db/schema';

/** Ingreso con savingsId = apartado: no mueve saldo de cuenta. */
export function isSavingsAllocation(tx: Pick<Transaction, 'type' | 'savingsId'>): boolean {
  return tx.type === 'ingreso' && Boolean(tx.savingsId);
}

export function calculateAccountBalance(
  initialBalance: number,
  txs: Pick<Transaction, 'type' | 'amount' | 'savingsId' | 'accountId'>[],
  accountId: string
): number {
  return txs
    .filter((t) => t.accountId === accountId)
    .reduce((sum, t) => {
      if (isSavingsAllocation(t)) return sum;
      if (t.type === 'ingreso') return sum + t.amount;
      return sum - t.amount;
    }, initialBalance);
}

export function calculateSavingTotal(
  baseAmount: number,
  savingId: string,
  txs: Pick<Transaction, 'type' | 'amount' | 'savingsId'>[]
): number {
  return txs
    .filter((t) => t.savingsId === savingId)
    .reduce((sum, t) => {
      if (t.type === 'ingreso') return sum + t.amount;
      return sum - t.amount;
    }, baseAmount);
}

export function sumBalances(amounts: number[]): number {
  return amounts.reduce((s, n) => s + n, 0);
}

/** Plata libre = en cuentas − apartada en ahorros. */
export function calculateGastable(accountsTotal: number, savingsTotal: number): number {
  return accountsTotal - savingsTotal;
}

/**
 * Parte gastable estimada de una cuenta (reparto proporcional del ahorro global).
 * Los ahorros no están ligados a una cuenta concreta.
 */
export function calculateAccountGastable(
  accountBalance: number,
  accountsTotal: number,
  savingsTotal: number
): number {
  if (accountsTotal <= 0) return 0;
  const earmarked = savingsTotal * (accountBalance / accountsTotal);
  return accountBalance - earmarked;
}

export type BalancePool = {
  accountsTotal: number;
  savingsTotal: number;
  gastable: number;
};

export function makeBalancePool(accountsTotal: number, savingsTotal: number): BalancePool {
  return {
    accountsTotal,
    savingsTotal,
    gastable: calculateGastable(accountsTotal, savingsTotal),
  };
}

/** Efecto de un movimiento sobre el pool global (cuentas / ahorros). */
export function effectOfTransaction(tx: {
  type: 'ingreso' | 'gasto';
  amount: number;
  savingsId?: string | null;
}): { accountsDelta: number; savingsDelta: number } {
  const amount = tx.amount;
  if (tx.type === 'ingreso' && tx.savingsId) {
    return { accountsDelta: 0, savingsDelta: amount };
  }
  if (tx.type === 'ingreso') {
    return { accountsDelta: amount, savingsDelta: 0 };
  }
  if (tx.savingsId) {
    return { accountsDelta: -amount, savingsDelta: -amount };
  }
  return { accountsDelta: -amount, savingsDelta: 0 };
}

export function applyPoolDelta(
  pool: BalancePool,
  delta: { accountsDelta: number; savingsDelta: number }
): BalancePool {
  return makeBalancePool(pool.accountsTotal + delta.accountsDelta, pool.savingsTotal + delta.savingsDelta);
}

export const GASTABLE_ERROR =
  'No hay saldo gastable suficiente. Los ahorros no pueden superar el dinero en cuentas.';

export function assertGastableNonNegative(pool: BalancePool, message = GASTABLE_ERROR): void {
  if (pool.gastable < 0) {
    throw new Error(message);
  }
}
