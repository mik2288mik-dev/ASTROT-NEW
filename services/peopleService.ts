import { Capacitor, registerPlugin } from '@capacitor/core';
import type { SynastryResult } from '../types';
import type { ChartAvatarChoice } from '../lib/chartAvatar';
import type { CompatibilityPreview } from '../lib/synastry/compatibilityPreview';
import type { PairTalkDay } from '../lib/synastry/pairTalkCalendar';
import { apiFetch } from './apiClient';
import { getTelegramInitDataHeaders } from './sessionService';

export type LinkContext = 'relationship' | 'friendship' | 'family' | 'work';

export const LINK_CONTEXT_OPTIONS: ReadonlyArray<{ value: LinkContext; label: string; hint: string }> = [
  { value: 'relationship', label: 'Пара', hint: 'Вместе, женаты, встречаетесь' },
  { value: 'friendship', label: 'Дружба', hint: 'Друг, подруга, близкий человек' },
  { value: 'family', label: 'Семья', hint: 'Мама, папа, брат, сестра' },
  { value: 'work', label: 'Работа', hint: 'Коллега, партнёр по делу' },
];

export function linkContextLabel(value: LinkContext): string {
  return LINK_CONTEXT_OPTIONS.find((option) => option.value === value)?.label || 'Дружба';
}

export type LinkedPerson = {
  linkId: string;
  name: string;
  gender: 'male' | 'female' | 'unspecified';
  avatar: ChartAvatarChoice | null;
  sunSign: string | null;
  birthday: string | null;
  hasChart: boolean;
  relationshipContext: LinkContext;
  proposedContext: LinkContext | null;
  proposedByMe: boolean;
  shareMyBirthday: boolean;
  manualChartId: string | null;
  suggestedManualChartId: string | null;
  linkedAt: string;
  createdByMe: boolean;
};

export type PeopleInvite = {
  code: string;
  displayCode: string;
  relationshipContext: LinkContext;
  createdAt: string;
  expiresAt: string;
};

export type PeopleList = { canLink: boolean; people: LinkedPerson[]; invites: PeopleInvite[]; inviteOrigin: string };

export type InvitePreview = {
  status: 'active' | 'expired' | 'used' | 'declined' | 'revoked' | 'own' | 'already_linked';
  inviterName: string;
  inviterAvatar: ChartAvatarChoice | null;
  relationshipContext: LinkContext;
  linkId: string | null;
};

export type PairReading = {
  status: 'ready' | 'locked' | 'missing_data' | 'writing_failed';
  relationshipContext: LinkContext;
  me: { name: string; sunSign: string | null };
  partner: { name: string; sunSign: string | null };
  missing: Array<'me' | 'partner'>;
  calculationLevel: string | null;
  preview: (CompatibilityPreview & { talkDays: PairTalkDay[] }) | null;
  reading: SynastryResult | null;
  premiumFrom: 'me' | 'partner' | null;
  updateNotes: string[];
  manualCardDiffers: Array<'date' | 'time' | 'place'>;
  readingKey: string | null;
};

export class PeopleRequestError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(code);
    this.name = 'PeopleRequestError';
  }
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs?: number): Promise<T> {
  const headers: Record<string, string> = { ...getTelegramInitDataHeaders() };
  if (init.body) headers['Content-Type'] = 'application/json';
  const response = await apiFetch(path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } }, timeoutMs);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new PeopleRequestError(response.status, String(payload?.code || payload?.error || 'PEOPLE_UNAVAILABLE'));
  return payload as T;
}

export function fetchPeople(): Promise<PeopleList> {
  return request<PeopleList>('/api/people');
}

export function createInvite(relationshipContext: LinkContext): Promise<{ invite: PeopleInvite; url: string }> {
  return request('/api/people/invites', { method: 'POST', body: JSON.stringify({ relationshipContext }) });
}

export async function previewInvite(code: string): Promise<InvitePreview> {
  return (await request<{ invite: InvitePreview }>(`/api/people/invites/${encodeURIComponent(code)}`)).invite;
}

export function acceptInvite(code: string, relationshipContext: LinkContext | null): Promise<{ linkId: string; created: boolean }> {
  return request(`/api/people/invites/${encodeURIComponent(code)}/accept`, {
    method: 'POST',
    body: JSON.stringify(relationshipContext ? { relationshipContext } : {}),
  });
}

export async function declineInvite(code: string): Promise<void> {
  await request(`/api/people/invites/${encodeURIComponent(code)}/decline`, { method: 'POST', body: '{}' });
}

export async function revokeInvite(code: string): Promise<void> {
  await request(`/api/people/invites/${encodeURIComponent(code)}`, { method: 'DELETE' });
}

export async function unlinkPerson(linkId: string): Promise<void> {
  await request(`/api/people/links/${encodeURIComponent(linkId)}`, { method: 'DELETE' });
}

