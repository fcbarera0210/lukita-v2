'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { cn } from '../lib/utils';

type ToastItem = {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
};

function readQueryToasts(): ToastItem[] {
  if (typeof window === 'undefined') return [];
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  const ok = params.get('ok');
  const success = params.get('success');
  const formOpen = params.get('new') === '1' || params.has('edit');
  const items: ToastItem[] = [];

  // Errores del formulario de movimiento se muestran en el form, no como toast.
  if (error && !formOpen) {
    items.push({ id: Date.now(), type: 'error', message: error });
  } else if (ok || success) {
    items.push({
      id: Date.now() + 1,
      type: 'success',
      message: success || 'Guardado correctamente',
    });
  }

  if (error || ok || success) {
    params.delete('error');
    params.delete('ok');
    params.delete('success');
    const qs = params.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', next);
  }

  return items;
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const showFromUrl = () => {
      const items = readQueryToasts();
      if (items.length) setToasts((t) => [...t, ...items]);
    };

    showFromUrl();
    document.addEventListener('astro:page-load', showFromUrl);
    return () => document.removeEventListener('astro:page-load', showFromUrl);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((toast) =>
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== toast.id));
      }, 4200)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-24 left-0 right-0 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:px-6">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-md',
            toast.type === 'error'
              ? 'border-red-500/30 bg-[color-mix(in_oklab,var(--color-card)_92%,red)] text-red-600 dark:text-red-300'
              : toast.type === 'success'
                ? 'border-[color-mix(in_oklab,var(--color-brand-green)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-card)_92%,var(--color-brand-green))] text-[var(--color-foreground)]'
                : 'border-[var(--color-border)] bg-[var(--color-card)]'
          )}
          role="status"
        >
          {toast.type === 'error' ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand-green)]" />
          )}
          <p className="flex-1 text-sm font-medium">{toast.message}</p>
          <button
            type="button"
            className="rounded-md p-0.5 opacity-60 hover:opacity-100"
            onClick={() => setToasts((current) => current.filter((t) => t.id !== toast.id))}
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
