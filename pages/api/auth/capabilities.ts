import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getEmailPasswordAuthCapabilities,
  getNativeProviderAuthCapabilities,
} from '../../../lib/auth/nativeProviderAuth';
import {
  canUseAccountAuthProvider,
  DistributionChannelError,
  resolveDistributionChannel,
  type DistributionChannel,
} from '../../../lib/distributionChannel';
import { startServerOperationalDiagnostic } from '../../../lib/serverOperationalDiagnostics';

type AccountAuthRuntime = 'native' | 'browser';

function configuredValue(name: string): string {
  const value = String(process.env[name] || '').trim();
  if (
    !value
    || /_REQUIRED/i.test(value)
    || /^your[_-]/i.test(value)
    || /^replace-with/i.test(value)
    || value.includes('[УКАЖИТЕ')
  ) return '';
  return value;
}

function browserOriginReady(): boolean {
  try {
    return new URL(configuredValue('PUBLIC_APP_ORIGIN')).protocol === 'https:';
  } catch {
    return false;
  }
}

export function getAccountAuthCapabilities(
  runtime: AccountAuthRuntime,
  channel: DistributionChannel = resolveDistributionChannel(),
) {
  const providers = runtime === 'native'
    ? getNativeProviderAuthCapabilities()
    : {
        google: browserOriginReady()
          && !!configuredValue('GOOGLE_AUTH_CLIENT_ID')
          && !!configuredValue('GOOGLE_AUTH_CLIENT_SECRET'),
        yandex: browserOriginReady()
          && !!configuredValue('YANDEX_AUTH_CLIENT_ID')
          && !!configuredValue('YANDEX_AUTH_CLIENT_SECRET'),
        vk: browserOriginReady()
          && !!configuredValue('VK_AUTH_CLIENT_ID')
          && !!configuredValue('VK_AUTH_CLIENT_SECRET'),
        email: false,
      };
  const email = getEmailPasswordAuthCapabilities();
  return {
    ...providers,
    google: canUseAccountAuthProvider('google', channel) && providers.google,
    // `email` remains a compatibility alias for clients deployed before the
    // password-login and code-delivery capabilities were split.
    email: email.delivery,
    emailPassword: email.login,
    emailDelivery: email.delivery,
  };
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const runtime: AccountAuthRuntime = req.query.runtime === 'native' ? 'native' : 'browser';
  const diagnostic = startServerOperationalDiagnostic(req, res, 'auth_capabilities', { runtime });
  if (req.method !== 'GET') {
    diagnostic.log('request', 'error', { httpStatus: 405, errorCode: 'METHOD_NOT_ALLOWED' });
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  try {
    // Client channel is display context only; the deployment configuration is
    // the server-side authorization boundary.
    const channel = resolveDistributionChannel();
    const capabilities = getAccountAuthCapabilities(runtime, channel);
    diagnostic.log('capability_check', 'ok', { httpStatus: 200, channel });
    return res.status(200).json(capabilities);
  } catch (error) {
    if (error instanceof DistributionChannelError) {
      diagnostic.error('capability_check', error, 'DISTRIBUTION_CHANNEL_INVALID', {
        httpStatus: 400,
        errorCode: 'DISTRIBUTION_CHANNEL_INVALID',
      });
      return res.status(400).json({ error: 'DISTRIBUTION_CHANNEL_INVALID' });
    }
    diagnostic.error('capability_check', error, 'AUTH_CAPABILITIES_FAILED', { httpStatus: 500 });
    throw error;
  }
}
