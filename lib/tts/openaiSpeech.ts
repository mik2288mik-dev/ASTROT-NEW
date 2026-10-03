/**
 * OpenAI text-to-speech. From the Russian server the request goes through the
 * same relay as text generation (OPENAI_RELAY_DIRECT=1 on the relay host).
 * Long texts are split on paragraph boundaries and the MP3 parts are joined.
 */
import { createHash } from 'crypto';

export const TTS_MODEL = (process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts').trim();
/** Default voice for forecasts: warm, calm, friendly. */
export const TTS_DEFAULT_VOICE = (process.env.OPENAI_TTS_VOICE || 'coral').trim();
export const TTS_VOICES = ['coral', 'sage', 'nova', 'shimmer', 'ash', 'ballad', 'onyx', 'verse', 'alloy', 'echo', 'fable', 'marin', 'cedar'] as const;
export type TtsVoice = typeof TTS_VOICES[number];

/** Spoken style passed to the model; part of the cache key. */
export const TTS_STYLES = {
  forecast: 'Говори по-русски тепло и спокойно, как близкий друг за чашкой чая. Средний темп, естественные паузы между абзацами, без театральности и без дикторского пафоса.',
  sleep: 'Говори по-русски очень медленно, мягко и тихо, с длинными паузами между фразами. Спокойный убаюкивающий голос, без резких интонаций.',
  story: 'Читай по-русски живо и выразительно, как хороший рассказчик аудиокниги. Меняй интонацию в диалогах, держи интригу в концовке.',
} as const;
export type TtsStyle = keyof typeof TTS_STYLES;

const OPENAI_CHUNK_LIMIT = 3_800;
const DEFAULT_SPEECH_RELAY_URL = 'https://astrot-production.up.railway.app/api/internal/openai-speech';

export function isTtsVoice(value: unknown): value is TtsVoice {
  return typeof value === 'string' && (TTS_VOICES as readonly string[]).includes(value);
}

export function ttsCacheId(input: { text: string; voice: string; style: TtsStyle }): string {
  return createHash('sha256').update(`${TTS_MODEL}|${input.voice}|${input.style}|${TTS_STYLES[input.style]}|${input.text}`).digest('hex');
}

/** Splits text into parts under the provider limit, never inside a sentence. */
export function splitForSpeech(text: string, limit = OPENAI_CHUNK_LIMIT): string[] {
  const pieces: string[] = [];
  for (const paragraph of text.split(/\n{2,}/u).map((item) => item.trim()).filter(Boolean)) {
    if (paragraph.length <= limit) {
      pieces.push(paragraph);
      continue;
    }
    let buffer = '';
    for (const sentence of paragraph.match(/[^.!?…]+[.!?…]*\s*/gu) ?? [paragraph]) {
      if (buffer && buffer.length + sentence.length > limit) {
        pieces.push(buffer.trim());
        buffer = '';
      }
      buffer += sentence;
    }
    if (buffer.trim()) pieces.push(buffer.trim());
  }
  const parts: string[] = [];
  let current = '';
  for (const piece of pieces) {
    if (current && current.length + 2 + piece.length > limit) {
      parts.push(current);
      current = '';
    }
    current = current ? `${current}\n\n${piece}` : piece;
  }
  if (current) parts.push(current);
  return parts;
}

function relayToken(apiKey: string): string {
  return createHash('sha256').update(`nebo-openai-relay-v1:${apiKey}`).digest('hex');
}

async function requestSpeech(body: Record<string, unknown>): Promise<Buffer> {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY_MISSING');
  const direct = process.env.OPENAI_RELAY_DIRECT === '1';
  const url = direct
    ? 'https://api.openai.com/v1/audio/speech'
    : String(process.env.OPENAI_SPEECH_RELAY_URL || DEFAULT_SPEECH_RELAY_URL).trim();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${direct ? apiKey : relayToken(apiKey)}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 200);
    throw new Error(`TTS_HTTP_${response.status}${detail ? `:${detail}` : ''}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function synthesizeSpeech(input: { text: string; voice: string; style: TtsStyle; speed?: number }): Promise<Buffer> {
  const parts = splitForSpeech(input.text);
  const buffers: Buffer[] = [];
  for (const part of parts) {
    buffers.push(await requestSpeech({
      model: TTS_MODEL,
      voice: input.voice,
      input: part,
      instructions: TTS_STYLES[input.style],
      response_format: 'mp3',
      ...(input.speed ? { speed: input.speed } : {}),
    }));
  }
  return Buffer.concat(buffers);
}

/** Russian speech is about 14 characters per second at a calm pace. */
export function estimateSpeechSeconds(text: string, style: TtsStyle = 'forecast'): number {
  const perSecond = style === 'sleep' ? 10 : 14;
  return Math.max(5, Math.round(text.replace(/\s+/gu, ' ').length / perSecond));
}
