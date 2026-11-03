import { apiFetch } from './apiClient';

export type Friend = {
  id: string;
  name: string;
  birthDate: string | null;
  unread: number;
  lastMessage: { body: string; mine: boolean; at: string } | null;
  notifyMessages: boolean;
};

export type FriendMessage = { id: number; mine: boolean; body: string; kind: 'text' | 'card'; payload: { title?: string; kicker?: string } | null; at: string };

export type FriendsState = { code: string; friends: Friend[] };

const FRIEND_ERRORS: Record<string, string> = {
  CODE_NOT_FOUND: 'Такого кода нет. Проверь буквы и цифры.',
  SELF_CODE: 'Это твой собственный код. Нужен код друга.',
  NOT_FRIENDS: 'Этот человек больше не в твоём списке.',
  TOO_MANY_MESSAGES: 'Слишком много сообщений подряд. Подожди минуту.',
  EMPTY_MESSAGE: 'Напиши что-нибудь.',
};

export function friendErrorText(code: string): string {
  return FRIEND_ERRORS[code] || 'Не получилось. Проверь интернет и попробуй ещё раз.';
}

async function call(path: string, init: RequestInit): Promise<any> {
  const response = await apiFetch(path, init, 15_000);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(body?.error || 'FRIENDS_UNAVAILABLE'));
  return body;
}

const json = (method: string, data: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

export const loadFriends = (): Promise<FriendsState> => call('/api/friends', { method: 'GET' });
export const addFriend = (code: string): Promise<FriendsState> => call('/api/friends', json('POST', { code }));
export const deleteFriend = (friendId: string): Promise<FriendsState> => call('/api/friends', json('DELETE', { friendId }));
export const loadMessages = (friendId: string, after = 0): Promise<{ messages: FriendMessage[] }> =>
  call(`/api/friends/messages?friendId=${encodeURIComponent(friendId)}&after=${after}`, { method: 'GET' });
export const postMessage = (friendId: string, body: string, card?: { kicker: string; title: string }): Promise<{ message: FriendMessage }> =>
  call('/api/friends/messages', json('POST', card ? { friendId, body, kind: 'card', payload: card } : { friendId, body }));
export const setNotifyMessages = (friendId: string, notifyMessages: boolean): Promise<{ ok: true }> =>
  call('/api/friends/messages', json('PATCH', { friendId, notifyMessages }));

const PENDING_KEY = 'nebo.friend.pending.v1';

/** An invite link (?friend=NEBO-XXXX) is kept until the person is in the app, then the friend is added. */
export function rememberInviteFromUrl(): void {
  try {
    const code = new URLSearchParams(window.location.search).get('friend');
    if (code && /^NEBO-[A-Z0-9]{4}$/i.test(code)) window.localStorage.setItem(PENDING_KEY, code.toUpperCase());
  } catch { /* storage may be unavailable */ }
}

export function takePendingInvite(): string | null {
  try {
    const code = window.localStorage.getItem(PENDING_KEY);
    if (code) window.localStorage.removeItem(PENDING_KEY);
    return code;
  } catch {
    return null;
  }
}

export function inviteLink(code: string): string {
  return `https://api.tvoi-goroskop.ru/?friend=${encodeURIComponent(code)}`;
}
