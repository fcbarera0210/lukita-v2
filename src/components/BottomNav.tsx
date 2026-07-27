'use client';

import { Home, CreditCard, Wallet, Settings, MoreHorizontal, Tag, PiggyBank } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';

const primary = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/movimientos', label: 'Movimientos', icon: CreditCard },
  { href: '/cuentas', label: 'Cuentas', icon: Wallet },
  { href: '/ajustes', label: 'Ajustes', icon: Settings },
];

const secondary = [
  { href: '/categorias', label: 'Categorías', icon: Tag },
  { href: '/ahorros', label: 'Ahorros', icon: PiggyBank },
];

export function BottomNav({ currentPath }: { currentPath: string }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const secondaryActive = secondary.some((i) => currentPath.startsWith(i.href));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-card)]">
      {moreOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-full left-0 right-0 z-50 border-t border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-lg">
            <div className="mx-auto grid max-w-lg grid-cols-2 gap-2">
              {secondary.map((item) => {
                const Icon = item.icon;
                const active = currentPath.startsWith(item.href);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg p-3 text-xs',
                      active
                        ? 'bg-[color-mix(in_oklab,var(--color-primary)_15%,transparent)] text-[var(--color-primary)]'
                        : 'text-[var(--color-muted-foreground)]'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </a>
                );
              })}
            </div>
          </div>
        </>
      )}
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 pb-5 pt-2">
        {primary.map((item) => {
          const Icon = item.icon;
          const active = item.href === '/' ? currentPath === '/' : currentPath.startsWith(item.href);
          return (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg p-2 text-[10px] font-medium',
                active ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted-foreground)]'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate">{item.label}</span>
            </a>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className={cn(
            'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg p-2 text-[10px] font-medium',
            moreOpen || secondaryActive
              ? 'text-[var(--color-primary)]'
              : 'text-[var(--color-muted-foreground)]'
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          Más
        </button>
      </div>
    </nav>
  );
}
