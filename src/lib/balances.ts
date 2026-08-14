import type { Transaction } from '../db/schema';

/** Ingreso con savingsId = apartado: no mueve saldo de cuenta. */
export function isSavingsAllocation(tx: Pick<Transaction, 'type' | 'savingsId'>): boolean {
  return tx.type === 'ingreso' && Boolean(tx.savingsId);
}

/** Saldo de cuenta corriente: inicial + ingresos − gastos (apartados no suman). */
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

/**
 * Deuda de cuenta crédito: gastado inicial + gastos − ingresos.
 * (Los apartados no aplican a crédito.)
 */
export function calculateCreditDebt(
  initialSpent: number,
  txs: Pick<Transaction, 'type' | 'amount' | 'savingsId' | 'accountId'>[],
  accountId: string
): number {
  return txs
    .filter((t) => t.accountId === accountId)
    .reduce((sum, t) => {
      if (isSavingsAllocation(t)) return sum;
      if (t.type === 'gasto') return sum + t.amount;
      return sum - t.amount;
    }, initialSpent);
}

export function calculateCreditAvailable(creditLimit: number, debt: number): number {
  return creditLimit - debt;
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

/** Plata libre = saldo de la cuenta − ahorros de esa cuenta. */
export function calculateGastable(accountBalance: number, savingsTotal: number): number {
  return accountBalance - savingsTotal;
}

/** Gastable de una cuenta corriente con sus propios ahorros. */
export function calculateAccountGastable(accountBalance: number, accountSavingsTotal: number): number {
  return calculateGastable(accountBalance, accountSavingsTotal);
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

/** Efecto de un movimiento sobre el pool de una cuenta (saldo / ahorros). */
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
  'No hay saldo gastable suficiente. Los ahorros no pueden superar el dinero en la cuenta.';

export function assertGastableNonNegative(pool: BalancePool, message = GASTABLE_ERROR): void {
  if (pool.gastable < 0) {
    throw new Error(message);
  }
}

/** Divide un monto en N cuotas (resto en la última). */
export function splitInstallmentAmounts(total: number, count: number): number[] {
  if (count < 1) throw new Error('La cantidad de cuotas debe ser al menos 1');
  if (total < 1) throw new Error('El monto debe ser mayor a 0');
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i === count - 1 ? remainder : 0));
}
