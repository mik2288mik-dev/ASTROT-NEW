import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/astrology/chat] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/astrology/chat] ERROR: ${message}`, error || '');
  },
};

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { history, message, profile, systemInstruction } = req.body;
    const lang = profile?.language === 'ru';

    if (!message || !profile) {
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'Message and profile are required'
      });
    }

    log.info('Chat request received', {
      userId: profile.id,
      messageLength: message.length,
      historyLength: history?.length || 0,
      language: lang ? 'ru' : 'en'
    });

    // Проверяем наличие API ключа
    if (!process.env.OPENAI_API_KEY) {
      log.error('OpenAI API key not configured');
      const fallbackResponse = lang
        ? 'Звезды временно скрыты облаками. Попробуйте позже.'
        : 'The stars are temporarily clouded. Please try again later.';
      return res.status(200).json({ response: fallbackResponse });
    }

    // Формируем сообщения для OpenAI
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemInstruction || 'You are Astra, a helpful astrology assistant.'
      }
    ];

    // Добавляем историю чата
    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        if (msg.role === 'user') {
          messages.push({ role: 'user', content: msg.text });
        } else if (msg.role === 'model') {
          messages.push({ role: 'assistant', content: msg.text });
        }
      });
    }

    // Добавляем текущее сообщение
    messages.push({ role: 'user', content: message });

    log.info('Sending request to OpenAI', {
      messagesCount: messages.length,
      model: 'gpt-4o-mini'
    });

    // Отправляем запрос в OpenAI
    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Используем более быструю и дешёвую модель для чата
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const duration = Date.now() - startTime;
    const response = completion.choices[0]?.message?.content || '';

    log.info('OpenAI response received', {
      duration: `${duration}ms`,
      responseLength: response.length,
      tokensUsed: completion.usage?.total_tokens
    });

    return res.status(200).json({ response });
  } catch (error: any) {
    log.error('Error in chat handler', {
      error: error.message,
      code: error.code,
      type: error.type
    });

    // Fallback на случай ошибки OpenAI
    const lang = req.body.profile?.language === 'ru';
    const fallbackResponse = lang
      ? 'Звезды временно скрыты облаками. Попробуйте позже.'
      : 'The stars are temporarily clouded. Please try again later.';

    return res.status(200).json({ response: fallbackResponse });
  }
}
