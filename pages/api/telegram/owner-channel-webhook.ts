import { timingSafeEqual } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getNeboOwnerChannelConfig, sendNeboOpsTextWithConfig, type NeboOwnerChannel } from '../../../lib/neboOps';
import {
  buildErrorsSummary,
  buildHealthSummary,
  buildPaymentsReport,
  buildSupportList,
  neboChannelMenu,
} from '../../../lib/neboOwnerChannels';
import type { NeboReportKind } from '../../../lib/neboOpsStats';
import { telegramApiRequest } from '../../../lib/telegramRelay';
import { acknowledgeAndRun, forwardNeboOpsRequest, isRepeatedTelegramUpdate } from '../../../lib/neboOpsWebhook';

type Update = {
  update_id?: number;
  message?: { text?: string; from?: { id?: number }; chat?: { id?: number } };
  callback_query?: { id?: string; data?: string; from?: { id?: number }; message?: { chat?: { id?: number } } };
};

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function reply(channel: NeboOwnerChannel, data: string): Promise<string | null> {
  if (channel === 'payments') {
    const match = /^ch:pay:(today|yesterday|week|month)$/.exec(data);
    return match ? buildPaymentsReport(match[1] as NeboReportKind) : null;
  }
  if (channel === 'support') {
    if (data === 'ch:sup:open') return buildSupportList(true);
    if (data === 'ch:sup:latest') return buildSupportList(false);
    // The support bot also hosts error reports while no dedicated errors bot exists.
  }
  if (data === 'ch:err:day') return buildErrorsSummary(1);
  if (data === 'ch:err:week') return buildErrorsSummary(7);
  if (data === 'ch:err:health') return buildHealthSummary();
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  if (await forwardNeboOpsRequest(req, res)) return;
  const channel = req.query.channel === 'payments' || req.query.channel === 'support' || req.query.channel === 'errors'
    ? req.query.channel
    : null;
  const secret = String(process.env.NEBO_OPS_WEBHOOK_SECRET || '');
  const supplied = String(req.headers['x-telegram-bot-api-secret-token'] || '');
  const config = channel ? getNeboOwnerChannelConfig(channel) : null;
  if (!channel || !config || secret.length < 32 || !safeEqual(secret, supplied)) {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }

  const update = (req.body || {}) as Update;
  const callback = update.callback_query;
  const fromId = String(callback?.from?.id ?? update.message?.from?.id ?? '');
  const chatId = String(callback?.message?.chat?.id ?? update.message?.chat?.id ?? '');
  if (fromId !== config.chatId || chatId !== config.chatId) return res.status(200).json({ ok: true });
  if (isRepeatedTelegramUpdate(channel, update.update_id)) return res.status(200).json({ ok: true });

  acknowledgeAndRun(res, async () => {
    const menu = neboChannelMenu(channel);
    if (!callback?.id) {
      await sendNeboOpsTextWithConfig(config, menu.text, { replyMarkup: menu.replyMarkup });
      return;
    }
    await telegramApiRequest(config.token, 'answerCallbackQuery', { callback_query_id: callback.id, text: 'Собираю…' },
      { signal: AbortSignal.timeout(8_000) }).catch(() => undefined);
    try {
      const text = await reply(channel, String(callback.data || ''));
      await sendNeboOpsTextWithConfig(config, text || menu.text, { replyMarkup: menu.replyMarkup });
    } catch {
      await sendNeboOpsTextWithConfig(config, '⚠️ Не получилось собрать данные. Попробуй ещё раз через минуту.');
    }
  }, `${channel} command`);
}
