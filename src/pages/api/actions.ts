import type { APIRoute } from 'astro';
import {
  createAccount,
  createCategory,
  createInstallmentPurchase,
  createSaving,
  createTransaction,
  createTransfer,
  deleteAccount,
  deleteCategory,
  deleteSaving,
  deleteTransaction,
  payCreditBalance,
  payInstallments,
  setFavoriteAccount,
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
        const type = String(form.get('type') || 'corriente');
        const isCredit = type === 'credito';
        await createAccount(user.id, {
          name: String(form.get('name') || ''),
          type,
          initialBalance: parseCLP(
            String(form.get(isCredit ? 'initialSpent' : 'initialBalance') || form.get('initialBalance') || '0')
          ),
          creditLimit: isCredit ? parseCLP(String(form.get('creditLimit') || '0')) : null,
          colorId: String(form.get('colorId') || '') || undefined,
          isFavorite: form.get('isFavorite') === 'on' || form.get('isFavorite') === 'true',
        });
        break;
      }
      case 'update_account': {
        const type = String(form.get('type') || 'corriente');
        const isCredit = type === 'credito';
        await updateAccount(user.id, String(form.get('id')), {
          name: String(form.get('name') || ''),
          type,
          initialBalance: parseCLP(
            String(form.get(isCredit ? 'initialSpent' : 'initialBalance') || form.get('initialBalance') || '0')
          ),
          creditLimit: isCredit ? parseCLP(String(form.get('creditLimit') || '0')) : null,
          colorId: String(form.get('colorId') || ''),
        });
        break;
      }
      case 'set_favorite_account': {
        await setFavoriteAccount(user.id, String(form.get('id')));
        break;
      }
      case 'delete_account': {
        await deleteAccount(user.id, String(form.get('id')));
        break;
      }
      case 'create_category': {
        await createCategory(user.id, {
          name: String(form.get('name') || ''),
          icon: String(form.get('icon') || ''),
        });
        break;
      }
      case 'update_category': {
        await updateCategory(user.id, String(form.get('id')), {
          name: String(form.get('name') || ''),
          icon: String(form.get('icon') || ''),
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
          accountId: String(form.get('accountId') || ''),
          baseAmount: parseCLP(String(form.get('baseAmount') || '0')),
        });
        break;
      }
      case 'update_saving': {
        await updateSaving(user.id, String(form.get('id')), {
          name: String(form.get('name') || ''),
          accountId: String(form.get('accountId') || '') || undefined,
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
      case 'pay_credit_balance': {
        await payCreditBalance(user.id, {
          creditAccountId: String(form.get('creditAccountId') || ''),
          fromAccountId: String(form.get('fromAccountId') || ''),
          amount: parseCLP(String(form.get('amount') || '0')),
          note: String(form.get('note') || '') || undefined,
        });
        break;
      }
      case 'create_installment_purchase': {
        const scheduleMode =
          String(form.get('scheduleMode') || 'consecutive') === 'billing_day'
            ? 'billing_day'
            : 'consecutive';
        await createInstallmentPurchase(user.id, {
          creditAccountId: String(form.get('creditAccountId') || ''),
          totalAmount: parseCLP(String(form.get('totalAmount') || '0')),
          installmentCount: Number(form.get('installmentCount') || 1),
          firstDueDate: parseFormDate(String(form.get('firstDueDate') || '')),
          scheduleMode,
          billingDay: Number(form.get('billingDay') || 0) || undefined,
          categoryId: String(form.get('categoryId') || ''),
          note: String(form.get('note') || '') || undefined,
        });
        break;
      }
      case 'pay_installment':
      case 'pay_installments_month': {
        const idsRaw = form.getAll('installmentIds');
        const single = String(form.get('installmentId') || '');
        const installmentIds = [
          ...idsRaw.map((v) => String(v)).filter(Boolean),
          ...(single ? [single] : []),
        ];
        await payInstallments(user.id, {
          installmentIds,
          fromAccountId: String(form.get('fromAccountId') || ''),
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

    // Tras crear/editar movimiento, cerrar el formulario (quitar new/edit) pero conservar ok.
    if (intent === 'create_transaction' || intent === 'update_transaction') {
      const u = new URL(returnTo, 'http://local');
      u.searchParams.delete('new');
      u.searchParams.delete('edit');
      u.searchParams.delete('action');
      u.searchParams.delete('error');
      u.searchParams.set('ok', '1');
      const qs = u.searchParams.toString();
      return redirect(qs ? `${u.pathname}?${qs}` : u.pathname);
    }

    const hasFeedback = /[?&](ok|success|error)=/.test(returnTo);
    if (hasFeedback) return redirect(returnTo);
    const sep = returnTo.includes('?') ? '&' : '?';
    return redirect(`${returnTo}${sep}ok=1`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    const cleaned = returnTo
      .replace(/([?&])(ok|success)=[^&]*/g, '$1')
      .replace(/([?&])error=[^&]*/g, '$1')
      .replace(/[?&]$/, '')
      .replace(/\?&/, '?');
    const sep = cleaned.includes('?') ? '&' : '?';
    return redirect(`${cleaned}${sep}error=${encodeURIComponent(msg)}`);
  }
};
