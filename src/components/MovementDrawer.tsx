'use client';

import { X } from 'lucide-react';
import { MoneyMovementForm } from './MoneyMovementForm';

type Account = { id: string; name: string; type?: string };
type Category = { id: string; name: string };
type Saving = { id: string; name: string; accountId?: string };

type Props = {
  open: boolean;
  accounts: Account[];
  categories: Category[];
  savings: Saving[];
  returnTo?: string;
  errorMessage?: string;
  title: string;
  closeHref: string;
  initial?: {
    id?: string;
    type?: 'gasto' | 'ingreso';
    amount?: number;
    date?: string;
    accountId?: string;
    categoryId?: string;
    note?: string;
    savingsId?: string | null;
  };
};

export function MovementDrawer({
  open,
  accounts,
  categories,
  savings,
  returnTo = '/movimientos',
  errorMessage,
  title,
  closeHref,
  initial,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <a href={closeHref} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" aria-label="Cerrar" />
      <div className="animate-fade-up relative z-10 flex h-full w-full max-w-md flex-col border-l border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <a
            href={closeHref}
            className="rounded-lg p-2 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </a>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <MoneyMovementForm
            accounts={accounts}
            categories={categories}
            savings={savings}
            returnTo={returnTo}
            errorMessage={errorMessage}
            initial={initial}
          />
        </div>
      </div>
    </div>
  );
}
