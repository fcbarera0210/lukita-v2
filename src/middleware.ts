import { defineMiddleware } from 'astro:middleware';
import { getSessionUser } from './lib/auth';

const PUBLIC = new Set(['/login', '/register']);

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (
    pathname.startsWith('/_') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return next();
  }

  // Auth API must be reachable without session (login/register/logout)
  if (pathname === '/api/auth') {
    return next();
  }

  let user = null;
  try {
    user = await getSessionUser(context.cookies);
  } catch {
    // DB may be unavailable during setup; treat as logged out
  }
  context.locals.user = user;

  const isPublic = PUBLIC.has(pathname);
  if (!user && !isPublic) {
    return context.redirect('/login');
  }
  if (user && isPublic) {
    return context.redirect('/');
  }

  return next();
});
