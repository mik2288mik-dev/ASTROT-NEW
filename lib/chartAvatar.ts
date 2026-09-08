export type ChartAvatarChoice = { kind: 'cat'; id: number } | { kind: 'photo'; dataUrl: string } | { kind: 'telegram' };
export const CAT_AVATAR_COUNT = 10;
export function catAvatarSource(id: number) { return `/assets/nebo-refined/cat-avatars-v1/cat-${String(id).padStart(2, '0')}.png`; }
export function defaultCatAvatar(seed: string) {
  let hash = 0; for (const char of seed) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % CAT_AVATAR_COUNT + 1;
}
export function isAvatarSubjectKey(value: unknown): value is string {
  return typeof value === 'string' && (value === 'self' || /^chart:[1-9]\d{0,14}$/.test(value));
}
export function parseChartAvatarChoice(value: unknown): ChartAvatarChoice | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.kind === 'telegram') return { kind: 'telegram' };
  if (v.kind === 'cat' && Number.isInteger(v.id) && Number(v.id) >= 1 && Number(v.id) <= CAT_AVATAR_COUNT) return { kind: 'cat', id: Number(v.id) };
  if (v.kind === 'photo' && typeof v.dataUrl === 'string' && v.dataUrl.length <= 210000 && /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/=]+$/.test(v.dataUrl)) return { kind: 'photo', dataUrl: v.dataUrl };
  return null;
}
