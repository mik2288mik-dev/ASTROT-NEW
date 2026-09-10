import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { consumeAuthRateLimit } from '../../../lib/auth/authRateLimit';
import { getPool } from '../../../lib/db';
import {
  CURRENT_LEGAL_DOCUMENT_VERSIONS,
  getLegalDocumentStatusesForUser,
  isLegalAcknowledgementBodyTooLarge,
  LegalAcknowledgementInputError,
  parseLegalAcknowledgementDelete,
  parseLegalAcknowledgementPost,
  type LegalAcknowledgementMutation,
} from '../../../lib/legalAcknowledgement';

const LEGAL_ACKNOWLEDGEMENT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const LEGAL_ACKNOWLEDGEMENT_RATE_LIMIT_MAX_ATTEMPTS = 9;

export const config = {
  api: {
    bodyParser: { sizeLimit: '8kb' },
  },
};

function errorPayload(error: unknown): { status: number; error: string; message: string } {
  if (error instanceof LegalAcknowledgementInputError) {
    return { status: error.status, error: error.code, message: error.message };
  }
  const candidate = error as { status?: unknown; code?: unknown; message?: unknown };
  const status = typeof candidate?.status === 'number' ? candidate.status : 500;
  return {
    status,
    error: status < 500 && typeof candidate?.code === 'string'
      ? candidate.code
      : 'LEGAL_ACKNOWLEDGEMENT_FAILED',
    message: status >= 500
      ? 'Failed to process legal acknowledgement'
      : (typeof candidate?.message === 'string' ? candidate.message : 'Request failed'),
  };
}

async function appendAcknowledgement(
  userId: string,
  mutation: LegalAcknowledgementMutation,
) {
  const documentVersion = CURRENT_LEGAL_DOCUMENT_VERSIONS[mutation.documentType];
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const user = await client.query(
      'SELECT id FROM users WHERE id = $1 FOR UPDATE',
      [userId],
    );
    if (!user.rows[0]) throw new Error('LEGAL_ACKNOWLEDGEMENT_USER_NOT_FOUND');

    const latest = await client.query(
      `SELECT document_version AS "documentVersion", action, created_at AS "createdAt"
         FROM user_legal_acknowledgements
        WHERE user_id = $1 AND document_type = $2
        ORDER BY created_at DESC, id DESC
        LIMIT 1`,
      [userId, mutation.documentType],
    );
    const latestRow = latest.rows[0];
    if (
      latestRow?.documentVersion === documentVersion
      && latestRow?.action === mutation.action
    ) {
      await client.query('COMMIT');
      const createdAt = latestRow.createdAt;
      return {
        created: false,
        acknowledgement: {
          documentType: mutation.documentType,
          documentVersion,
          action: mutation.action,
          createdAt: createdAt instanceof Date ? createdAt.toISOString() : (createdAt || null),
        },
      };
    }

    const result = await client.query(
      `INSERT INTO user_legal_acknowledgements (
         user_id,
         document_type,
         document_version,
         action,
         source,
         language,
         app_version_name,
         app_version_code,
         distribution_channel
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING created_at AS "createdAt"`,
      [
        userId,
        mutation.documentType,
        documentVersion,
        mutation.action,
        mutation.source,
        mutation.language,
        mutation.appVersionName,
        mutation.appVersionCode,
        mutation.distributionChannel,
      ],
    );
    await client.query('COMMIT');

    const createdAt = result.rows[0]?.createdAt;
    return {
      created: true,
      acknowledgement: {
        documentType: mutation.documentType,
        documentVersion,
        action: mutation.action,
        createdAt: createdAt instanceof Date ? createdAt.toISOString() : (createdAt || null),
      },
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Authorization, Cookie');

  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({
      error: 'METHOD_NOT_ALLOWED',
      message: 'Method not allowed',
    });
  }

  if (req.method !== 'GET' && isLegalAcknowledgementBodyTooLarge(req.body)) {
    return res.status(413).json({
      error: 'LEGAL_ACKNOWLEDGEMENT_TOO_LARGE',
      message: 'Request body is too large',
    });
  }

  try {
    const auth = await requireAppUser(req, { allowGuest: true });

    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        requiredVersions: CURRENT_LEGAL_DOCUMENT_VERSIONS,
        documents: await getLegalDocumentStatusesForUser(auth.userId),
      });
    }

    const mutation = req.method === 'POST'
      ? parseLegalAcknowledgementPost(req.body)
      : parseLegalAcknowledgementDelete(req.body);
    await consumeAuthRateLimit({
      scope: 'legal_acknowledgement_user',
      key: auth.userId,
      maxAttempts: LEGAL_ACKNOWLEDGEMENT_RATE_LIMIT_MAX_ATTEMPTS,
      windowMs: LEGAL_ACKNOWLEDGEMENT_RATE_LIMIT_WINDOW_MS,
    });
    const result = await appendAcknowledgement(auth.userId, mutation);

    return result.created
      ? res.status(201).json({ success: true, acknowledgement: result.acknowledgement })
      : res.status(200).json({
        success: true,
        acknowledgement: result.acknowledgement,
        alreadyRecorded: true,
      });
  } catch (error) {
    const payload = errorPayload(error);
    return res.status(payload.status).json({
      error: payload.error,
      message: payload.message,
    });
  }
}
