'use client';

import { useMemo, useState } from 'react';
import { formatCLP, parseCLP } from '../lib/clp';

type CheckingAccount = {
  id: string;
  name: string;
};

type Props = {
  accounts: CheckingAccount[];
  defaultFromAccountId?: string;
  returnTo: string;
  errorMessage?: string;
};

export function TransferForm({
  accounts,
  defaultFromAccountId,
  returnTo,
  errorMessage,
}: Props) {
  const [amount, setAmount] = useState(0);
  const [fromAccountId, setFromAccountId] = useState(
    defaultFromAccountId && accounts.some((a) => a.id === defaultFromAccountId)
      ? defaultFromAccountId
      : accounts[0]?.id || ''
  );

  const toAccounts = useMemo(
    () => accounts.filter((a) => a.id !== fromAccountId),
    [accounts, fromAccountId]
  );

  if (accounts.length < 2) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Necesitas al menos dos cuentas corrientes para transferir.
      </p>
    );
  }

  return (
    <form method="POST" action="/api/actions" className="space-y-3">
      <input type="hidden" name="intent" value="create_transfer" />
      <input type="hidden" name="returnTo" value={returnTo} />

      {errorMessage && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {errorMessage}
        </p>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
          Desde
        </label>
        <select
          name="fromAccountId"
          required
          value={fromAccountId}
          onChange={(event) => setFromAccountId(event.target.value)}
          className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
          Hacia
        </label>
        <select
          name="toAccountId"
          required
          className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm"
          defaultValue={toAccounts[0]?.id}
          key={fromAccountId}
        >
          {toAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
          Monto
        </label>
        <input
          name="amount"
          value={amount ? formatCLP(amount) : ''}
          onChange={(event) => setAmount(parseCLP(event.target.value))}
          required
          className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
          Fecha
        </label>
        <input
          name="date"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
          className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
          Nota (opcional)
        </label>
        <input
          name="note"
          placeholder="Ej. Traspaso a ahorro operativo"
          className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm"
        />
      </div>

      <button
        type="submit"
        className="brand-gradient h-10 w-full rounded-xl text-sm font-semibold text-[#163038]"
      >
        Transferir
      </button>
    </form>
  );
}
