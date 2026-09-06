import type { NextApiRequest, NextApiResponse } from 'next';
import { getVerifiedTelegramUser, handleAdminError } from '../../../../lib/adminAuth';
import {
  appSessionResponse,
  createAppUserSession,
  setAppSessionCookie,
  type AppUserContext,
} from '../../../../lib/auth/appAuth';
import { resolveTelegramIdentityForLogin } from '../../../../lib/auth/accountIdentity';
import { toPublicAppProfile } from '../../../../lib/auth/profile';
import { db } from '../../../../lib/db';
import { readClientRuntimeMetadata, type ClientRuntimeMetadata } from '../../../../lib/clientRuntimeMetadata';
import {
  CURRENT_LEGAL_DOCUMENT_VERSIONS,
  getLegalDocumentStatusesForUser,
} from '../../../../lib/legalAcknowledgement';

async function createTelegramAppSession(input: {
  userId: string;
  kind: 'web' | 'native';
  deviceId: string | null;
  sessionVersion: 1 | 2;
  notificationContext: ClientRuntimeMetadata;
  loginProvider: 'telegram';
}) {
  try {
    return await createAppUserSession(input);
  } catch (error: any) {
    if (input.sessionVersion !== 2 || (error?.status && error.status < 500)) throw error;
    console.error('[auth.telegram.login] session v2 unavailable; using legacy session', {
      code: typeof error?.code === 'string' ? error.code : 'SESSION_V2_FAILED',
    });
    return createAppUserSession({ ...input, sessionVersion: 1 });
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  try {
    const telegramReq = Object.create(req) as NextApiRequest;
    telegramReq.headers = {
      ...req.headers,
      'x-telegram-init-data': String(req.body?.initData || ''),
    };
    const telegram = getVerifiedTelegramUser(telegramReq);
    const identity = await resolveTelegramIdentityForLogin(
      {
        provider: 'telegram',
        subject: telegram.id,
        displayName: [telegram.rawUser.first_name, telegram.rawUser.last_name].filter(Boolean).join(' ') || null,
        metadata: { username: telegram.rawUser.username || null },
      },
      telegram.id,
    );
    const kind = req.body?.native === true ? 'native' : 'web';
    const session = await createTelegramAppSession({
      userId: identity.userId,
      kind,
      notificationContext: readClientRuntimeMetadata(req.headers, kind === 'native' ? 'native' : 'telegram'),
      loginProvider: 'telegram',
      deviceId: typeof req.body?.deviceId === 'string' ? req.body.deviceId : null,
      sessionVersion: req.body?.sessionVersion === 2 ? 2 : 1,
    });
    if (kind === 'web') {
      if (session.refreshToken) setAppSessionCookie(res, session.token, session.refreshToken);
      else setAppSessionCookie(res, session.token);
    }

    const auth: AppUserContext = {
      userId: identity.userId,
      provider: 'telegram',
      isGuest: false,
      telegramUserId: telegram.id,
      sessionId: session.sessionId,
    };
    const [user, legalDocuments] = await Promise.all([
      db.users.get(identity.userId),
      getLegalDocumentStatusesForUser(identity.userId),
    ]);
    return res.status(200).json({
      ...(session.sessionVersion === 2
        ? appSessionResponse(session, kind === 'native')
        : (kind === 'native' ? { token: session.token } : {})),
      profile: {
        ...toPublicAppProfile(user, auth),
        legalAcknowledgements: {
          requiredVersions: CURRENT_LEGAL_DOCUMENT_VERSIONS,
          documents: legalDocuments,
        },
      },
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
