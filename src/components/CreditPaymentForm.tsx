'use client';

import { useState } from 'react';
import { formatCLP, parseCLP } from '../lib/clp';

type CheckingAccount = {
  id: string;
  name: string;
};

type Props = {
  creditAccountId: string;
  checkingAccounts: CheckingAccount[];
  currentDebt: number;
  returnTo: string;
};

export function CreditPaymentForm({
  creditAccountId,
  checkingAccounts,
  currentDebt,
  returnTo,
}: Props) {
  const [amount, setAmount] = useState(0);

  if (checkingAccounts.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Necesitas una cuenta corriente para realizar un abono.
      </p>
    );
  }

  if (currentDebt <= 0) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Esta cuenta no tiene deuda pendiente.
      </p>
    );
  }

  return (
    <form method="POST" action="/api/actions" className="space-y-3">
      <input type="hidden" name="intent" value="pay_credit_balance" />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="creditAccountId" value={creditAccountId} />

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
          Pagar desde
        </label>
        <select
          name="fromAccountId"
          required
          className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm"
        >
          {checkingAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
          Monto del abono
        </label>
        <input
          name="amount"
          value={amount ? formatCLP(amount) : ''}
          onChange={(event) => setAmount(parseCLP(event.target.value))}
          required
          className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm"
        />
        <p className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">
          Deuda actual: {formatCLP(currentDebt)}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
          Nota (opcional)
        </label>
        <input
          name="note"
          placeholder="Ej. Abono extraordinario"
          className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm"
        />
      </div>

      <button
        type="submit"
        className="brand-gradient h-10 w-full rounded-xl text-sm font-semibold text-[#163038]"
      >
        Realizar abono
      </button>
    </form>
  );
}
