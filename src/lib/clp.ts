export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function parseCLP(value: string): number {
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return 0;
  return Number.parseInt(digits, 10);
}
