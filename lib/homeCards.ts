export const HOME_CARD_INTERNAL_TARGETS = ['today', 'zodiac', 'natal', 'compatibility', 'matrix', 'saved', 'premium', 'encyclopedia', 'settings', 'support'] as const;
export type HomeCardInternalTarget = typeof HOME_CARD_INTERNAL_TARGETS[number];
export type HomeCardAction = { kind: 'internal'; target: HomeCardInternalTarget } | { kind: 'external'; url: string };
export type HomeCard = {
  schemaVersion: 1;
  title: string;
  caption: string;
  imageUrl?: string;
  tone: 'violet' | 'sky' | 'mint' | 'peach' | 'rose';
  layout: 'popout' | 'cover' | 'compact';
  action: HomeCardAction;
  order: number;
  audience: 'all' | 'free' | 'premium';
  startsAt: string | null;
  endsAt: string | null;
  badge?: string;
};
export type PublishedHomeCard = HomeCard & { id: number };
export type HomeCardsResponse = { cards: PublishedHomeCard[]; nextChangeAt: string | null };

export class HomeCardValidationError extends Error {}
const invalid = (message: string): never => { throw new HomeCardValidationError(message); };
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid('Проверьте поля карточки.');
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max: number, required = true): string {
  if (typeof value !== 'string') return invalid(`Заполните поле «${label}».`);
  const result = value.trim();
  if ((required && !result) || result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)) {
    return invalid(`«${label}»: ${required ? 'от 1 до' : 'не более'} ${max} символов.`);
  }
  return result;
}

/** URLs are rendered by the client; the server never fetches administrator URLs. */
export function safeHomeCardUrl(value: unknown, image = false): string {
  const raw = text(value, image ? 'Картинка' : 'Ссылка', 2048);
  if (/[\s\\]/.test(raw)) return invalid('В ссылке не должно быть пробелов или обратных слешей.');
  if (image && /^\/(?:assets|images)\/[a-zA-Z0-9_./-]+\.(?:webp|png|jpe?g|avif)$/i.test(raw)
    && !raw.includes('..') && !raw.includes('//')) return raw;
  let url: URL;
  try { url = new URL(raw); } catch { return invalid('Укажите полный HTTPS-адрес.'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')
    || !host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || host.endsWith('.')
    || /(?:^|\.)(?:localhost|local|internal|test|invalid|example|onion)$/.test(host) || host.endsWith('.home.arpa')) {
    return invalid('Нужен публичный HTTPS-адрес без пароля и нестандартного порта.');
  }
  return url.toString();
}

function date(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return invalid(`Проверьте дату «${label}».`);
  }
  const stamp = Date.parse(value);
  if (!Number.isFinite(stamp)) return invalid(`Проверьте дату «${label}».`);
  // Date.parse normalizes 30 February; reject impossible calendar dates first.
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const actual = new Date(Date.UTC(year, month - 1, day));
  if (actual.getUTCFullYear() !== year || actual.getUTCMonth() !== month - 1 || actual.getUTCDate() !== day) return invalid(`Проверьте дату «${label}».`);
  return new Date(stamp).toISOString();
}

export function parseHomeCard(input: unknown): HomeCard {
  let decoded = input;
  if (typeof input === 'string') {
    if (input.length > 12_000) return invalid('Карточка слишком большая.');
    try { decoded = JSON.parse(input); } catch { return invalid('Не удалось прочитать карточку.'); }
  }
  const item = record(decoded);
  if (item.schemaVersion !== 1) return invalid('Обновите редактор и сохраните карточку ещё раз.');
  if (typeof item.tone !== 'string' || !['violet', 'sky', 'mint', 'peach', 'rose'].includes(item.tone)) return invalid('Выберите цвет карточки.');
  if (typeof item.layout !== 'string' || !['popout', 'cover', 'compact'].includes(item.layout)) return invalid('Выберите вид карточки.');
  if (typeof item.audience !== 'string' || !['all', 'free', 'premium'].includes(item.audience)) return invalid('Выберите, кому показывать карточку.');
  if (!Number.isInteger(item.order) || Number(item.order) < 0 || Number(item.order) > 9999) return invalid('Порядок: целое число от 0 до 9999.');
  const actionValue = record(item.action);
  let action: HomeCardAction;
  if (actionValue.kind === 'internal' && HOME_CARD_INTERNAL_TARGETS.includes(actionValue.target as HomeCardInternalTarget)) {
    action = { kind: 'internal', target: actionValue.target as HomeCardInternalTarget };
  } else if (actionValue.kind === 'external') {
    action = { kind: 'external', url: safeHomeCardUrl(actionValue.url) };
  } else return invalid('Выберите раздел приложения или HTTPS-ссылку.');
  const imageUrl = item.imageUrl === undefined || item.imageUrl === '' ? undefined : safeHomeCardUrl(item.imageUrl, true);
  if (!imageUrl && item.layout !== 'compact') return invalid('Добавьте картинку или выберите компактный вид.');
  const startsAt = date(item.startsAt, 'Начало показа');
  const endsAt = date(item.endsAt, 'Конец показа');
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) return invalid('Конец показа должен быть позже начала.');
  const badge = item.badge ? text(item.badge, 'Метка', 24) : undefined;
  return {
    schemaVersion: 1, title: text(item.title, 'Заголовок', 80), caption: text(item.caption, 'Подпись', 220, false),
    ...(imageUrl ? { imageUrl } : {}), tone: item.tone as HomeCard['tone'], layout: item.layout as HomeCard['layout'], action,
    order: item.order as number, audience: item.audience as HomeCard['audience'], startsAt, endsAt, ...(badge ? { badge } : {}),
  };
}

export function selectPublishedHomeCards(
  rows: Array<{ id: number; body: string }>, isPremium: boolean, now = Date.now(), entitlementEndsAt?: string | null,
): HomeCardsResponse {
  const cards: PublishedHomeCard[] = [];
  const changes: number[] = [];
  if (isPremium && entitlementEndsAt && Date.parse(entitlementEndsAt) > now) changes.push(Date.parse(entitlementEndsAt));
  for (const row of rows) {
    let card: HomeCard;
    try { card = parseHomeCard(row.body); } catch { continue; }
    if (card.audience !== 'all' && card.audience !== (isPremium ? 'premium' : 'free')) continue;
    const start = card.startsAt ? Date.parse(card.startsAt) : -Infinity;
    const end = card.endsAt ? Date.parse(card.endsAt) : Infinity;
    if (end <= now) continue;
    if (Number.isFinite(start) && start > now) changes.push(start);
    if (Number.isFinite(end)) changes.push(end);
    if (start <= now && Number.isSafeInteger(row.id) && row.id > 0) cards.push({ ...card, id: row.id });
  }
  cards.sort((a, b) => a.order - b.order || a.id - b.id);
  return { cards: cards.slice(0, 30), nextChangeAt: changes.length ? new Date(Math.min(...changes)).toISOString() : null };
}
