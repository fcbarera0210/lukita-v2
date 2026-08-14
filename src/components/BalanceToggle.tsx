'use client';

import { useState } from 'react';
import { formatCLP } from '../lib/clp';
import { cn } from '../lib/utils';

type Mode = 'gastable' | 'cuentas';

type Props = {
  accountsTotal: number;
  gastable: number;
  accountsCount?: number;
  size?: 'lg' | 'md';
  className?: string;
};

export function BalanceToggle({
  accountsTotal,
  gastable,
  accountsCount,
  size = 'lg',
  className,
}: Props) {
  const [mode, setMode] = useState<Mode>('gastable');
  const value = mode === 'gastable' ? gastable : accountsTotal;

  return (
    <div className={cn(className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {mode === 'gastable' ? 'Gastable' : 'En cuentas'}
        </p>
        <div className="inline-flex rounded-lg bg-[var(--color-muted)] p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode('gastable')}
            className={cn(
              'rounded-md px-2.5 py-1 transition-colors',
              mode === 'gastable'
                ? 'bg-[var(--color-card)] text-[var(--color-foreground)] shadow-sm'
                : 'text-[var(--color-muted-foreground)]'
            )}
          >
            Gastable
          </button>
          <button
            type="button"
            onClick={() => setMode('cuentas')}
            className={cn(
              'rounded-md px-2.5 py-1 transition-colors',
              mode === 'cuentas'
                ? 'bg-[var(--color-card)] text-[var(--color-foreground)] shadow-sm'
                : 'text-[var(--color-muted-foreground)]'
            )}
          >
            En cuentas
          </button>
        </div>
      </div>
      <p
        className={cn(
          'font-display font-bold tracking-tight tabular-nums',
          size === 'lg' ? 'text-4xl' : 'text-2xl'
        )}
      >
        {formatCLP(value)}
      </p>
      <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
        {mode === 'gastable'
          ? 'Disponible tras ahorros'
          : accountsCount != null
            ? `Suma de ${accountsCount} cuenta${accountsCount === 1 ? '' : 's'}`
            : 'Suma de todas las cuentas'}
      </p>
    </div>
  );
}

type AccountProps = {
  balance: number;
  gastable: number;
  className?: string;
  size?: 'lg' | 'md' | 'sm';
};

/** Switch compacto para el saldo de una cuenta individual. */
export function AccountBalanceToggle({ balance, gastable, className, size = 'sm' }: AccountProps) {
  const [mode, setMode] = useState<Mode>('gastable');
  const value = mode === 'gastable' ? gastable : balance;
  const isLarge = size === 'lg';

  return (
    <div className={cn(isLarge ? '' : 'text-right', className)}>
      <div
        className={cn(
          'mb-1 inline-flex rounded-md bg-[var(--color-muted)]/80 p-0.5 font-semibold',
          isLarge ? 'text-xs' : 'text-[10px]'
        )}
      >
        <button
          type="button"
          onClick={() => setMode('gastable')}
          className={cn(
            'rounded px-1.5 py-0.5 transition-colors',
            isLarge && 'px-2.5 py-1',
            mode === 'gastable' ? 'bg-[var(--color-card)] shadow-sm' : 'text-[var(--color-muted-foreground)]'
          )}
        >
          Gastable
        </button>
        <button
          type="button"
          onClick={() => setMode('cuentas')}
          className={cn(
            'rounded px-1.5 py-0.5 transition-colors',
            isLarge && 'px-2.5 py-1',
            mode === 'cuentas' ? 'bg-[var(--color-card)] shadow-sm' : 'text-[var(--color-muted-foreground)]'
          )}
        >
          Saldo
        </button>
      </div>
      <p
        className={cn(
          'font-display font-bold tabular-nums',
          isLarge ? 'mt-2 text-4xl tracking-tight' : 'text-lg'
        )}
      >
        {formatCLP(value)}
      </p>
      <p className={cn('text-[var(--color-muted-foreground)]', isLarge ? 'mt-2 text-xs' : 'text-[10px]')}>
        {mode === 'gastable' ? 'Disponible tras ahorros' : 'Saldo de la cuenta'}
      </p>
    </div>
  );
}
