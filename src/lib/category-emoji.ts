/** Map legacy Lucide icon keys to emoji for display. */
const LEGACY_ICONS: Record<string, string> = {
  Tag: '🏷️',
  ShoppingCart: '🛒',
  Home: '🏠',
  Car: '🚗',
  Utensils: '🍽️',
  Heart: '❤️',
  Briefcase: '💼',
  Gift: '🎁',
  Zap: '⚡',
  Coffee: '☕',
  ArrowRightLeft: '↔️',
};

export const DEFAULT_CATEGORY_EMOJI = '🏷️';

/** First grapheme / emoji from user input; falls back to default. */
export function normalizeCategoryEmoji(raw: string | null | undefined): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return DEFAULT_CATEGORY_EMOJI;
  if (LEGACY_ICONS[trimmed]) return LEGACY_ICONS[trimmed];
  try {
    const segmenter = new Intl.Segmenter('es', { granularity: 'grapheme' });
    const first = [...segmenter.segment(trimmed)][0]?.segment;
    return first?.trim() || DEFAULT_CATEGORY_EMOJI;
  } catch {
    return [...trimmed][0] || DEFAULT_CATEGORY_EMOJI;
  }
}

/** Resolve stored icon (emoji or legacy Lucide name) for UI. */
export function categoryEmoji(icon: string | null | undefined): string {
  if (!icon) return DEFAULT_CATEGORY_EMOJI;
  return LEGACY_ICONS[icon] || icon;
}
