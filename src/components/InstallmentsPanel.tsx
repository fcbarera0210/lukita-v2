'use client';

import { useMemo, useState } from 'react';
import { formatCLP, parseCLP } from '../lib/clp';
import { formatDate } from '../lib/dates';

export type InstallmentRow = {
  id: string;
  sequence: number;
  dueDate: string;
  plannedAmount: number;
  status: string;
  overdue: boolean;
  installmentCount: number;
  planNote: string | null;
  categoryName?: string;
};

type CheckingAccount = { id: string; name: string };

type Props = {
  installments: InstallmentRow[];
  checkingAccounts: CheckingAccount[];
  returnTo: string;
  mode?: 'list' | 'pay-month';
};

export function InstallmentsPanel({
  installments,
  checkingAccounts,
  returnTo,
  mode = 'list',
}: Props) {
  const pending = installments.filter((i) => i.status === 'pending');
  const [selected, setSelected] = useState<string[]>(
    mode === 'pay-month' ? pending.map((i) => i.id) : []
  );
  const [amount, setAmount] = useState(() =>
    mode === 'pay-month'
      ? pending.reduce((s, i) => s + i.plannedAmount, 0)
      : pending[0]?.plannedAmount || 0
  );
  const [singleId, setSingleId] = useState(pending[0]?.id || '');

  const selectedSum = useMemo(() => {
    const ids = mode === 'pay-month' ? selected : singleId ? [singleId] : [];
    return pending.filter((i) => ids.includes(i.id)).reduce((s, i) => s + i.plannedAmount, 0);
  }, [mode, selected, singleId, pending]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      const sum = pending.filter((i) => next.includes(i.id)).reduce((s, i) => s + i.plannedAmount, 0);
      setAmount(sum);
      return next;
    });
  }

  if (checkingAccounts.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Necesitas una cuenta corriente para pagar cuotas.
      </p>
    );
  }

  if (pending.length === 0) {
    return <p className="text-sm text-[var(--color-muted-foreground)]">No hay cuotas pendientes.</p>;
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {pending.map((i) => (
          <li
            key={i.id}
            className={`rounded-xl border px-3 py-2 text-sm ${
              i.overdue
                ? 'border-amber-500/40 bg-amber-500/10'
                : 'border-[var(--color-border)] bg-[var(--color-muted)]/40'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">
                  Cuota {i.sequence}/{i.installmentCount}
                  {i.overdue && (
                    <span className="ml-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                      Vencida — revisar
                    </span>
                  )}
                </p>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {formatDate(new Date(i.dueDate))}
                  {i.planNote ? ` · ${i.planNote}` : ''}
                  {i.categoryName ? ` · ${i.categoryName}` : ''}
                </p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums">{formatCLP(i.plannedAmount)}</p>
            </div>
            {mode === 'pay-month' && (
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={selected.includes(i.id)}
                  onChange={() => toggle(i.id)}
                />
                Incluir en pago del mes
              </label>
            )}
          </li>
        ))}
      </ul>

      <form method="POST" action="/api/actions" className="space-y-3">
        <input
          type="hidden"
          name="intent"
          value={mode === 'pay-month' ? 'pay_installments_month' : 'pay_installment'}
        />
        <input type="hidden" name="returnTo" value={returnTo} />

        {mode === 'pay-month' ? (
          selected.map((id) => <input key={id} type="hidden" name="installmentIds" value={id} />)
        ) : (
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
              Cuota a pagar
            </label>
            <select
              name="installmentId"
              value={singleId}
              onChange={(e) => {
                setSingleId(e.target.value);
                const row = pending.find((i) => i.id === e.target.value);
                if (row) setAmount(row.plannedAmount);
              }}
              required
              className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm"
            >
              {pending.map((i) => (
                <option key={i.id} value={i.id}>
                  #{i.sequence}/{i.installmentCount} · {formatDate(new Date(i.dueDate))} ·{' '}
                  {formatCLP(i.plannedAmount)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
            Pagar desde (corriente)
          </label>
          <select
            name="fromAccountId"
            required
            className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm"
          >
            {checkingAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
            Monto a pagar (ajustable)
          </label>
          <input
            name="amount"
            value={amount ? formatCLP(amount) : ''}
            onChange={(e) => setAmount(parseCLP(e.target.value))}
            required
            className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm"
          />
          <p className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">
            Sugerido según cuotas: {formatCLP(selectedSum)}
          </p>
        </div>

        <button
          type="submit"
          disabled={mode === 'pay-month' ? selected.length === 0 : !singleId}
          className="brand-gradient h-10 w-full rounded-xl text-sm font-semibold text-[#163038] disabled:opacity-50"
        >
          {mode === 'pay-month' ? 'Pagar cuotas seleccionadas' : 'Pagar cuota'}
        </button>
      </form>
    </div>
  );
}
