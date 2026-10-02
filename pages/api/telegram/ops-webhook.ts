import { timingSafeEqual } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getNeboOpsConfig, neboServerLabel, sendNeboOpsText, type NeboOpsConfig } from '../../../lib/neboOps';
import { sendNeboOpsBusinessReport, type NeboReportKind } from '../../../lib/neboOpsReports';
import { telegramApiRequest } from '../../../lib/telegramRelay';
import {
  cycleNeboOpsReportSchedule,
  getNeboOpsPreferences,
  renderNeboOpsMenu,
  toggleNeboOpsPreference,
  type NeboOpsPreferenceKey,
} from '../../../lib/neboOpsSettings';
import { acknowledgeAndRun, forwardNeboOpsRequest, isRepeatedTelegramUpdate } from '../../../lib/neboOpsWebhook';

type OpsUpdate = {
  update_id?: number;
  message?: { text?: string; from?: { id?: number }; chat?: { id?: number } };
  callback_query?: { id?: string; data?: string; from?: { id?: number }; message?: { chat?: { id?: number } } };
};

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function answerCallback(token: string, callbackId: string, text: string) {
  await telegramApiRequest(token, 'answerCallbackQuery', {
    callback_query_id: callbackId,
    text: text.slice(0, 180),
  }, { signal: AbortSignal.timeout(8_000) }).catch(() => undefined);
}

async function sendMenu() {
  const menu = renderNeboOpsMenu(await getNeboOpsPreferences(), neboServerLabel());
  await sendNeboOpsText(menu.text, { replyMarkup: menu.replyMarkup });
}

async function sendReport(kind: NeboReportKind) {
  if (!(await sendNeboOpsBusinessReport(kind))) {
    await sendNeboOpsText('⚠️ Не удалось отправить отчёт. Попробуй ещё раз через минуту.');
  }
}

async function handleUpdate(update: OpsUpdate, config: NeboOpsConfig): Promise<void> {
  const callback = update.callback_query;
  if (callback?.id) {
    const data = String(callback.data || '');
    const toggleMatch = /^ops:toggle:(notify_logins|notify_payments|notify_paywalls|notify_support)$/.exec(data);
    if (toggleMatch) {
      await toggleNeboOpsPreference(toggleMatch[1] as NeboOpsPreferenceKey);
      await answerCallback(config.token, callback.id, 'Настройка сохранена');
      await sendMenu();
    } else if (data === 'ops:schedule:daily' || data === 'ops:schedule:weekly') {
      await cycleNeboOpsReportSchedule(data.endsWith('daily') ? 'daily' : 'weekly');
      await answerCallback(config.token, callback.id, 'Расписание обновлено');
      await sendMenu();
    } else if (/^ops:report:(today|yesterday|week|month)$/.test(data)) {
      await answerCallback(config.token, callback.id, 'Собираю отчёт…');
      await sendReport(data.slice('ops:report:'.length) as NeboReportKind);
    } else {
      await answerCallback(config.token, callback.id, 'Меню обновлено');
      await sendMenu();
    }
    return;
  }
  const command = String(update.message?.text || '').trim().split(/\s+/)[0].toLowerCase().replace(/@[^\s]+$/, '');
  if (command === '/report') await sendReport('today');
  else if (command === '/yesterday') await sendReport('yesterday');
  else if (command === '/week') await sendReport('week');
  else if (command === '/month') await sendReport('month');
  else await sendMenu();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  if (await forwardNeboOpsRequest(req, res)) return;
  const secret = String(process.env.NEBO_OPS_WEBHOOK_SECRET || '');
  const supplied = String(req.headers['x-telegram-bot-api-secret-token'] || '');
  const config = getNeboOpsConfig();
  if (!config || secret.length < 32 || !safeEqual(secret, supplied)) {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }
  const update = (req.body || {}) as OpsUpdate;
  const callback = update.callback_query;
  const fromId = String(callback?.from?.id ?? update.message?.from?.id ?? '');
  const chatId = String(callback?.message?.chat?.id ?? update.message?.chat?.id ?? '');
  if (fromId !== config.chatId || chatId !== config.chatId) return res.status(200).json({ ok: true });
  if (isRepeatedTelegramUpdate('ops', update.update_id)) return res.status(200).json({ ok: true });
  acknowledgeAndRun(res, () => handleUpdate(update, config), 'ops command');
}
