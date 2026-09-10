import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const CACHE_SUBDIR = 'generated';

export function getGeneratedNotificationsDir(): string {
  return path.join(process.cwd(), 'public', 'uploads', 'notifications', CACHE_SUBDIR);
}

/**
 * Stable cache file name from template + content + date (UTC day key).
 */
export function buildGeneratedCardCacheKey(input: {
  templateId: number;
  dateKey: string;
  slot: string;
  preset: string;
  contentHash: string;
}): string {
  const raw = `${input.templateId}|${input.dateKey}|${input.slot}|${input.preset}|${input.contentHash}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 48);
  return `${hash}.png`;
}

export function contentHashForGeneratedCard(input: {
  title: string;
  subtitle: string;
  accent: string;
  bodyLines: string;
  showDate: boolean;
  showSlotLabel: boolean;
  slotLabel: string;
  dateLabel: string;
  zodiacLine: string;
}): string {
  const payload = JSON.stringify(input);
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

export async function readCachedGeneratedPngIfExists(fileName: string): Promise<Buffer | null> {
  const dir = getGeneratedNotificationsDir();
  const full = path.join(dir, fileName);
  try {
    return await fs.readFile(full);
  } catch (e: any) {
    if (e?.code === 'ENOENT') return null;
    throw e;
  }
}

export async function writeGeneratedPngCache(fileName: string, buffer: Buffer): Promise<{ storagePath: string; publicUrl: string }> {
  const dir = getGeneratedNotificationsDir();
  await fs.mkdir(dir, { recursive: true });
  const full = path.join(dir, fileName);
  await fs.writeFile(full, buffer);
  const publicUrl = `/uploads/notifications/${CACHE_SUBDIR}/${fileName}`;
  return { storagePath: full, publicUrl };
}
