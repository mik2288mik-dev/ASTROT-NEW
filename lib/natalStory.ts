import type {
  NatalStoryCard,
  NatalStoryCardId,
  NatalStoryCta,
  ProfileCard,
} from '../types';

export const NATAL_STORY_CARD_IDS = [
  'first_impression',
  'inner_base',
  'strengths',
  'overload',
  'relationships',
  'today_bridge',
] as const satisfies readonly NatalStoryCardId[];

const CARD_ALIASES: Record<string, NatalStoryCardId> = {
  card1: 'first_impression',
  card1_first_impression: 'first_impression',
  first: 'first_impression',
  first_impression: 'first_impression',
  impression: 'first_impression',
  card2: 'inner_base',
  card2_inner_base: 'inner_base',
  base: 'inner_base',
  inner_base: 'inner_base',
  card3: 'strengths',
  card3_strengths: 'strengths',
  card3_communication: 'strengths',
  communication: 'strengths',
  strength: 'strengths',
  strengths: 'strengths',
  card4: 'overload',
  card4_overload: 'overload',
  card4_stress: 'overload',
  card4_relationships: 'overload',
  overload: 'overload',
  stress: 'overload',
  card5: 'relationships',
  card5_relationships: 'relationships',
  card5_blockers: 'relationships',
  blockers: 'relationships',
  relationship: 'relationships',
  relationships: 'relationships',
  people: 'relationships',
  card6: 'today_bridge',
  card6_today_bridge: 'today_bridge',
  card6_strengths: 'today_bridge',
  today: 'today_bridge',
  today_bridge: 'today_bridge',
};

const SAVED_STORAGE_KEY = 'saved_natal_story_cards';
const LAST_CARD_STORAGE_KEY = 'last_natal_story_card';
const LAST_EXPANDED_CARD_STORAGE_KEY = 'last_natal_story_expanded_card';
const STORY_COMPLETED_STORAGE_KEY = 'natal_story_completed';

type StoryStorageState = {
  savedCardIds: NatalStoryCardId[];
  lastCardId: NatalStoryCardId | null;
  lastExpandedCardId: NatalStoryCardId | null;
  storyCompleted: boolean;
};

const VISUAL_KEY_MAP: Record<string, NatalStoryCard['illustrationKey']> = {
  hero_halo_portrait: 'hero_halo_portrait',
  hero_core_rings: 'hero_core_rings',
  hero_strength_spark: 'hero_strength_spark',
  hero_noise_fade: 'hero_noise_fade',
  hero_dual_orbit: 'hero_dual_orbit',
  hero_path_focus: 'hero_path_focus',
};

const PROFILE_ACTION_TO_CTA: Record<string, NatalStoryCta> = {
  read_deeper: 'read_deeper',
  open_today: 'open_today',
  open_checkin: 'open_checkin',
  scroll_full_report: 'scroll_full_report',
  save_card: 'save_card',
};

const PAID_KEY_BY_CARD: Partial<Record<NatalStoryCardId, NatalStoryCard['paidSectionKey']>> = {};

export function isNatalStoryCardId(value: unknown): value is NatalStoryCardId {
  return typeof value === 'string' && NATAL_STORY_CARD_IDS.includes(value as NatalStoryCardId);
}

export function resolveNatalStoryCardId(value: unknown): NatalStoryCardId | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  if (!normalized) return null;
  return CARD_ALIASES[normalized] || (isNatalStoryCardId(normalized) ? normalized : null);
}

function joinTextWithBullets(text: string, bullets?: string[]): string {
  const cleanBullets = (bullets || []).map((item) => String(item || '').trim()).filter(Boolean);
  if (!cleanBullets.length) return text;
  return `${text}\n\n${cleanBullets.map((item) => `- ${item}`).join('\n')}`;
}

export function adaptProfileCardsToStoryCards(profileCards: ProfileCard[]): NatalStoryCard[] {
  return profileCards
    .map((profileCard, fallbackIndex) => {
      const id = resolveNatalStoryCardId(profileCard.id);
      if (!id) return null;

      const action = profileCard.primaryCta?.action || 'read_deeper';
      const ctaType = PROFILE_ACTION_TO_CTA[action] || 'read_deeper';
      const freeText = joinTextWithBullets(profileCard.freeText, profileCard.freeBullets);
      const premiumText = profileCard.premiumText
        ? joinTextWithBullets(profileCard.premiumText, profileCard.premiumBullets)
        : undefined;

      const adapted: NatalStoryCard = {
        ...profileCard,
        id,
        order: profileCard.order || fallbackIndex + 1,
        index: Math.max(0, (profileCard.order || fallbackIndex + 1) - 1),
        eyebrow: profileCard.subtitle || 'О тебе',
        chipHints: {},
        summaryShort: profileCard.shortText,
        shortText: profileCard.shortText,
        bodyFree: freeText,
        freeText,
        bodyPremium: premiumText,
        premiumText,
        tease: profileCard.teaser || 'В полном разборе: больше примеров и объяснение по карте.',
        previewBullet: profileCard.freeBullets?.[0] || profileCard.teaser,
        ctaPrimary: {
          type: ctaType,
          label: profileCard.primaryCta?.label || (ctaType === 'read_deeper' ? 'Разобрать дальше' : 'Открыть'),
        },
        ctaSecondary: profileCard.secondaryCta
          ? {
              type: PROFILE_ACTION_TO_CTA[profileCard.secondaryCta.action] || 'save_card',
              label: profileCard.secondaryCta.label,
            }
          : { type: 'save_card', label: 'Сохранить' },
        illustrationKey: VISUAL_KEY_MAP[String(profileCard.visualKey || '')] || 'hero_halo_portrait',
        confidence: profileCard.confidence || 'medium',
        sourceKeys: profileCard.sourceKeys || [],
        paidSectionKey: PAID_KEY_BY_CARD[id],
      };
      return adapted;
    })
    .filter((item): item is NatalStoryCard => !!item)
    .sort((a, b) => a.order - b.order);
}

