'use client';

import { useEffect, useState, type MouseEvent } from 'react';

function pathFromHref(href: string) {
  try {
    return new URL(href, window.location.origin).pathname;
  } catch {
    return href;
  }
}

/** Tracks current + pending route for optimistic nav highlighting across Astro transitions. */
export function useNavPath(initialPath: string) {
  const [path, setPath] = useState(initialPath);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setPath(window.location.pathname);
      setPendingPath(null);
    };
    document.addEventListener('astro:page-load', sync);
    document.addEventListener('astro:after-swap', sync);
    return () => {
      document.removeEventListener('astro:page-load', sync);
      document.removeEventListener('astro:after-swap', sync);
    };
  }, []);

  const onNavClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const href = event.currentTarget.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    setPendingPath(pathFromHref(href));
  };

  return {
    activePath: pendingPath ?? path,
    pending: pendingPath !== null,
    onNavClick,
  };
}
