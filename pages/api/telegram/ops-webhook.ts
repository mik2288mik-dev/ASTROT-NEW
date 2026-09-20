import { timingSafeEqual } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getNeboOpsConfig, sendNeboOpsText } from '../../../lib/neboOps';
import { sendNeboOpsBusinessReport } from '../../../lib/neboOpsReports';
import { telegramApiRequest } from '../../../lib/telegramRelay';
import {
  cycleNeboOpsReportSchedule,
  getNeboOpsPreferences,
  renderNeboOpsMenu,
  toggleNeboOpsPreference,
  type NeboOpsPreferenceKey,
} from '../../../lib/neboOpsSettings';

type OpsUpdate = {
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
  const menu = renderNeboOpsMenu(await getNeboOpsPreferences());
  await sendNeboOpsText(menu.text, { replyMarkup: menu.replyMarkup });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
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
    } else if (data === 'ops:report:today' || data === 'ops:report:week') {
      await answerCallback(config.token, callback.id, 'Собираю отчёт…');
      if (!(await sendNeboOpsBusinessReport(data.endsWith('today') ? 'today' : 'week'))) {
        await sendNeboOpsText('⚠️ Не удалось отправить отчёт. Попробуй ещё раз через минуту.');
      }
    } else {
      await answerCallback(config.token, callback.id, 'Меню обновлено');
      await sendMenu();
    }
    return res.status(200).json({ ok: true });
  }

  const command = String(update.message?.text || '').trim().split(/\s+/)[0].toLowerCase().replace(/@[^\s]+$/, '');
  if (command === '/report') await sendNeboOpsBusinessReport('today');
  else if (command === '/week') await sendNeboOpsBusinessReport('week');
  else await sendMenu();
  return res.status(200).json({ ok: true });
}
