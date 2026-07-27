import type { APIRoute } from 'astro';
import {
  createAccount,
  createCategory,
  createSaving,
  createTransaction,
  createTransfer,
  deleteAccount,
  deleteCategory,
  deleteSaving,
  deleteTransaction,
  updateAccount,
  updateCategory,
  updateSaving,
  updateTransaction,
  updateUserSettings,
  changePassword,
} from '../../lib/data';
import { parseCLP } from '../../lib/clp';

function parseFormDate(value: string): Date {
  if (!value) return new Date();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00`);
  }
  return new Date(value);
}

function requireUser(locals: App.Locals) {
  if (!locals.user) throw new Error('No autorizado');
  return locals.user;
}

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = requireUser(locals);
  const form = await request.formData();
  const intent = String(form.get('intent') || '');
  const returnTo = String(form.get('returnTo') || '/');

  try {
    switch (intent) {
      case 'create_account': {
        await createAccount(user.id, {
          name: String(form.get('name') || ''),
          type: String(form.get('type') || 'efectivo'),
          initialBalance: parseCLP(String(form.get('initialBalance') || '0')),
          colorId: String(form.get('colorId') || '') || undefined,
        });
        break;
      }
      case 'update_account': {
        await updateAccount(user.id, String(form.get('id')), {
          name: String(form.get('name') || ''),
          type: String(form.get('type') || 'efectivo'),
          initialBalance: parseCLP(String(form.get('initialBalance') || '0')),
          colorId: String(form.get('colorId') || ''),
        });
        break;
      }
      case 'delete_account': {
        await deleteAccount(user.id, String(form.get('id')));
        break;
      }
      case 'create_category': {
        await createCategory(user.id, {
          name: String(form.get('name') || ''),
          icon: String(form.get('icon') || 'Tag'),
        });
        break;
      }
      case 'update_category': {
        await updateCategory(user.id, String(form.get('id')), {
          name: String(form.get('name') || ''),
          icon: String(form.get('icon') || 'Tag'),
        });
        break;
      }
      case 'delete_category': {
        await deleteCategory(user.id, String(form.get('id')));
        break;
      }
      case 'create_saving': {
        await createSaving(user.id, {
          name: String(form.get('name') || ''),
          categoryId: String(form.get('categoryId') || ''),
          baseAmount: parseCLP(String(form.get('baseAmount') || '0')),
        });
        break;
      }
      case 'update_saving': {
        await updateSaving(user.id, String(form.get('id')), {
          name: String(form.get('name') || ''),
          categoryId: String(form.get('categoryId') || ''),
          baseAmount: parseCLP(String(form.get('baseAmount') || '0')),
        });
        break;
      }
      case 'delete_saving': {
        await deleteSaving(user.id, String(form.get('id')));
        break;
      }
      case 'create_transaction': {
        const affects = form.get('affectsSaving') === 'on' || form.get('affectsSaving') === 'true';
        await createTransaction(user.id, {
          type: String(form.get('type')) as 'ingreso' | 'gasto',
          amount: parseCLP(String(form.get('amount') || '0')),
          date: parseFormDate(String(form.get('date') || '')),
          accountId: String(form.get('accountId') || ''),
          categoryId: String(form.get('categoryId') || ''),
          note: String(form.get('note') || '') || undefined,
          savingsId: affects ? String(form.get('savingsId') || '') || undefined : undefined,
        });
        break;
      }
      case 'update_transaction': {
        const affects = form.get('affectsSaving') === 'on' || form.get('affectsSaving') === 'true';
        await updateTransaction(user.id, String(form.get('id')), {
          type: String(form.get('type')) as 'ingreso' | 'gasto',
          amount: parseCLP(String(form.get('amount') || '0')),
          date: parseFormDate(String(form.get('date') || '')),
          accountId: String(form.get('accountId') || ''),
          categoryId: String(form.get('categoryId') || ''),
          note: String(form.get('note') || '') || null,
          savingsId: affects ? String(form.get('savingsId') || '') || null : null,
        });
        break;
      }
      case 'delete_transaction': {
        await deleteTransaction(user.id, String(form.get('id')));
        break;
      }
      case 'create_transfer': {
        await createTransfer(user.id, {
          fromAccountId: String(form.get('fromAccountId') || ''),
          toAccountId: String(form.get('toAccountId') || ''),
          amount: parseCLP(String(form.get('amount') || '0')),
          note: String(form.get('note') || '') || undefined,
        });
        break;
      }
      case 'update_settings': {
        await updateUserSettings(user.id, {
          monthCutoffDay: Number(form.get('monthCutoffDay') || 1),
          theme: String(form.get('theme') || 'dark'),
          dashboardRecentCount: Number(form.get('dashboardRecentCount') || 5) === 10 ? 10 : 5,
        });
        break;
      }
      case 'change_password': {
        await changePassword(
          user.id,
          String(form.get('currentPassword') || ''),
          String(form.get('newPassword') || '')
        );
        break;
      }
      default:
        throw new Error('Acción desconocida');
    }
    const hasFeedback = /[?&](ok|success|error)=/.test(returnTo);
    if (hasFeedback) return redirect(returnTo);
    const sep = returnTo.includes('?') ? '&' : '?';
    return redirect(`${returnTo}${sep}ok=1`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    const cleaned = returnTo.replace(/([?&])(ok|success)=[^&]*/g, '$1').replace(/[?&]$/, '');
    const sep = cleaned.includes('?') ? '&' : '?';
    return redirect(`${cleaned}${sep}error=${encodeURIComponent(msg)}`);
  }
};
