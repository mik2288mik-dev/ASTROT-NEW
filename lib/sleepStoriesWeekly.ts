/**
 * «Истории для сна и для успокоения», the weekly part: one new story every week, written once with
 * the project's model, voiced once, kept for good. The three authored stories in lib/sleepStories.ts
 * stay as the first ones. Storage is created at run time (no migration to forget on deploy).
 */
import { getPool } from './db';
import { createLunaStructuredResponse, OPENAI_LUNA_MODEL, type StrictJsonSchema } from './openaiResponses';
import { SLEEP_STORIES, type SleepStory } from './sleepStories';
import { ensureAudio } from './tts/ttsStore';
import { estimateSpeechSeconds, type TtsVoice } from './tts/openaiSpeech';
import { storyGenerationEnabled } from './stories/repository';

export const WEEKLY_STORY_PREFIX = 'w-';
const MIN_WORDS = 400;
const TARGET_WORDS = 520;
const MAX_WORDS = 800;

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS sleep_stories_weekly (
    id TEXT PRIMARY KEY,
    week_key TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL,
    voice TEXT NOT NULL,
    voice_label TEXT NOT NULL,
    title TEXT NOT NULL,
    teaser TEXT NOT NULL,
    body TEXT NOT NULL,
    minutes INTEGER NOT NULL,
    model TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool().query(SCHEMA_SQL).then(() => undefined);
    schemaReady.catch(() => { schemaReady = null; });
  }
  return schemaReady;
}

/** Night themes first; every third week is a daytime «calm» story. */
const NIGHT_THEMES = [
  'маленький горный дом вечером: печка, тёплый плед, снег тихо идёт за окном',
  'паром, который медленно идёт по спокойной реке, огни на берегу',
  'старая библиотека в маленьком городе перед закрытием, запах бумаги и тёплая лампа',
  'лодка на тихом озере, вода почти не шевелится, вдали огоньки',
  'чердак с окном, по крыше мерно стучит дождь',
  'палатка на берегу реки, потрескивает костёр, пахнет хвоей',
  'ночная пекарня, тесто отдыхает, окно запотело от тепла',
  'вагон поезда дальнего следования, мягкий стук колёс и чай в подстаканнике',
  'маяк на спокойном море, свет медленно ходит по воде',
  'дом на опушке леса, запах дров и яблок, сова где-то далеко',
  'тёплая баня в деревне, пар, деревянные стены и лёгкий ветер за стеной',
  'ночной сад после грозы, капли с листьев и свежий воздух',
];
const CALM_THEMES = [
  'тёплый парк у воды днём, скамейка, солнце сквозь листья, никуда не нужно спешить',
  'утро на кухне в выходной, тихое радио, чайник и свет на столе',
  'прогулка по берегу в пасмурный мягкий день, шум прибоя и тёплый шарф',
  'мастерская, где пахнет деревом, и неспешная работа руками',
];

const VOICES: ReadonlyArray<{ voice: TtsVoice; label: string }> = [
  { voice: 'shimmer', label: 'Мягкий светлый голос' },
  { voice: 'onyx', label: 'Низкий мужской голос' },
  { voice: 'sage', label: 'Тихий женский голос' },
  { voice: 'ash', label: 'Спокойный мужской голос' },
  { voice: 'coral', label: 'Тёплый женский голос' },
];

const SCHEMA: StrictJsonSchema = {
  type: 'object',
  properties: { title: { type: 'string' }, teaser: { type: 'string' }, text: { type: 'string' } },
  required: ['title', 'teaser', 'text'],
  additionalProperties: false,
};

const BANNED = /\p{Extended_Pictographic}|энерги|вселенн|карм|судьб|гороскоп|знак зодиака/iu;

