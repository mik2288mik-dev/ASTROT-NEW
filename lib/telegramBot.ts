const BOT_TOKEN = process.env.BOT_TOKEN || '';

type TelegramSendResult = {
  ok: boolean;
  messageId?: number;
  error?: string;
};

export type TelegramInlineKeyboardButton = {
  text: string;
  url?: string;
  callback_data?: string;
};

export type TelegramReplyMarkup = {
  inline_keyboard: TelegramInlineKeyboardButton[][];
};

function buildInlineKeyboardUrl(deepLink: string, buttonText: string): TelegramInlineKeyboardButton[][] | undefined {
  const url = String(deepLink || '').trim();
  const text = String(buttonText || '').trim();
  if (!url || !text) return undefined;
  return [[{ text, url }]];
}

export function buildRetentionInlineKeyboard(input: {
  deepLink: string;
  buttonText: string;
  notificationId?: number | null;
  notificationType?: string | null;
}): TelegramReplyMarkup | undefined {
  // Только кнопка перехода в приложение. Без вторичных «Позже / Не присылать /
  // Выключить» — пользователю нужна одна понятная кнопка.
  const primary = buildInlineKeyboardUrl(input.deepLink, input.buttonText);
  if (!primary) return undefined;
  return { inline_keyboard: primary };
}

// Имя бота для ссылок-кнопок мини-аппа. Берём из env; если его нет — спрашиваем у
// Telegram через getMe по BOT_TOKEN и кешируем. Так кнопка пуша всегда открывает
// мини-апп, не требуя отдельной переменной окружения.
let cachedBotUsername: string | null = null;
export async function resolveBotUsername(): Promise<string> {
  const fromEnv = (
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ||
    process.env.TELEGRAM_BOT_USERNAME ||
    process.env.BOT_USERNAME ||
    ''
  ).replace(/^@/, '').trim();
  if (fromEnv) return fromEnv;
  if (cachedBotUsername !== null) return cachedBotUsername;
  if (!BOT_TOKEN) { cachedBotUsername = ''; return ''; }
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const data = await response.json();
    cachedBotUsername = String(data?.result?.username || '').replace(/^@/, '').trim();
  } catch {
    cachedBotUsername = '';
  }
  return cachedBotUsername;
}

/** Возврат Telegram Stars по charge id. Используется админкой (billing.refund). */
export async function refundStarPayment(
  userId: string,
  telegramPaymentChargeId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!BOT_TOKEN) return { ok: false, error: 'BOT_TOKEN is not configured' };
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/refundStarPayment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: Number(userId), telegram_payment_charge_id: telegramPaymentChargeId }),
    });
    const data = await response.json().catch(() => ({} as any));
    if (!response.ok || !data?.ok) return { ok: false, error: data?.description || `Telegram refund failed: ${response.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'refund request failed' };
  }
}

export async function sendTelegramTextMessage(
  chatId: string,
  text: string,
  options?: { replyMarkup?: TelegramReplyMarkup }
): Promise<TelegramSendResult> {
  if (!BOT_TOKEN) {
    return {
      ok: false,
      error: 'BOT_TOKEN is not configured',
    };
  }

  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    };
    if (options?.replyMarkup) {
      body.reply_markup = options.replyMarkup;
    }

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) {
      return {
        ok: false,
        error: payload?.description || `Telegram sendMessage failed: ${response.status}`,
      };
    }

    return {
      ok: true,
      messageId: payload?.result?.message_id,
    };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || 'Telegram sendMessage failed',
    };
  }
}

/**
 * Send a photo from an in-memory PNG (e.g. generated cards). Telegram requires multipart.
 */
export async function sendTelegramPhotoBuffer(
  chatId: string,
  buffer: Buffer,
  fileName: string,
  caption: string,
  options?: { replyMarkup?: TelegramReplyMarkup }
): Promise<TelegramSendResult> {
  if (!BOT_TOKEN) {
    return { ok: false, error: 'BOT_TOKEN is not configured' };
  }

  try {
    const formData = new FormData();
    formData.append('chat_id', chatId);
    const blob = new Blob([new Uint8Array(buffer)], { type: 'image/png' });
    formData.append('photo', blob, fileName || 'lumia.png');
    if (caption) {
      formData.append('caption', caption);
    }
    if (options?.replyMarkup) {
      formData.append('reply_markup', JSON.stringify(options.replyMarkup));
    }

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: formData,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) {
      return {
        ok: false,
        error: payload?.description || `Telegram sendPhoto failed: ${response.status}`,
      };
    }

    return {
      ok: true,
      messageId: payload?.result?.message_id,
    };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || 'Telegram sendPhoto failed',
    };
  }
}

export async function sendTelegramPhotoMessage(
  chatId: string,
  photoUrl: string,
  caption: string,
  options?: { replyMarkup?: TelegramReplyMarkup }
): Promise<TelegramSendResult> {
  if (!BOT_TOKEN) {
    return {
      ok: false,
      error: 'BOT_TOKEN is not configured',
    };
  }

  const url = String(photoUrl || '').trim();
  if (!url) {
    return { ok: false, error: 'Photo URL is required' };
  }

  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      photo: url,
      caption: caption || undefined,
    };
    if (options?.replyMarkup) {
      body.reply_markup = options.replyMarkup;
    }

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) {
      return {
        ok: false,
        error: payload?.description || `Telegram sendPhoto failed: ${response.status}`,
      };
    }

    return {
      ok: true,
      messageId: payload?.result?.message_id,
    };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || 'Telegram sendPhoto failed',
    };
  }
}

export async function answerTelegramCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!BOT_TOKEN) return { ok: false, error: 'BOT_TOKEN is not configured' };
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || undefined,
        show_alert: false,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) {
      return { ok: false, error: payload?.description || `answerCallbackQuery failed: ${response.status}` };
    }
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'answerCallbackQuery failed' };
  }
}

export { buildInlineKeyboardUrl };
