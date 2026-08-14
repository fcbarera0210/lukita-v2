'use client';

import { useState } from 'react';
import { ACCOUNT_TYPES } from '../lib/account-colors';

type ColorOption = { id: string; name: string };

type Props = {
  mode: 'create' | 'edit';
  initialType?: string;
  initialBalance?: number;
  creditLimit?: number | null;
  colorId?: string;
  colorOptions: ColorOption[];
};

export function AccountFormFields({
  mode,
  initialType = 'corriente',
  initialBalance = 0,
  creditLimit = 0,
  colorId,
  colorOptions,
}: Props) {
  const [type, setType] = useState(initialType === 'credito' ? 'credito' : 'corriente');
  const isCredit = type === 'credito';

  return (
    <div className="space-y-2">
      <select
        name="type"
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="h-9 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-2 text-sm"
      >
        {ACCOUNT_TYPES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>

      {isCredit ? (
        <>
          <input
            name="creditLimit"
            placeholder="Cupo"
            defaultValue={mode === 'edit' ? String(creditLimit || 0) : ''}
            required
            className="h-9 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-2 text-sm"
          />
          <input
            name="initialSpent"
            placeholder="Gastado"
            defaultValue={String(initialBalance || 0)}
            className="h-9 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-2 text-sm"
          />
          <p className="text-[11px] text-[var(--color-muted-foreground)]">
            Cupo &gt; 0. Gastado puede ser 0. Disponible = cupo − deuda.
          </p>
        </>
      ) : (
        <input
          name="initialBalance"
          placeholder="Saldo inicial"
          defaultValue={String(initialBalance || 0)}
          className="h-9 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-2 text-sm"
        />
      )}

      <select
        name="colorId"
        defaultValue={colorId || colorOptions[0]?.id || ''}
        className="h-9 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-2 text-sm"
      >
        {colorOptions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
