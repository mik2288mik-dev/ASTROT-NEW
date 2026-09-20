import type { AppEntryAnnouncement } from '../lib/appEntryAnnouncement';
import { apiFetch } from './apiClient';
import { getTelegramInitDataHeaders } from './sessionService';

const STORAGE_PREFIX = 'nebo:entry-announcement:v1:';

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function storageKey(id: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(id)}`;
}

export function hasSeenAppEntryAnnouncement(announcement: AppEntryAnnouncement): boolean {
  return storage()?.getItem(storageKey(announcement.id)) === 'seen';
}

export function markAppEntryAnnouncementSeen(announcement: AppEntryAnnouncement): void {
  try {
    storage()?.setItem(storageKey(announcement.id), 'seen');
  } catch {
    // Storage can be unavailable in a restricted WebView. Closing still works.
  }
}

export async function loadAppEntryAnnouncement(): Promise<AppEntryAnnouncement | null> {
  const response = await apiFetch('/api/app/entry-announcement', {
    method: 'GET',
    headers: getTelegramInitDataHeaders(),
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null) as {
    announcement?: AppEntryAnnouncement | null;
  } | null;
  const announcement = payload?.announcement;
  return announcement
    && typeof announcement.id === 'string'
    && typeof announcement.title === 'string'
    && typeof announcement.message === 'string'
    ? announcement
    : null;
}