export async function updatePerson(linkId: string, settings: { shareBirthday?: boolean; manualChartId?: string | null }): Promise<LinkedPerson> {
  return (await request<{ person: LinkedPerson }>(`/api/people/links/${encodeURIComponent(linkId)}`, {
    method: 'PATCH',
    body: JSON.stringify(settings),
  })).person;
}

export async function proposeLinkContext(linkId: string, context: LinkContext): Promise<LinkedPerson> {
  return (await request<{ person: LinkedPerson }>(`/api/people/links/${encodeURIComponent(linkId)}/context`, {
    method: 'POST',
    body: JSON.stringify({ propose: context }),
  })).person;
}

export async function answerLinkContext(linkId: string, accept: boolean): Promise<LinkedPerson> {
  return (await request<{ person: LinkedPerson }>(`/api/people/links/${encodeURIComponent(linkId)}/context`, {
    method: 'POST',
    body: JSON.stringify({ accept }),
  })).person;
}

/** Writing a new shared text can take up to a minute; reading a stored one is instant. */
export function fetchPairReading(linkId: string, generate: boolean): Promise<PairReading> {
  return request(`/api/people/links/${encodeURIComponent(linkId)}/reading`, {
    method: 'POST',
    body: JSON.stringify({ language: 'ru', generate }),
  }, generate ? 90_000 : undefined);
}

// ---------------------------------------------------------------- invite links

const INVITE_CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

export function normalizeInviteCodeInput(value: string): string | null {
  const code = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return INVITE_CODE.test(code) ? code : null;
}

/** https://…/i/CODE or nebo://invite/CODE; the code may carry a dash. */
export function inviteCodeFromUrl(url: string): string | null {
  const match = /^(?:https?:\/\/[^/?#]+\/i\/|nebo:\/\/invite\/)([A-Za-z0-9-]{8,9})(?:[/?#]|$)/i.exec(String(url || '').trim());
  return match ? normalizeInviteCodeInput(match[1]) : null;
}

const PENDING_INVITE_KEY = 'nebo.people.pendingInvite.v1';

/** Kept until the person is signed in and sees the invite, so a link opened before onboarding still works. */
export function rememberPendingInvite(code: string): void {
  try { localStorage.setItem(PENDING_INVITE_KEY, JSON.stringify({ code, at: Date.now() })); } catch { /* storage may be blocked */ }
}

export function readPendingInvite(): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(PENDING_INVITE_KEY) || 'null');
    if (!saved?.code || Date.now() - Number(saved.at) > 7 * 24 * 3600_000) return null;
    return normalizeInviteCodeInput(String(saved.code));
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try { localStorage.removeItem(PENDING_INVITE_KEY); } catch { /* ignore */ }
}

const HAS_LINKS_KEY = 'nebo.people.hasLinks.v1';

/** Remembered on this device so «Совместимость» opens straight on «Близкие» for people who use it. */
export function rememberHasLinkedPeople(value: boolean): void {
  try { localStorage.setItem(HAS_LINKS_KEY, value ? '1' : '0'); } catch { /* ignore */ }
}

export function hasLinkedPeopleHint(): boolean {
  try { return localStorage.getItem(HAS_LINKS_KEY) === '1'; } catch { return false; }
}

// ---------------------------------------------------------------- sharing

const nativeShare = registerPlugin<{ shareText(options: { text: string; title: string }): Promise<void> }>('NativeShare');

export type ShareChannel = 'system' | 'telegram' | 'whatsapp' | 'copy';

export function inviteMessage(name: string, url: string, displayCode: string): string {
  const from = name ? `${name} зовёт тебя в NEBO.` : 'Тебя зовут в NEBO.';
  return `${from} Давай свяжем наши карты: у нас будет один общий разбор совместимости на двоих.\n${url}\nЕсли приложение уже стоит, можно ввести код ${displayCode}.`;
}

function openExternal(url: string): void {
  if (Capacitor.isNativePlatform()) window.open(url, '_system', 'noopener,noreferrer');
  else window.open(url, '_blank', 'noopener,noreferrer');
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand?.('copy') === true;
    area.remove();
    return copied;
  }
}

/** Returns what actually happened, so the screen can say «скопировано» when sharing fell back to copying. */
export async function shareInvite(channel: ShareChannel, text: string, url: string): Promise<'shared' | 'copied' | 'failed'> {
  if (channel === 'telegram') {
    openExternal(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text.replace(url, '').trim())}`);
    return 'shared';
  }
  if (channel === 'whatsapp') {
    openExternal(`https://wa.me/?text=${encodeURIComponent(text)}`);
    return 'shared';
  }
  if (channel === 'system') {
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('NativeShare')) {
      try {
        await nativeShare.shareText({ text, title: 'Позвать в NEBO' });
        return 'shared';
      } catch { /* fall through to copying */ }
    } else if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ text });
        return 'shared';
      } catch (error) {
        if ((error as DOMException)?.name === 'AbortError') return 'failed';
      }
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed';
}
