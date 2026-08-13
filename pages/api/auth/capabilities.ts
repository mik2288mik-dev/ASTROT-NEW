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
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  const runtime: AccountAuthRuntime = req.query.runtime === 'native' ? 'native' : 'browser';
  try {
    // Client channel is display context only; the deployment configuration is
    // the server-side authorization boundary.
    const channel = resolveDistributionChannel();
    return res.status(200).json(getAccountAuthCapabilities(runtime, channel));
  } catch (error) {
    if (error instanceof DistributionChannelError) {
      return res.status(400).json({ error: 'DISTRIBUTION_CHANNEL_INVALID' });
    }
    throw error;
  }
}
