'use client';

import { useMemo, useState } from 'react';
import { ArrowRightLeft, PiggyBank } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Label } from './ui/Label';
import { formatCLP, parseCLP } from '../lib/clp';

type Account = { id: string; name: string };
type Category = { id: string; name: string };
type Saving = { id: string; name: string; categoryId: string };

type Props = {
  accounts: Account[];
  categories: Category[];
  savings: Saving[];
  returnTo?: string;
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

export function MoneyMovementForm({ accounts, categories, savings, returnTo = '/movimientos', initial }: Props) {
  const [movementType, setMovementType] = useState<'gasto' | 'ingreso' | 'transferencia'>(
    initial?.id ? (initial.type || 'gasto') : 'gasto'
  );
  const [amount, setAmount] = useState(initial?.amount || 0);
  const [categoryId, setCategoryId] = useState(initial?.categoryId || '');
  const [affectsSaving, setAffectsSaving] = useState(Boolean(initial?.savingsId));
  const [savingsId, setSavingsId] = useState(initial?.savingsId || '');
  const [fromAccountId, setFromAccountId] = useState('');

  const savingsForCategory = useMemo(() => {
    if (!categoryId) return savings;
    return savings.filter((s) => s.categoryId === categoryId);
  }, [savings, categoryId]);

  const isEdit = Boolean(initial?.id);
  const isTransfer = movementType === 'transferencia';
  const intent = isTransfer
    ? 'create_transfer'
    : isEdit
      ? 'update_transaction'
      : 'create_transaction';

  return (
    <form method="POST" action="/api/actions" className="space-y-4">
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      {!isTransfer && <input type="hidden" name="type" value={movementType} />}

      {!isEdit && (
        <div>
          <Label>Tipo de movimiento</Label>
          <div className={`grid gap-1 rounded-lg bg-[var(--color-muted)] p-1 ${accounts.length >= 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {(['gasto', 'ingreso', ...(accounts.length >= 2 ? (['transferencia'] as const) : [])] as const).map(
              (t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setMovementType(t);
                    if (t === 'transferencia') setAffectsSaving(false);
                  }}
                  className={`rounded-md px-2 py-2 text-sm font-medium capitalize ${
                    movementType === t
                      ? 'bg-[var(--color-card)] shadow-sm'
                      : 'text-[var(--color-muted-foreground)]'
                  }`}
                >
                  {t}
                </button>
              )
            )}
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

      {!isTransfer && (
        <>
          <div>
            <Label htmlFor="date">Fecha</Label>
            <Input
              id="date"
              name="date"
              type="date"
              defaultValue={
                initial?.date || new Date().toISOString().slice(0, 10)
              }
              required
            />
          </div>
          <div>
            <Label htmlFor="accountId">Cuenta</Label>
            <Select id="accountId" name="accountId" defaultValue={initial?.accountId || ''} required>
              <option value="">Seleccionar</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
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
                  onChange={(e) => {
                    const id = e.target.value;
                    setSavingsId(id);
                    const s = savings.find((x) => x.id === id);
                    if (s) setCategoryId(s.categoryId);
                  }}
                  required
                >
                  <option value="">Seleccionar</option>
                  {(categoryId ? savingsForCategory : savings).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {affectsSaving && movementType === 'ingreso' && (
              <p className="text-xs text-[var(--color-muted-foreground)]">
                Aparta dinero que ya está en la cuenta; no aumenta el saldo.
              </p>
            )}
            {affectsSaving && movementType === 'gasto' && (
              <p className="text-xs text-[var(--color-muted-foreground)]">
                Se descuenta del saldo de la cuenta y del ahorro.
              </p>
            )}
          </div>
        </>
      )}

      {isTransfer && (
        <>
          <div>
            <Label>Cuenta origen</Label>
            <Select
              name="fromAccountId"
              value={fromAccountId}
              onChange={(e) => setFromAccountId(e.target.value)}
              required
            >
              <option value="">Seleccionar</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Cuenta destino</Label>
            <Select name="toAccountId" required>
              <option value="">Seleccionar</option>
              {accounts
                .filter((a) => a.id !== fromAccountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </Select>
          </div>
        </>
      )}

      <div>
        <Label htmlFor="note">Nota (opcional)</Label>
        <Input id="note" name="note" defaultValue={initial?.note || ''} />
      </div>

      <Button type="submit" className="brand-gradient w-full font-semibold text-[#163038] hover:opacity-90">
        {isTransfer ? (
          <>
            <ArrowRightLeft className="h-4 w-4" /> Transferir
          </>
        ) : isEdit ? (
          'Actualizar'
        ) : (
          'Guardar'
        )}
      </Button>
    </form>
  );
}
