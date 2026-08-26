'use client';

import { useEffect } from 'react';

const SKELETON_HTML = `
  <div class="nav-content-skeleton space-y-4" aria-busy="true" aria-live="polite">
    <div class="surface animate-pulse rounded-2xl p-5">
      <div class="h-3 w-24 rounded bg-[var(--color-muted)]"></div>
      <div class="mt-4 h-10 w-40 rounded-lg bg-[var(--color-muted)]"></div>
      <div class="mt-4 grid grid-cols-2 gap-3">
        <div class="h-16 rounded-xl bg-[var(--color-muted)]/70"></div>
        <div class="h-16 rounded-xl bg-[var(--color-muted)]/70"></div>
      </div>
    </div>
    <div class="surface animate-pulse rounded-2xl p-5">
      <div class="h-3 w-32 rounded bg-[var(--color-muted)]"></div>
      <div class="mt-4 space-y-3">
        <div class="h-12 rounded-xl bg-[var(--color-muted)]/70"></div>
        <div class="h-12 rounded-xl bg-[var(--color-muted)]/70"></div>
        <div class="h-12 rounded-xl bg-[var(--color-muted)]/70"></div>
        <div class="h-12 rounded-xl bg-[var(--color-muted)]/70"></div>
      </div>
    </div>
  </div>
`;

/** Replaces main content with a skeleton as soon as a client navigation starts. */
export function NavigationFeedback() {
  useEffect(() => {
    const onBeforePreparation = () => {
      const main = document.getElementById('app-main');
      if (!main) return;
      main.innerHTML = SKELETON_HTML;
      main.setAttribute('aria-busy', 'true');
      document.documentElement.dataset.navPending = '1';
    };

    const onDone = () => {
      const main = document.getElementById('app-main');
      main?.removeAttribute('aria-busy');
      delete document.documentElement.dataset.navPending;
    };

    document.addEventListener('astro:before-preparation', onBeforePreparation);
    document.addEventListener('astro:page-load', onDone);
    return () => {
      document.removeEventListener('astro:before-preparation', onBeforePreparation);
      document.removeEventListener('astro:page-load', onDone);
    };
  }, []);

  return null;
}
