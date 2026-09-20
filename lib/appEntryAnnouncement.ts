export const APP_ENTRY_ANNOUNCEMENT_FLAG = 'app_entry_announcement';
export const APP_ENTRY_ANNOUNCEMENT_MAX_TITLE_LENGTH = 120;
export const APP_ENTRY_ANNOUNCEMENT_MAX_MESSAGE_LENGTH = 2_000;

export type AppEntryAnnouncement = {
  id: string;
  title: string;
  message: string;
};

type StoredAppEntryAnnouncement = {
  enabled?: unknown;
  id?: unknown;
  title?: unknown;
  message?: unknown;
};

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.length > maxLength || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text)) {
    return null;
  }
  return text;
}

/** Returns only a safe, currently publishable announcement from the setting. */
export function readAppEntryAnnouncement(value: unknown): AppEntryAnnouncement | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entry = value as StoredAppEntryAnnouncement;
  if (entry.enabled !== true) return null;
  const id = cleanText(entry.id, 80);
  const title = cleanText(entry.title, APP_ENTRY_ANNOUNCEMENT_MAX_TITLE_LENGTH);
  const message = cleanText(entry.message, APP_ENTRY_ANNOUNCEMENT_MAX_MESSAGE_LENGTH);
  if (!id || !/^[A-Za-z0-9._:-]+$/u.test(id) || !title || !message) return null;
  return { id, title, message };
}

