/**
 * Чтение опубликованных промптов/контента из CMS (Admin v2 Фаза 4) для рантайма.
 * Активный промпт по ключу переопределяет захардкоженный в коде — но ТОЛЬКО если
 * админ его опубликовал; иначе возвращается переданный fallback (поведение не меняется).
 * Кэш в памяти с коротким TTL, чтобы не бить в БД на каждый AI-вызов.
 */
import { getPool } from '../db';

const TTL_MS = 60_000;
const promptCache = new Map<string, { value: string | null; at: number }>();

/**
 * Возвращает тело активного промпта по ключу (status='active'), иначе fallback.
 * Никогда не бросает — при любой ошибке отдаёт fallback (живая генерация не падает).
 */
export async function resolveActivePrompt(key: string, fallback: string, locale = 'ru'): Promise<string> {
  const cacheKey = `${key}|${locale}`;
  const cached = promptCache.get(cacheKey);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return cached.value || fallback;
  }
  try {
    const res = await getPool().query(
      `SELECT body FROM ai_prompts WHERE key = $1 AND locale = $2 AND status = 'active'
       ORDER BY version DESC, id DESC LIMIT 1`,
      [key, locale]
    );
    const body = res.rows[0]?.body ? String(res.rows[0].body) : null;
    promptCache.set(cacheKey, { value: body, at: Date.now() });
    return body || fallback;
  } catch {
    promptCache.set(cacheKey, { value: null, at: Date.now() });
    return fallback;
  }
}

/** Сбросить кэш промптов (вызывается админкой при публикации). */
export function invalidatePromptCache(): void {
  promptCache.clear();
}

/** Опубликованный CMS-контент по типу/локали (для будущих потребителей экранов). */
export async function getPublishedContent(type: string, locale = 'ru'): Promise<Array<{ id: number; title: string | null; body: string }>> {
  try {
    const res = await getPool().query(
      `SELECT id, title, body FROM cms_content WHERE type = $1 AND locale = $2 AND status = 'published'
       ORDER BY published_at DESC NULLS LAST, id DESC`,
      [type, locale]
    );
    return res.rows.map((r: any) => ({ id: Number(r.id), title: r.title ?? null, body: String(r.body || '') }));
  } catch {
    return [];
  }
}
