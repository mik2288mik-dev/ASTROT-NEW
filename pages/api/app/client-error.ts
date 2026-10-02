import type { NextApiRequest, NextApiResponse } from 'next';
import { recordRequestFailure } from '../../../lib/requestTelemetry';

const FEATURE = /^[a-z][a-z0-9_-]{0,39}$/;
const CODE = /^[A-Za-z0-9_.:-]{1,64}$/;

/**
 * A screen reports what the reader actually saw fail. No auth: startup errors
 * happen before a session exists. Only short sanitized facts are stored, and
 * the same failure from one device is throttled in recordRequestFailure.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const feature = String(body.feature || '');
  const code = String(body.code || 'UNKNOWN');
  if (!FEATURE.test(feature) || !CODE.test(code)) return res.status(400).json({ error: 'BAD_REQUEST' });
  const status = Number(body.status);
  const detail = String(body.detail || '').replace(/[^\p{L}\p{N} ._:=/-]/gu, ' ').slice(0, 200).trim();
  recordRequestFailure(req, {
    endpoint: `client:${feature}`,
    httpStatus: Number.isInteger(status) && status >= 0 && status < 600 ? status : 0,
    errorCode: code,
    detail,
  });
  return res.status(204).end();
}
