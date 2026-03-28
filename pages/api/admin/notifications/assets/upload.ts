import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs/promises';
import { requireAdminAccess, handleAdminError } from '../../../../../lib/adminAuth';
import { db } from '../../../../../lib/db';
import { serializeNotificationAsset } from '../../../../../lib/adminSerializers';
import { saveNotificationAssetFile, validateNotificationImage } from '../../../../../services/notificationAssetService';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    const access = await requireAdminAccess(req);

    const form = formidable({ maxFiles: 1, maxFileSize: 5 * 1024 * 1024 });
    const [, files] = await form.parse(req);
    const fileList = files.file || files.image || files.upload;
    const file = Array.isArray(fileList) ? fileList[0] : fileList;
    if (!file) {
      return res.status(400).json({ error: 'FILE_REQUIRED', message: 'No file uploaded' });
    }

    const buffer = await fs.readFile(file.filepath);
    const check = validateNotificationImage({
      buffer,
      originalFilename: file.originalFilename || 'image',
      mimetype: file.mimetype || 'application/octet-stream',
    });
    if (!check.ok) {
      return res.status(400).json({ error: check.error, message: 'Invalid image file' });
    }

    const saved = await saveNotificationAssetFile({
      buffer,
      originalFilename: file.originalFilename || 'image',
      mimetype: file.mimetype || 'image/jpeg',
    });

    try {
      await fs.unlink(file.filepath);
    } catch {
      /* ignore */
    }

    const row = await db.notification_assets.create({
      fileName: saved.fileName,
      storagePath: saved.storagePath,
      publicUrl: saved.publicUrl,
      mimeType: file.mimetype || 'image/jpeg',
      fileSize: buffer.length,
      uploadedBy: access.requesterId,
    });

    return res.status(201).json({ asset: serializeNotificationAsset({ ...row, ref_count: 0 }) });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
