'use client';

import { useMemo, useState } from 'react';
import { PiggyBank } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Label } from './ui/Label';
import { formatCLP, parseCLP } from '../lib/clp';
import { cn } from '../lib/utils';

type Account = { id: string; name: string; type?: string };
type Category = { id: string; name: string };
type Saving = { id: string; name: string; accountId?: string };

type Props = {
  accounts: Account[];
  categories: Category[];
  savings: Saving[];
  returnTo?: string;
  errorMessage?: string;
  /** Fija el tipo y oculta el selector gasto/ingreso */
  lockedType?: 'gasto' | 'ingreso';
  /** Oculta el selector de cuenta (cuenta ya fijada en initial.accountId) */
  hideAccountSelect?: boolean;
  initial?: {
    id?: string;
    type?: 'gasto' | 'ingreso';
    amount?: number;
    date?: string;
    accountId?: string;
    categoryId?: string;
    note?: string;
    savingsId?: string | null;
  };
};

export function MoneyMovementForm({
  accounts,
  categories,
  savings,
  returnTo = '/movimientos',
  errorMessage,
  lockedType,
  hideAccountSelect = false,
  initial,
}: Props) {
  const [movementType, setMovementType] = useState<'gasto' | 'ingreso'>(
    lockedType || initial?.type || 'gasto'
  );
  const [amount, setAmount] = useState(initial?.amount || 0);
  const [categoryId, setCategoryId] = useState(initial?.categoryId || '');
  const [accountId, setAccountId] = useState(initial?.accountId || '');
  const [affectsSaving, setAffectsSaving] = useState(Boolean(initial?.savingsId));
  const [savingsId, setSavingsId] = useState(initial?.savingsId || '');

  const effectiveType = lockedType || movementType;
  const selectedAccount = accounts.find((a) => a.id === accountId);
  const isCredit = selectedAccount?.type === 'credito';
  const canAffectSaving = !isCredit && Boolean(accountId);

  const savingsForAccount = useMemo(() => {
    if (!accountId) return [];
    return savings.filter((s) => !s.accountId || s.accountId === accountId);
  }, [savings, accountId]);

  const isEdit = Boolean(initial?.id);
  const intent = isEdit ? 'update_transaction' : 'create_transaction';
  const showTypeTabs = !isEdit && !lockedType;

  return (
    <form method="POST" action="/api/actions" className="space-y-4">
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="type" value={effectiveType} />
      {hideAccountSelect && accountId && <input type="hidden" name="accountId" value={accountId} />}

      {errorMessage && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {errorMessage}
        </p>
      )}

      {showTypeTabs && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-[var(--color-foreground)]">Tipo de movimiento</p>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--color-muted)] p-1" role="tablist">
            {(['gasto', 'ingreso'] as const).map((t) => (
              <label
                key={t}
                className={cn(
                  'relative cursor-pointer rounded-md px-2 py-2 text-center text-sm font-medium capitalize transition-colors',
                  movementType === t
                    ? 'bg-[var(--color-card)] text-[var(--color-foreground)] shadow-sm'
                    : 'text-[var(--color-muted-foreground)]'
                )}
              >
                <input
                  type="radio"
                  name="_movementTypeUi"
                  value={t}
                  checked={movementType === t}
                  onChange={() => setMovementType(t)}
                  className="absolute h-px w-px overflow-hidden opacity-0"
                />
                {t}
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="amount">Monto</Label>
        <Input
          id="amount"
          name="amount"
          value={amount ? formatCLP(amount) : ''}
          onChange={(e) => setAmount(parseCLP(e.target.value))}
          required
        />
      </div>

      <div>
        <Label htmlFor="date">Fecha</Label>
        <Input
          id="date"
          name="date"
          type="date"
          defaultValue={initial?.date || new Date().toISOString().slice(0, 10)}
          required
        />
      </div>

      {!hideAccountSelect && (
        <div>
          <Label htmlFor="accountId">Cuenta</Label>
          <Select
            id="accountId"
            name="accountId"
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setAffectsSaving(false);
              setSavingsId('');
            }}
            required
          >
            <option value="">Seleccionar</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.type === 'credito' ? ' (crédito)' : ''}
              </option>
            ))}
          </Select>
        </div>
      )}

      {!affectsSaving && (
        <div>
          <Label htmlFor="categoryId">Categoría</Label>
          <Select
            id="categoryId"
            name="categoryId"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            <option value="">Seleccionar</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {canAffectSaving && (
        <div className="space-y-3 rounded-lg border border-[var(--color-border)] p-3">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              name="affectsSaving"
              checked={affectsSaving}
              onChange={(e) => {
                setAffectsSaving(e.target.checked);
                if (!e.target.checked) setSavingsId('');
              }}
            />
            <PiggyBank className="h-4 w-4 text-[var(--color-primary)]" />
            Afecta un ahorro
          </label>
          {affectsSaving && (
            <div>
              <Label htmlFor="savingsId">Ahorro</Label>
              <Select
                id="savingsId"
                name="savingsId"
                value={savingsId}
                onChange={(e) => setSavingsId(e.target.value)}
                required
              >
                <option value="">Seleccionar</option>
                {savingsForAccount.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {affectsSaving && effectiveType === 'ingreso' && (
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Aparta dinero que ya está en la cuenta; no aumenta el saldo. No requiere categoría.
            </p>
          )}
          {affectsSaving && effectiveType === 'gasto' && (
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Se descuenta del saldo de la cuenta y del ahorro. No requiere categoría.
            </p>
          )}
        </div>
      )}

      <div>
        <Label htmlFor="note">Nota (opcional)</Label>
        <Input id="note" name="note" defaultValue={initial?.note || ''} />
      </div>

      <Button type="submit" className="brand-gradient w-full font-semibold text-[#163038] hover:opacity-90">
        {isEdit ? 'Actualizar' : 'Guardar'}
      </Button>
    </form>
  );
}