function readJsonArray(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function readString(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalState(state: StoryStorageState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(state.savedCardIds));
    if (state.lastCardId) window.localStorage.setItem(LAST_CARD_STORAGE_KEY, state.lastCardId);
    if (state.lastExpandedCardId) {
      window.localStorage.setItem(LAST_EXPANDED_CARD_STORAGE_KEY, state.lastExpandedCardId);
    } else {
      window.localStorage.removeItem?.(LAST_EXPANDED_CARD_STORAGE_KEY);
    }
    window.localStorage.setItem(STORY_COMPLETED_STORAGE_KEY, state.storyCompleted ? '1' : '0');
  } catch {
    /* localStorage can be unavailable in private or embedded modes */
  }
}

export function getSavedNatalStoryState(): StoryStorageState {
  const savedCardIds = readJsonArray(SAVED_STORAGE_KEY)
    .map(resolveNatalStoryCardId)
    .filter((id): id is NatalStoryCardId => !!id);
  const lastCardId = resolveNatalStoryCardId(readString(LAST_CARD_STORAGE_KEY));
  const lastExpandedCardId = resolveNatalStoryCardId(readString(LAST_EXPANDED_CARD_STORAGE_KEY));
  const storyCompleted = readString(STORY_COMPLETED_STORAGE_KEY) === '1';
  return {
    savedCardIds: Array.from(new Set(savedCardIds)),
    lastCardId,
    lastExpandedCardId,
    storyCompleted,
  };
}

function getCloudStorage() {
  if (typeof window === 'undefined') return null;
  return (window as any).Telegram?.WebApp?.CloudStorage || null;
}

function cloudGetItem(key: string): Promise<string | null> {
  const storage = getCloudStorage();
  if (!storage?.getItem) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      storage.getItem(key, (error: unknown, value: unknown) => {
        resolve(error ? null : typeof value === 'string' ? value : null);
      });
    } catch {
      resolve(null);
    }
  });
}

function cloudSetItem(key: string, value: string): Promise<boolean> {
  const storage = getCloudStorage();
  if (!storage?.setItem) return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      storage.setItem(key, value, (error: unknown) => resolve(!error));
    } catch {
      resolve(false);
    }
  });
}

export async function syncNatalStoryStateToCloud(state: StoryStorageState = getSavedNatalStoryState()): Promise<boolean> {
  const results = await Promise.all([
    cloudSetItem(SAVED_STORAGE_KEY, JSON.stringify(state.savedCardIds)),
    cloudSetItem(LAST_CARD_STORAGE_KEY, state.lastCardId || ''),
    cloudSetItem(LAST_EXPANDED_CARD_STORAGE_KEY, state.lastExpandedCardId || ''),
    cloudSetItem(STORY_COMPLETED_STORAGE_KEY, state.storyCompleted ? '1' : '0'),
  ]);
  return results.some(Boolean);
}

export async function syncNatalStoryStateFromCloud(): Promise<StoryStorageState> {
  const local = getSavedNatalStoryState();
  const [savedRaw, lastRaw, expandedRaw, completedRaw] = await Promise.all([
    cloudGetItem(SAVED_STORAGE_KEY),
    cloudGetItem(LAST_CARD_STORAGE_KEY),
    cloudGetItem(LAST_EXPANDED_CARD_STORAGE_KEY),
    cloudGetItem(STORY_COMPLETED_STORAGE_KEY),
  ]);

  const cloudSaved = (() => {
    try {
      const parsed = savedRaw ? JSON.parse(savedRaw) : [];
      return Array.isArray(parsed)
        ? parsed.map(resolveNatalStoryCardId).filter((id): id is NatalStoryCardId => !!id)
        : [];
    } catch {
      return [];
    }
  })();

  const merged: StoryStorageState = {
    savedCardIds: Array.from(new Set([...local.savedCardIds, ...cloudSaved])),
    lastCardId: resolveNatalStoryCardId(lastRaw) || local.lastCardId,
    lastExpandedCardId: resolveNatalStoryCardId(expandedRaw) || local.lastExpandedCardId,
    storyCompleted: local.storyCompleted || completedRaw === '1',
  };
  writeLocalState(merged);
  return merged;
}

export function saveNatalStoryCard(cardId: NatalStoryCardId): StoryStorageState {
  const current = getSavedNatalStoryState();
  const savedCardIds = Array.from(new Set([...current.savedCardIds, cardId]));
  const next = { ...current, savedCardIds, lastCardId: cardId };
  writeLocalState(next);
  void syncNatalStoryStateToCloud(next);
  return next;
}

export function setLastNatalStoryCard(cardId: NatalStoryCardId): StoryStorageState {
  const current = getSavedNatalStoryState();
  const next = { ...current, lastCardId: cardId };
  writeLocalState(next);
  void syncNatalStoryStateToCloud(next);
  return next;
}

export function setNatalStoryExpandedCard(cardId: NatalStoryCardId | null): StoryStorageState {
  const current = getSavedNatalStoryState();
  const next = { ...current, lastExpandedCardId: cardId };
  writeLocalState(next);
  void syncNatalStoryStateToCloud(next);
  return next;
}

export function markNatalStoryCompleted(): StoryStorageState {
  const current = getSavedNatalStoryState();
  const next = { ...current, storyCompleted: true };
  writeLocalState(next);
  void syncNatalStoryStateToCloud(next);
  return next;
}
