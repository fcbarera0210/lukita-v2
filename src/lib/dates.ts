import { startOfDay, endOfDay } from 'date-fns';

/** Periodo contable según día de corte (1–28). */
export function getPeriodFromCutoff(baseDate: Date, cutoffDay = 1): [Date, Date] {
  const d = new Date(baseDate);
  const day = Math.min(Math.max(cutoffDay, 1), 28);
  const currentCut = new Date(d.getFullYear(), d.getMonth(), day);
  let start: Date;
  let end: Date;

  if (d >= currentCut) {
    start = startOfDay(currentCut);
    const nextCut = new Date(d.getFullYear(), d.getMonth() + 1, day);
    end = endOfDay(new Date(nextCut.getTime() - 1));
  } else {
    const prevCut = new Date(d.getFullYear(), d.getMonth() - 1, day);
    start = startOfDay(prevCut);
    end = endOfDay(new Date(currentCut.getTime() - 1));
  }

  return [start, end];
}

export function getCurrentPeriod(cutoffDay = 1): [Date, Date] {
  return getPeriodFromCutoff(new Date(), cutoffDay);
}

export function shiftPeriod(baseDate: Date, cutoffDay: number, direction: -1 | 1): Date {
  const [start] = getPeriodFromCutoff(baseDate, cutoffDay);
  const pivot = new Date(start);
  pivot.setDate(pivot.getDate() + (direction === 1 ? 32 : -1));
  return pivot;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatPeriodLabel(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  const a = new Intl.DateTimeFormat('es-CL', opts).format(start);
  const b = new Intl.DateTimeFormat('es-CL', { ...opts, year: 'numeric' }).format(end);
  return `${a} – ${b}`;
}
