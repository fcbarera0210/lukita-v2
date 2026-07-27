'use client';

import {
  Home,
  CreditCard,
  Wallet,
  Settings,
  Tag,
  PiggyBank,
} from 'lucide-react';
import { cn } from '../lib/utils';

const navItems = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/movimientos', label: 'Movimientos', icon: CreditCard },
  { href: '/cuentas', label: 'Cuentas', icon: Wallet },
  { href: '/ahorros', label: 'Ahorros', icon: PiggyBank },
  { href: '/categorias', label: 'Categorías', icon: Tag },
  { href: '/ajustes', label: 'Ajustes', icon: Settings },
];

export function AppSidebar({ currentPath }: { currentPath: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-[var(--color-border)] bg-[var(--color-sidebar)] lg:flex">
      <div className="flex h-16 items-center gap-3 border-b border-[var(--color-border)] px-5">
        <img src="/logo-lukita.svg" alt="Lukita" className="h-8" />
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === '/' ? currentPath === '/' : currentPath.startsWith(item.href);
          return (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-[color-mix(in_oklab,var(--color-primary)_14%,transparent)] text-[var(--color-primary)] shadow-sm'
                  : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]'
              )}
            >
              <Icon className={cn('h-5 w-5 transition-transform duration-200', active && 'scale-110')} />
              {item.label}
            </a>
          );
        })}
      </nav>
      <div className="border-t border-[var(--color-border)] p-4">
        <p className="font-display text-xs font-semibold tracking-wide text-[var(--color-muted-foreground)]">
          Finanzas claras
        </p>
      </div>
    </aside>
  );
}
