import { timingSafeEqual } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getNeboOwnerChannelConfig, sendNeboOpsTextWithConfig } from '../../../lib/neboOps';

type Channel = 'payments' | 'support';
type Update = { message?: { text?: string; from?: { id?: number }; chat?: { id?: number } } };

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function menuText(channel: Channel): string {
  return channel === 'payments'
    ? [
      '💳 NEBO · Оплаты',
      '',
      'Сюда приходят только оплаты, пробные периоды и изменения подписки.',
      'Входы, регистрации, paywall и отчёты — в боте событий.',
    ].join('\n')
    : [
      '✉️ NEBO · Поддержка',
      '',
      'Сюда приходят только новые обращения из приложения.',
      'Оплаты, входы, регистрации и отчёты — в других выделенных ботах.',
    ].join('\n');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  const channel = req.query.channel === 'payments' || req.query.channel === 'support'
    ? req.query.channel
    : null;
  const secret = String(process.env.NEBO_OPS_WEBHOOK_SECRET || '');
  const supplied = String(req.headers['x-telegram-bot-api-secret-token'] || '');
  const config = channel ? getNeboOwnerChannelConfig(channel) : null;
  if (!channel || !config || secret.length < 32 || !safeEqual(secret, supplied)) {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }

  const message = (req.body || {}) as Update;
  const fromId = String(message.message?.from?.id ?? '');
  const chatId = String(message.message?.chat?.id ?? '');
  if (fromId !== config.chatId || chatId !== config.chatId) return res.status(200).json({ ok: true });

  const command = String(message.message?.text || '').trim().split(/\s+/)[0].toLowerCase().replace(/@[^\s]+$/, '');
  if (command === '/menu' || command === '/start' || command === '') {
    await sendNeboOpsTextWithConfig(config, menuText(channel));
  }
  return res.status(200).json({ ok: true });
}
