import type {
  ContentReactionKey,
  ContentReactionSummary,
  ContentReactionSurface,
} from '../types';
import { isValidUserId } from '../lib/userId';
import { apiFetch, getApiBaseUrl } from './apiClient';
import { getTelegramInitDataHeaders } from './sessionService';

const API_BASE_URL = getApiBaseUrl();

type ContentReactionTarget = {
  surface: ContentReactionSurface;
  contentKey: string;
  reactionKey?: ContentReactionKey;
};

function requestBody(userId: string, target: ContentReactionTarget) {
  return {
    userId,
    surface: target.surface,
    contentKey: target.contentKey,
    reactionKey: target.reactionKey || 'like',
  };
}

export async function getContentReactionSummary(
  userId: string,
  target: ContentReactionTarget,
): Promise<ContentReactionSummary | null> {
  if (!isValidUserId(userId)) return null;
  try {
    const params = new URLSearchParams(requestBody(userId, target));
    const response = await apiFetch(`${API_BASE_URL}/api/content/reactions?${params}`, {
      method: 'GET',
      credentials: 'include',
      headers: getTelegramInitDataHeaders(),
    }, 6000);
    if (!response.ok) return null;
    const payload = await response.json();
    return (payload?.summary as ContentReactionSummary) ?? null;
  } catch {
    return null;
  }
}

export async function setContentReaction(
  userId: string,
  target: ContentReactionTarget,
): Promise<ContentReactionSummary> {
  if (!isValidUserId(userId)) throw new Error('User id is required');
  const response = await apiFetch(`${API_BASE_URL}/api/content/reactions`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
    body: JSON.stringify(requestBody(userId, target)),
  }, 6000);
  if (!response.ok) throw new Error('Content reaction failed');
  const payload = await response.json();
  return payload.summary as ContentReactionSummary;
}

export async function removeContentReaction(
  userId: string,
  target: ContentReactionTarget,
): Promise<ContentReactionSummary | null> {
  if (!isValidUserId(userId)) return null;
  try {
    const response = await apiFetch(`${API_BASE_URL}/api/content/reactions`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
      body: JSON.stringify({ ...requestBody(userId, target), remove: true }),
    }, 6000);
    if (!response.ok) return null;
    const payload = await response.json();
    return (payload?.summary as ContentReactionSummary) ?? null;
  } catch {
    return null;
  }
}
