'use client';

import { Star } from 'lucide-react';
import { cn } from '../lib/utils';

export type AccountTabItem = {
  id: string;
  name: string;
  type: string;
  isFavorite: boolean;
  colorValue?: string;
};

type Props = {
  accounts: AccountTabItem[];
  activeId: string;
  periodParam?: string;
};

export function AccountTabs({ accounts, activeId, periodParam }: Props) {
  function hrefFor(id: string) {
    const params = new URLSearchParams();
    params.set('account', id);
    if (periodParam) params.set('p', periodParam);
    return `/?${params.toString()}`;
  }

  if (accounts.length === 0) return null;

  return (
    <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1">
      {accounts.map((a) => {
        const active = a.id === activeId;
        return (
          <a
            key={a.id}
            href={hrefFor(a.id)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors',
              active
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-foreground)]'
                : 'border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
            )}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: a.colorValue || 'var(--color-primary)' }}
            />
            <span className="max-w-[9rem] truncate">{a.name}</span>
            {a.isFavorite && <Star className="h-3 w-3 fill-amber-500 text-amber-500" />}
            <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">
              {a.type === 'credito' ? 'Crédito' : 'Corriente'}
            </span>
          </a>
        );
      })}
    </div>
  );
}
