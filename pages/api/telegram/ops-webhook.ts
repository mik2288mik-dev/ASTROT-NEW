import { timingSafeEqual } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getNeboOpsConfig, neboServerLabel, sendNeboOpsText, type NeboOpsConfig } from '../../../lib/neboOps';
import { sendNeboOpsBusinessReport, type NeboReportKind } from '../../../lib/neboOpsReports';
import { telegramApiRequest } from '../../../lib/telegramRelay';
import type { TelegramReplyMarkup } from '../../../lib/telegramBot';
import {
  applyNeboSettingsTap,
  getNeboBotSettings,
  renderNeboSettingsScreen,
  updateNeboBotSettings,
} from '../../../lib/neboOpsSettings';
import { buildActivityFeed, buildLatestVisitors, buildPremiumList, buildStuckList, buildUserCard, searchPeople } from '../../../lib/neboOpsInsights';
import { buildHealthSummary } from '../../../lib/neboOwnerChannels';
import { createOwnerLoginLink } from '../../../lib/admin/loginLinks';
import { acknowledgeAndRun, forwardNeboOpsRequest, isRepeatedTelegramUpdate } from '../../../lib/neboOpsWebhook';

type OpsUpdate = {
  update_id?: number;
  message?: { text?: string; from?: { id?: number }; chat?: { id?: number } };
  callback_query?: { id?: string; data?: string; from?: { id?: number }; message?: { message_id?: number; chat?: { id?: number } } };
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

/** Settings screens change in place, like switches; a new message only if editing is impossible. */
async function showScreen(config: NeboOpsConfig, messageId: number | undefined, text: string, replyMarkup: TelegramReplyMarkup) {
  if (messageId) {
    const response = await telegramApiRequest(config.token, 'editMessageText', {
      chat_id: config.chatId, message_id: messageId, text, reply_markup: replyMarkup, disable_web_page_preview: true,
    }, { signal: AbortSignal.timeout(8_000) }).catch(() => null);
    if (response?.ok) return;
    const body = await response?.json().catch(() => null);
    if (String(body?.description || '').includes('message is not modified')) return;
  }
  await sendNeboOpsText(text, { replyMarkup });
}

async function sendView(build: () => Promise<string>) {
  await sendNeboOpsText(await build().catch(() => '⚠️ Не получилось собрать данные. Попробуй ещё раз через минуту.'));
}

async function sendReport(kind: NeboReportKind) {
  if (!(await sendNeboOpsBusinessReport(kind).catch(() => false))) {
    await sendNeboOpsText('⚠️ Не удалось отправить отчёт. Попробуй ещё раз через минуту.');
  }
}

async function sendAdminLink() {
  const link = await createOwnerLoginLink().catch(() => null);
  if (!link) {
    await sendNeboOpsText('⚠️ Не получилось сделать ссылку: на сервере не найден аккаунт владельца или адрес сайта.');
    return;
  }
  await sendNeboOpsText('🔑 Вход в админку\n\nКнопка откроет админку в браузере. Ссылка работает один раз и 10 минут.', {
    replyMarkup: { inline_keyboard: [[{ text: '🔑 Открыть админку', url: link }]] },
  });
}

async function sendSearch(query: string) {
  const result = await searchPeople(query).catch(() => ({ text: '⚠️ Поиск не получился, попробуй ещё раз.', buttons: [] }));
  await sendNeboOpsText(result.text, result.buttons.length
    ? { replyMarkup: { inline_keyboard: result.buttons.map((button) => [button]) } }
    : undefined);
}

async function handleUpdate(update: OpsUpdate, config: NeboOpsConfig): Promise<void> {
  const callback = update.callback_query;
  if (callback?.id) {
    const data = String(callback.data || '');
    const messageId = callback.message?.message_id;
    const server = neboServerLabel();
    const screens: Record<string, 'events' | 'items' | 'times'> = { 'ops:events': 'events', 'ops:items': 'items', 'ops:times': 'times' };
    if (screens[data]) {
      await answerCallback(config.token, callback.id, 'Открываю');
      const menu = renderNeboSettingsScreen(screens[data], await getNeboBotSettings(), server);
      await showScreen(config, messageId, menu.text, menu.replyMarkup);
      return;
    }
    if (data === 'ops:menu') {
      await answerCallback(config.token, callback.id, 'Меню');
      const menu = renderNeboSettingsScreen('menu', await getNeboBotSettings(), server);
      await showScreen(config, messageId, menu.text, menu.replyMarkup);
      return;
    }
    let screen: ReturnType<typeof applyNeboSettingsTap> = null;
    const { settings } = await updateNeboBotSettings((current) => {
      screen = applyNeboSettingsTap(current, data);
      return screen !== null;
    });
    if (screen) {
      await answerCallback(config.token, callback.id, data === 'ops:pause' ? (settings.paused ? 'Пауза включена' : 'Пауза снята') : 'Сохранено');
      const menu = renderNeboSettingsScreen(screen, settings, server);
      await showScreen(config, messageId, menu.text, menu.replyMarkup);
      return;
    }
    const report = /^ops:report:(now|today|yesterday|week|month)$/.exec(data);
    const user = /^ops:user:(-?\d{1,20})$/.exec(data);
    if (report) {
      await answerCallback(config.token, callback.id, 'Собираю отчёт…');
      await sendReport(report[1] as NeboReportKind);
    } else if (user) {
      await answerCallback(config.token, callback.id, 'Открываю');
      await sendView(() => buildUserCard(user[1]));
    } else if (data === 'ops:find') {
      await answerCallback(config.token, callback.id, 'Жду ID или имя');
      await sendNeboOpsText('🔎 Пришли ID человека или часть имени, я найду.', { replyMarkup: { force_reply: true as const, input_field_placeholder: 'ID или имя' } });
    } else if (data === 'ops:admin') {
      await answerCallback(config.token, callback.id, 'Делаю ссылку');
      await sendAdminLink();
    } else if (['ops:latest', 'ops:premium', 'ops:health', 'ops:feed', 'ops:stuck'].includes(data)) {
      await answerCallback(config.token, callback.id, 'Собираю…');
      await sendView(data === 'ops:latest' ? () => buildLatestVisitors(10)
        : data === 'ops:feed' ? () => buildActivityFeed(40)
        : data === 'ops:stuck' ? buildStuckList
        : data === 'ops:premium' ? buildPremiumList : buildHealthSummary);
    } else {
      await answerCallback(config.token, callback.id, 'Меню');
      const menu = renderNeboSettingsScreen('menu', await getNeboBotSettings(), server);
      await sendNeboOpsText(menu.text, { replyMarkup: menu.replyMarkup });
    }
    return;
  }
  const textValue = String(update.message?.text || '').trim();
  const words = textValue.split(/\s+/);
  const command = words[0].toLowerCase().replace(/@[^\s]+$/, '');
  if (command === '/user' || command === '/find') {
    if (words[1]) await sendSearch(words.slice(1).join(' '));
    else await sendNeboOpsText('🔎 Пришли ID человека или часть имени, я найду.', { replyMarkup: { force_reply: true as const, input_field_placeholder: 'ID или имя' } });
  } else if (command === '/who') await sendView(() => buildLatestVisitors(15));
  else if (command === '/feed') await sendView(() => buildActivityFeed(40));
  else if (command === '/premium') await sendView(buildPremiumList);
  else if (command === '/report') await sendReport('now');
  else if (command === '/yesterday') await sendReport('yesterday');
  else if (command === '/week') await sendReport('week');
  else if (command === '/month') await sendReport('month');
  else if (command === '/admin') await sendAdminLink();
  else if (textValue && !textValue.startsWith('/')) await sendSearch(textValue);
  else {
    const menu = renderNeboSettingsScreen('menu', await getNeboBotSettings(), neboServerLabel());
    await sendNeboOpsText(menu.text, { replyMarkup: menu.replyMarkup });
  }
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
