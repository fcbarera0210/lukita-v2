'use client';

import { useMemo, useState } from 'react';
import { formatCLP, parseCLP } from '../lib/clp';

type Category = { id: string; name: string };

type Props = {
  creditAccountId: string;
  categories: Category[];
  returnTo: string;
};

export function InstallmentPurchaseForm({ creditAccountId, categories, returnTo }: Props) {
  const [scheduleMode, setScheduleMode] = useState<'consecutive' | 'billing_day'>('consecutive');
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(3);

  const preview = useMemo(() => {
    if (total < 1 || count < 1) return [];
    const base = Math.floor(total / count);
    const remainder = total - base * count;
    return Array.from({ length: count }, (_, i) => base + (i === count - 1 ? remainder : 0));
  }, [total, count]);

  return (
    <form method="POST" action="/api/actions" className="space-y-3">
      <input type="hidden" name="intent" value="create_installment_purchase" />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="creditAccountId" value={creditAccountId} />

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">Total compra</label>
        <input
          name="totalAmount"
          value={total ? formatCLP(total) : ''}
          onChange={(e) => setTotal(parseCLP(e.target.value))}
          required
          className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">Cuotas</label>
        <input
          name="installmentCount"
          type="number"
          min={1}
          max={48}
          value={count}
          onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
          required
          className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">Fecha 1ª cuota</label>
        <input
          name="firstDueDate"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
          className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">Calendario</label>
        <select
          name="scheduleMode"
          value={scheduleMode}
          onChange={(e) => setScheduleMode(e.target.value as 'consecutive' | 'billing_day')}
          className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm"
        >
          <option value="consecutive">Meses consecutivos desde la 1ª fecha</option>
          <option value="billing_day">Día fijo de facturación</option>
        </select>
      </div>
      {scheduleMode === 'billing_day' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">Día de pago (1–28)</label>
          <input
            name="billingDay"
            type="number"
            min={1}
            max={28}
            defaultValue={1}
            className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm"
          />
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">Categoría</label>
        <select
          name="categoryId"
          className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm"
          defaultValue=""
        >
          <option value="">otros</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">Nota</label>
        <input
          name="note"
          placeholder="Ej. TV en 3 cuotas"
          className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm"
        />
      </div>
      {preview.length > 0 && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Preview: {preview.map((a) => formatCLP(a)).join(' · ')}
        </p>
      )}
      <button type="submit" className="brand-gradient h-10 w-full rounded-xl text-sm font-semibold text-[#163038]">
        Registrar compra en cuotas
      </button>
    </form>
  );
}
