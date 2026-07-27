import type { APIRoute } from 'astro';
import { authenticateUser, createSession, destroySession, registerUser } from '../../lib/auth';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const intent = String(form.get('intent') || 'login');
  const email = String(form.get('email') || '');
  const password = String(form.get('password') || '');

  try {
    if (intent === 'logout') {
      await destroySession(cookies);
      return redirect('/login');
    }

    if (!email || password.length < 6) {
      return redirect(`/${intent === 'register' ? 'register' : 'login'}?error=Datos+inválidos`);
    }

    if (intent === 'register') {
      const user = await registerUser(email, password);
      await createSession(user.id, cookies);
      return redirect('/');
    }

    const user = await authenticateUser(email, password);
    if (!user) {
      return redirect('/login?error=Credenciales+incorrectas');
    }
    await createSession(user.id, cookies);
    return redirect('/');
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    const page = intent === 'register' ? 'register' : 'login';
    return redirect(`/${page}?error=${encodeURIComponent(msg)}`);
  }
};
