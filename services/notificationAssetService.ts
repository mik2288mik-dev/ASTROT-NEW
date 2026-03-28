import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export type ParsedUploadFile = {
  buffer: Buffer;
  originalFilename: string;
  mimetype: string;
};

export function validateNotificationImage(file: ParsedUploadFile): { ok: true } | { ok: false; error: string } {
  const mime = (file.mimetype || '').toLowerCase().split(';')[0].trim();
  if (!ALLOWED_MIME.has(mime)) {
    return { ok: false, error: 'INVALID_MIME' };
  }
  const ext = path.extname(file.originalFilename || '').toLowerCase();
  if (ext && !ALLOWED_EXT.has(ext)) {
    return { ok: false, error: 'INVALID_EXTENSION' };
  }
  if (file.buffer.length > MAX_BYTES) {
    return { ok: false, error: 'FILE_TOO_LARGE' };
  }
  if (file.buffer.length === 0) {
    return { ok: false, error: 'EMPTY_FILE' };
  }
  return { ok: true };
}

export function getNotificationUploadsDir(): string {
  return path.join(process.cwd(), 'public', 'uploads', 'notifications');
}

export async function saveNotificationAssetFile(file: ParsedUploadFile): Promise<{ storagePath: string; publicUrl: string; fileName: string }> {
  const validated = validateNotificationImage(file);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  const dir = getNotificationUploadsDir();
  await fs.mkdir(dir, { recursive: true });

  const ext =
    path.extname(file.originalFilename || '').toLowerCase() ||
    (file.mimetype.includes('png') ? '.png' : file.mimetype.includes('webp') ? '.webp' : '.jpg');
  const safeExt = ALLOWED_EXT.has(ext) ? ext : '.jpg';
  const idPart = crypto.randomBytes(16).toString('hex');
  const fileName = `${idPart}${safeExt}`;
  const storagePath = path.join(dir, fileName);
  await fs.writeFile(storagePath, file.buffer);

  const publicUrl = `/uploads/notifications/${fileName}`;
  return { storagePath, publicUrl, fileName };
}

export async function deleteNotificationAssetFile(storagePath: string): Promise<void> {
  const resolved = path.resolve(storagePath);
  const base = path.resolve(getNotificationUploadsDir());
  if (!resolved.startsWith(base)) {
    throw new Error('INVALID_PATH');
  }
  try {
    await fs.unlink(resolved);
  } catch (e: any) {
    if (e?.code !== 'ENOENT') throw e;
  }
}