/** ISO week in Moscow time, e.g. 2026-W41. */
export function moscowWeekKey(date: Date = new Date()): string {
  const moscow = new Date(date.getTime() + 3 * 3_600_000);
  const day = new Date(Date.UTC(moscow.getUTCFullYear(), moscow.getUTCMonth(), moscow.getUTCDate()));
  const dayNumber = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(day.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((day.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function weekIndex(weekKey: string): number {
  const [year, week] = weekKey.split('-W').map(Number);
  return (year || 0) * 53 + (week || 0);
}

export function weeklyPlan(weekKey: string): { kind: 'sleep' | 'calm'; theme: string; voice: (typeof VOICES)[number] } {
  const index = weekIndex(weekKey);
  const calm = index % 3 === 0;
  // Each kind has its own counter, so no two night weeks (or two calm weeks) in a row share a theme.
  const theme = calm
    ? CALM_THEMES[Math.floor(index / 3) % CALM_THEMES.length]
    : NIGHT_THEMES[(index - Math.floor((index + 2) / 3)) % NIGHT_THEMES.length];
  return { kind: calm ? 'calm' : 'sleep', theme, voice: VOICES[index % VOICES.length] };
}

function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu) ?? []).length;
}

/** Plain commas and periods only: no long dashes, no stray markup. */
export function cleanStoryText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/\s+[—–]\s+/g, ', ')
    .replace(/[—–]/g, ', ')
    .replace(/[*_#>`]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildWeeklyPrompt(plan: ReturnType<typeof weeklyPlan>): { instructions: string; input: string } {
  const sample = SLEEP_STORIES[0].text.ru.slice(0, 900);
  const instructions = [
    'Ты пишешь короткую аудиоисторию для приложения NEBO, которую читает спокойный голос перед сном или для успокоения. Пиши по-русски, простым живым языком.',
    'Объём строго от 650 до 800 слов: это 15-20 абзацев по 3-6 предложений в первой половине, дальше короче. Слишком короткий текст не годится. Абзацы разделяй пустой строкой.',
    'Форма: обращение на «ты», настоящее время, короткие мягкие предложения, много конкретных тихих деталей (звук, запах, тепло, свет, ткань, вода). Ритм постепенно замедляется, к концу образы становятся проще, последние абзацы совсем короткие и ведут ко сну или к спокойствию.',
    'Нет сюжета с тревогой, конфликтом, опасностью, погоней, вопросов к слушателю и призывов что-то делать, кроме как дышать и расслабляться. Не называй время суток точным часом.',
    'Запрещено: эзотерика, гороскопы, знаки зодиака, «энергия», «вселенная», «судьба», эмодзи, длинное тире, списки, заголовки внутри текста, реклама, бренды, имена реальных людей.',
    'Ответ строго в JSON по схеме: title (2-4 слова, без кавычек), teaser (одна строка до 90 знаков: где мы и что чувствуем, без точки в конце), text (сама история).',
  ].join('\n');
  const input = [
    `ТЕМА НЕДЕЛИ: ${plan.theme}.`,
    plan.kind === 'calm' ? 'Это дневная история для успокоения: свет, воздух, неспешные дела, без слов про сон и ночь.' : 'Это история для засыпания.',
    'ПРИМЕР ТОНА (другая история, не повторяй её образы и слова):',
    sample,
  ].join('\n');
  return { instructions, input };
}

type Written = { title: string; teaser: string; text: string };

function parseWritten(content: string): Written | null {
  try {
    const value = JSON.parse(content) as Partial<Written>;
    if (typeof value.title !== 'string' || typeof value.teaser !== 'string' || typeof value.text !== 'string') return null;
    return {
      title: cleanStoryText(value.title).replace(/^[«"]|[»"]$/gu, '').slice(0, 60),
      teaser: cleanStoryText(value.teaser).replace(/\.$/u, '').slice(0, 110),
      text: cleanStoryText(value.text),
    };
  } catch {
    return null;
  }
}

export function checkWeeklyStory(story: Written): string[] {
  const issues: string[] = [];
  const words = countWords(story.text);
  if (words < MIN_WORDS || words > MAX_WORDS + 80) issues.push(`words:${words}`);
  if (!story.title || story.title.length < 3) issues.push('title');
  if (!story.teaser || story.teaser.length < 8) issues.push('teaser');
  if (BANNED.test(`${story.title} ${story.teaser} ${story.text}`)) issues.push('banned');
  if (story.text.split(/\n{2,}/).length < 8) issues.push('paragraphs');
  return issues;
}

type Writer = (plan: ReturnType<typeof weeklyPlan>) => Promise<Written | null>;

async function askModel(prompt: { instructions: string; input: string }): Promise<Written | null> {
  const result = await createLunaStructuredResponse({
    ...prompt,
    maxOutputTokens: 5_000,
    schemaName: 'sleep_story',
    schema: SCHEMA,
    store: false,
    reasoningEffort: 'low',
  });
  return parseWritten(result.content);
}

export const writeWeeklyStoryWithAi: Writer = async (plan) => {
  const prompt = buildWeeklyPrompt(plan);
  const first = await askModel(prompt);
  if (!first || countWords(first.text) >= TARGET_WORDS) return first;
  // The cheap model tends to stop early: ask once to carry the same story on, longer and slower.
  const longer = await askModel({
    instructions: prompt.instructions,
    input: [
      prompt.input,
      'ВОТ ЧЕРНОВИК ЭТОЙ ИСТОРИИ, ОН СЛИШКОМ КОРОТКИЙ:',
      first.text,
      `Перепиши эту же историю подробнее: те же образы и тот же тон, но добавь новые тихие детали, замедли ритм, растяни середину. Должно получиться не меньше ${TARGET_WORDS + 80} слов. Верни title и teaser без изменений.`,
    ].join('\n'),
  });
  return longer && countWords(longer.text) > countWords(first.text) ? { ...longer, title: first.title, teaser: first.teaser } : first;
};

type Row = { id: string; kind: string; voice: string; voice_label: string; title: string; teaser: string; body: string; minutes: number; created_at: Date };

function toStory(row: Row, free: boolean): SleepStory {
  return {
    id: row.id,
    kind: row.kind === 'calm' ? 'calm' : 'sleep',
    free,
    voice: row.voice as TtsVoice,
    title: { ru: row.title, en: row.title },
    teaser: { ru: row.teaser, en: row.teaser },
    voiceLabel: { ru: row.voice_label, en: row.voice_label },
    text: { ru: row.body, en: row.body },
    minutes: Number(row.minutes) || undefined,
  };
}

/** Generated stories, newest first. The newest one is free, like the first authored one. */
export async function listWeeklySleepStories(options: { withText?: boolean } = {}): Promise<SleepStory[]> {
  await ensureSchema();
  const result = await getPool().query<Row>('SELECT id, kind, voice, voice_label, title, teaser, body, minutes, created_at FROM sleep_stories_weekly ORDER BY week_key DESC LIMIT 200');
  return result.rows.map((row, index) => {
    const story = toStory(row, index === 0);
    return options.withText ? story : { ...story, text: { ru: '', en: '' } };
  });
}

export async function findWeeklySleepStory(id: string): Promise<SleepStory | null> {
  if (!id.startsWith(WEEKLY_STORY_PREFIX)) return null;
  await ensureSchema();
  const pool = getPool();
  const result = await pool.query<Row>('SELECT id, kind, voice, voice_label, title, teaser, body, minutes, created_at FROM sleep_stories_weekly WHERE id = $1', [id]);
  const row = result.rows[0];
  if (!row) return null;
  const newest = await pool.query<{ id: string }>('SELECT id FROM sleep_stories_weekly ORDER BY week_key DESC LIMIT 1');
  return toStory(row, newest.rows[0]?.id === row.id);
}

let running: Promise<string | null> | null = null;

/** Writes this week's story if there is none yet and voices it right away. Returns the new id or null. */
export function ensureWeeklySleepStory(options: { now?: Date; writer?: Writer } = {}): Promise<string | null> {
  if (running) return running;
  running = (async () => {
    const weekKey = moscowWeekKey(options.now);
    await ensureSchema();
    const pool = getPool();
    const existing = await pool.query('SELECT id FROM sleep_stories_weekly WHERE week_key = $1', [weekKey]);
    if (existing.rows[0]) return null;
    const plan = weeklyPlan(weekKey);
    const writer = options.writer ?? writeWeeklyStoryWithAi;
    let written: Written | null = null;
    for (let attempt = 0; attempt < 3 && !written; attempt += 1) {
      const candidate = await writer(plan);
      if (candidate && checkWeeklyStory(candidate).length === 0) written = candidate;
    }
    if (!written) return null;
    const id = `${WEEKLY_STORY_PREFIX}${weekKey}`;
    const minutes = Math.max(3, Math.round(estimateSpeechSeconds(written.text, 'sleep') / 60));
    await pool.query(
      `INSERT INTO sleep_stories_weekly (id, week_key, kind, voice, voice_label, title, teaser, body, minutes, model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (week_key) DO NOTHING`,
      [id, weekKey, plan.kind, plan.voice.voice, plan.voice.label, written.title, written.teaser, written.text, minutes, OPENAI_LUNA_MODEL],
    );
    // Voice it now so the first listener opens a ready recording.
    void ensureAudio({ text: written.text, voice: plan.voice.voice, style: 'sleep', ttlDays: null }).catch(() => undefined);
    return id;
  })().finally(() => { running = null; });
  return running;
}

/** Checks on start and then every few hours; the week's story appears on the first check of the week. */
export function scheduleWeeklySleepStory(): void {
  if (!storyGenerationEnabled()) return;
  const run = () => { void ensureWeeklySleepStory().catch((error: unknown) => console.warn('[sleep-stories] weekly failed', error instanceof Error ? error.message : error)); };
  const first = setTimeout(run, 150_000);
  const every = setInterval(run, 6 * 3_600_000);
  first.unref?.();
  every.unref?.();
}
