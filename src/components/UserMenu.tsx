'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Settings } from 'lucide-react';
import { cn } from '../lib/utils';

export function UserMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = (email?.[0] || 'U').toUpperCase();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] py-1 pl-1 pr-2.5 transition-colors hover:bg-[var(--color-muted)]',
          open && 'ring-2 ring-[var(--color-ring)]'
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="brand-gradient flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-[#163038]">
          {initial}
        </span>
        <span className="hidden max-w-[140px] truncate text-sm font-medium sm:inline">{email}</span>
        <ChevronDown className={cn('h-4 w-4 text-[var(--color-muted-foreground)] transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-fade-up absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl"
        >
          <div className="border-b border-[var(--color-border)] px-3 py-2.5">
            <p className="truncate text-sm font-medium">{email}</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">Tu cuenta</p>
          </div>
          <a
            href="/ajustes"
            className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-[var(--color-muted)]"
            role="menuitem"
          >
            <Settings className="h-4 w-4" />
            Ajustes
          </a>
          <form method="POST" action="/api/auth">
            <input type="hidden" name="intent" value="logout" />
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-[var(--color-muted)] dark:text-red-400"
              role="menuitem"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
