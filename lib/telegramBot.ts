const BOT_TOKEN = process.env.BOT_TOKEN || '';

type TelegramSendResult = {
  ok: boolean;
  messageId?: number;
  error?: string;
};

function buildInlineKeyboardUrl(deepLink: string, buttonText: string): Array<Array<{ text: string; url: string }>> | undefined {
  const url = String(deepLink || '').trim();
  const text = String(buttonText || '').trim();
  if (!url || !text) return undefined;
  return [[{ text, url }]];
}

export async function sendTelegramTextMessage(
  chatId: string,
  text: string,
  options?: { replyMarkup?: { inline_keyboard: Array<Array<{ text: string; url: string }>> } }
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
  options?: { replyMarkup?: { inline_keyboard: Array<Array<{ text: string; url: string }>> } }
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
  options?: { replyMarkup?: { inline_keyboard: Array<Array<{ text: string; url: string }>> } }
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

export { buildInlineKeyboardUrl };
