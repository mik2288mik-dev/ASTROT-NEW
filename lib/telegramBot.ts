const BOT_TOKEN = process.env.BOT_TOKEN || '';

type TelegramSendMessageResult = {
  ok: boolean;
  messageId?: number;
  error?: string;
};

export async function sendTelegramTextMessage(chatId: string, text: string): Promise<TelegramSendMessageResult> {
  if (!BOT_TOKEN) {
    return {
      ok: false,
      error: 'BOT_TOKEN is not configured',
    };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
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
