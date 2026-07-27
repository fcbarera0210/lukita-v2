'use client';

import { useEffect } from 'react';

/** Adds pending/disabled state to native form submits across the app. */
export function FormPending() {
  useEffect(() => {
    const onSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.dataset.noPending === 'true') return;

      const buttons = form.querySelectorAll<HTMLButtonElement>('button[type="submit"], button:not([type])');
      buttons.forEach((btn) => {
        if (btn.dataset.pending === '1') return;
        btn.dataset.pending = '1';
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        const original = btn.innerHTML;
        btn.dataset.originalHtml = original;
        btn.innerHTML = `<span class="inline-flex items-center gap-2"><svg class="animate-spin-slow h-4 w-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" opacity="0.25"/><path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Guardando…</span>`;
      });
    };

    document.addEventListener('submit', onSubmit, true);
    return () => document.removeEventListener('submit', onSubmit, true);
  }, []);

  return null;
}
