export const ACCOUNT_COLORS = [
  { id: 'blue', name: 'Azul', value: '#3B82F6', class: 'border-blue-500', bgClass: 'bg-blue-500', textClass: 'text-blue-500' },
  { id: 'green', name: 'Verde', value: '#10B981', class: 'border-green-500', bgClass: 'bg-green-500', textClass: 'text-green-500' },
  { id: 'red', name: 'Rojo', value: '#EF4444', class: 'border-red-500', bgClass: 'bg-red-500', textClass: 'text-red-500' },
  { id: 'yellow', name: 'Amarillo', value: '#F59E0B', class: 'border-yellow-500', bgClass: 'bg-yellow-500', textClass: 'text-yellow-500' },
  { id: 'purple', name: 'Púrpura', value: '#8B5CF6', class: 'border-purple-500', bgClass: 'bg-purple-500', textClass: 'text-purple-500' },
  { id: 'pink', name: 'Rosa', value: '#EC4899', class: 'border-pink-500', bgClass: 'bg-pink-500', textClass: 'text-pink-500' },
  { id: 'cyan', name: 'Cian', value: '#06B6D4', class: 'border-cyan-500', bgClass: 'bg-cyan-500', textClass: 'text-cyan-500' },
  { id: 'orange', name: 'Naranja', value: '#F97316', class: 'border-orange-500', bgClass: 'bg-orange-500', textClass: 'text-orange-500' },
] as const;

export type AccountColorId = (typeof ACCOUNT_COLORS)[number]['id'];

export const MAX_ACCOUNTS = 8;
export const MIN_ACCOUNTS_FOR_TRANSFER = 2;

export const ACCOUNT_TYPES = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'cuenta_corriente', label: 'Cuenta corriente' },
  { id: 'tarjeta', label: 'Tarjeta' },
  { id: 'ahorro', label: 'Ahorro' },
  { id: 'otro', label: 'Otro' },
] as const;

export function getColorById(id: string) {
  return ACCOUNT_COLORS.find((c) => c.id === id);
}

export function getAvailableColors(used: string[]) {
  return ACCOUNT_COLORS.filter((c) => !used.includes(c.id));
}

export function getNextAvailableColor(used: string[]): AccountColorId {
  return getAvailableColors(used)[0]?.id ?? 'blue';
}
