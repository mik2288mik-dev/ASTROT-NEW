/** UI preferences only. Never use this state to grant Premium or chart access. */
export const DESIGN_SCHEMA_VERSION = 1 as const;
export const DESIGN_VALUES = ['classic', 'nebo-v2'] as const;
export const THEME_VALUES = ['system', 'light', 'dark'] as const;
export const SURFACE_POSITIONS = ['collapsed', 'middle', 'expanded'] as const;
export const SURFACE_IDS = ['dashboard', 'chart'] as const;
export const READING_CATEGORIES = ['main', 'character', 'love', 'communication', 'work', 'money'] as const;
export type DesignVariant = typeof DESIGN_VALUES[number];
export type DesignTheme = typeof THEME_VALUES[number];
export type SurfacePosition = typeof SURFACE_POSITIONS[number];
export type SurfaceId = typeof SURFACE_IDS[number];
export type ReadingCategory = typeof READING_CATEGORIES[number];
export type SurfaceState = { position: SurfacePosition; scrollTop: number };
export type ReadingPosition = { entityKey: string; category: ReadingCategory; contentVersion: string; blockIndex: number; blockOffset: number };
export type DesignPreference = { schemaVersion: 1; design: DesignVariant; theme: DesignTheme; surfaces: Record<SurfaceId, SurfaceState>; readings: ReadingPosition[]; revision: number };
export type DesignPatch = { expectedRevision: number; design?: DesignVariant; theme?: DesignTheme; surface?: { id: SurfaceId } & SurfaceState; reading?: ReadingPosition };
export function defaultDesignPreference(): DesignPreference {
  return { schemaVersion: 1, design: 'classic', theme: 'system', surfaces: { dashboard: { position: 'collapsed', scrollTop: 0 }, chart: { position: 'collapsed', scrollTop: 0 } }, readings: [], revision: 0 };
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const member = <T extends string>(v: unknown, list: readonly T[]): v is T => typeof v === 'string' && list.includes(v as T);
const integer = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const key = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && /^[a-zA-Z0-9_:.-]+$/.test(v);
export function isReadingPosition(v: unknown): v is ReadingPosition {
  return object(v) && Object.keys(v).every(k => ['entityKey', 'category', 'contentVersion', 'blockIndex', 'blockOffset'].includes(k)) && key(v.entityKey, 96) && member(v.category, READING_CATEGORIES) && key(v.contentVersion, 96) && integer(v.blockIndex, 0, 2000) && integer(v.blockOffset, 0, 100000);
}
export function parseDesignPatch(value: unknown): DesignPatch {
  if (!object(value) || !Object.keys(value).every(k => ['expectedRevision', 'design', 'theme', 'surface', 'reading'].includes(k)) || !integer(value.expectedRevision, 0, 2147483646)) throw new Error('INVALID_DESIGN_PATCH');
  if ('design' in value && !member(value.design, DESIGN_VALUES)) throw new Error('INVALID_DESIGN_PATCH');
  if ('theme' in value && !member(value.theme, THEME_VALUES)) throw new Error('INVALID_DESIGN_PATCH');
  if ('surface' in value) {
    const s = value.surface;
    if (!object(s) || !Object.keys(s).every(k => ['id', 'position', 'scrollTop'].includes(k)) || !member(s.id, SURFACE_IDS) || !member(s.position, SURFACE_POSITIONS) || !integer(s.scrollTop, 0, 1000000)) throw new Error('INVALID_DESIGN_PATCH');
  }
  if ('reading' in value && !isReadingPosition(value.reading)) throw new Error('INVALID_DESIGN_PATCH');
  if (!['design', 'theme', 'surface', 'reading'].some(k => k in value)) throw new Error('EMPTY_DESIGN_PATCH');
  return value as DesignPatch;
}
export function sanitizeDesignPreference(value: unknown): DesignPreference {
  const out = defaultDesignPreference();
  if (!object(value) || value.schemaVersion !== 1) return out;
  if (member(value.design, DESIGN_VALUES)) out.design = value.design;
  if (member(value.theme, THEME_VALUES)) out.theme = value.theme;
  if (integer(value.revision, 0, 2147483646)) out.revision = value.revision;
  for (const id of SURFACE_IDS) {
    const s = object(value.surfaces) ? value.surfaces[id] : null;
    if (object(s) && member(s.position, SURFACE_POSITIONS) && integer(s.scrollTop, 0, 1000000)) out.surfaces[id] = { position: s.position, scrollTop: s.scrollTop };
  }
  if (Array.isArray(value.readings)) out.readings = value.readings.filter(isReadingPosition).slice(-30);
  return out;
}
export function mergeDesignPatch(current: DesignPreference, patch: DesignPatch): DesignPreference {
  const next = sanitizeDesignPreference(current);
  if (patch.design) next.design = patch.design;
  if (patch.theme) next.theme = patch.theme;
  if (patch.surface) next.surfaces[patch.surface.id] = { position: patch.surface.position, scrollTop: patch.surface.scrollTop };
  if (patch.reading) next.readings = [...next.readings.filter(r => r.entityKey !== patch.reading!.entityKey), patch.reading].slice(-30);
  next.revision += 1;
  return next;
}
export function resolveAdminPreviewAccess(row: { is_admin?: boolean; is_blocked?: boolean; role?: string | null; status?: string | null; owner_identity?: boolean } | null, isOwner: boolean, killed = false): boolean {
  if (!row || row.is_blocked === true || killed) return false;
  if (isOwner || row.owner_identity === true) return true;
  if (row.role) return row.status === 'active';
  return row.is_admin === true;
}
export function readingContentVersion(parts: readonly string[]): string {
  let h = 2166136261;
  for (const char of parts.join('\u001f')) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); }
  return `reading-v1-${(h >>> 0).toString(36)}`;
}
