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
