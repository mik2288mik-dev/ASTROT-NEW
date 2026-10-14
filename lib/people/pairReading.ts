import { createHash } from 'crypto';
import type { Pool } from 'pg';
import type { NatalChartData, SynastryResult } from '../../types';
import type { NatalChartDataV2 } from '../natalChartV2Types';
import { db, getPool } from '../db';
import { getPremiumEntitlementState } from '../contentArchitecture';
import { isCanonicalNatalChartDataComplete } from '../natalChartCanonical';
import { classifyCompatibilityPerson, resolveCompatibilityPairLevel } from '../synastry/compatibilityInput';
import { calculateCompatibility, COMPATIBILITY_ENGINE_VERSION, type CalculatedCompatibility } from '../synastry/compatibilityEngine';
import {
  buildCompatibilityResult,
  CompatibilityNarrativeError,
  COMPATIBILITY_NARRATIVE_VERSION,
} from '../synastry/compatibilityNarrative';
import { buildCompatibilityPreview } from '../synastry/compatibilityPreview';
import {
  buildCompatibilityStoryPrompt,
  compatibilitySpokenViolations,
  COMPATIBILITY_STORY_SCHEMA,
  pairAudienceViolations,
} from '../synastry/compatibilityVoice';
import { buildPairTalkCalendar } from '../synastry/pairTalkCalendar';
import { createLunaStructuredResponse, getOpenAIResponsesClient } from '../openaiResponses';
import { ensurePeopleSchema } from './schema';
import { firstName, getLinkMembers, PeopleError, type LinkContext } from './service';

/** Bump to give every linked pair a freshly written shared reading. */
export const PAIR_READING_VERSION = 'pair-v1';

type ChartData = NatalChartData | NatalChartDataV2;
type Gender = 'male' | 'female' | 'unspecified';
type TimeQuality = 'exact' | 'approximate' | 'unknown';

type PairPerson = {
  userId: string;
  name: string;
  gender: Gender;
  chartData: ChartData | null;
  inputHash: string;
  sunSign: string | null;
  birth: { date: string; time: string; place: string };
  timeQuality: TimeQuality;
  isPremium: boolean;
};

type PersonSnapshot = { name: string; date: string; time: string; place: string; timeQuality: TimeQuality };
type ReadingInputs = { low: PersonSnapshot; high: PersonSnapshot; context: LinkContext };

export type PairReadingStatus = 'ready' | 'locked' | 'missing_data' | 'writing_failed';

export type PairReadingResponse = {
  status: PairReadingStatus;
  relationshipContext: LinkContext;
  me: { name: string; sunSign: string | null };
  partner: { name: string; sunSign: string | null };
  /** Who still has to add birth details before anything can be calculated. */
  missing: Array<'me' | 'partner'>;
  calculationLevel: string | null;
  preview: (ReturnType<typeof buildCompatibilityPreview> & { talkDays: ReturnType<typeof buildPairTalkCalendar> }) | null;
  reading: SynastryResult | null;
  /** The shared reading opens for both when either of the two has Premium. */
  premiumFrom: 'me' | 'partner' | null;
  /** Shown once to each person after the shared reading was rewritten for new data. */
  updateNotes: string[];
  /** My manual card of this person differed from the details they gave themselves. */
  manualCardDiffers: Array<'date' | 'time' | 'place'>;
  readingKey: string | null;
};

const CONTEXT_LABELS: Record<LinkContext, { ru: string; en: string }> = {
  relationship: { ru: 'Пара', en: 'Couple' },
  friendship: { ru: 'Дружба', en: 'Friendship' },
  family: { ru: 'Семья', en: 'Family' },
  work: { ru: 'Работа', en: 'Work' },
};

function dateOnly(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return String(value).slice(0, 10);
}

function clockTime(value: unknown): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value ?? '').trim());
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
}

function normalizeGender(value: unknown): Gender {
  return value === 'male' || value === 'female' ? value : 'unspecified';
}

function normalizeTimeQuality(chart: ChartData | null, time: string): TimeQuality {
  const quality = String((chart as NatalChartDataV2 | null)?.birthTimeQuality || '').toLowerCase();
  if (quality === 'approximate' && time) return 'approximate';
  if (quality === 'unknown' || !time) return 'unknown';
  return 'exact';
}

async function loadPerson(userId: string, language: 'ru' | 'en'): Promise<PairPerson> {
  const [user, chart, entitlement] = await Promise.all([
    db.users.get(userId),
    db.natal_charts.getPrimary(userId),
    getPremiumEntitlementState(userId),
  ]);
  const complete = Boolean(chart?.id && chart?.input_hash && isCanonicalNatalChartDataComplete(chart?.chart_data));
  const chartData = complete ? chart!.chart_data as ChartData : null;
  const time = complete ? clockTime(chart!.birth_time) : '';
  return {
    userId,
    name: firstName(user?.name) || (language === 'ru' ? 'Без имени' : 'No name'),
    gender: normalizeGender(user?.gender),
    chartData,
    inputHash: complete ? String(chart!.input_hash) : '',
    sunSign: chart?.sun_sign ? String(chart.sun_sign).toLowerCase() : null,
    birth: {
      date: complete ? dateOnly(chart!.birth_date) : '',
      time,
      place: complete ? String(chart!.birth_place || '').trim() : '',
    },
    timeQuality: normalizeTimeQuality(chartData, time),
    isPremium: entitlement.isPremium === true,
  };
}

function snapshot(person: PairPerson): PersonSnapshot {
  return { name: person.name, ...person.birth, timeQuality: person.timeQuality };
}

/** Same data, type and language give the same key for both people, in any order. */
export function pairReadingKey(low: PairPerson, high: PairPerson, context: LinkContext, language: 'ru' | 'en'): string {
  return createHash('sha256').update([
    PAIR_READING_VERSION,
    COMPATIBILITY_ENGINE_VERSION,
    COMPATIBILITY_NARRATIVE_VERSION,
    language,
    context,
    low.inputHash, low.name, low.gender, low.timeQuality,
    high.inputHash, high.name, high.gender, high.timeQuality,
  ].join('|')).digest('hex');
}

const FIELD_LABELS = {
  ru: { name: 'имя', date: 'дата рождения', time: 'время рождения', place: 'место рождения' },
  en: { name: 'name', date: 'birth date', time: 'birth time', place: 'birth place' },
} as const;

/** Plain words about what changed, without showing anyone's birth details. */
export function describeReadingChanges(
  previous: ReadingInputs | null,
  current: ReadingInputs,
  viewerSide: 'low' | 'high',
  language: 'ru' | 'en',
): string[] {
  if (!previous) return [];
  const notes: string[] = [];
  for (const side of ['low', 'high'] as const) {
    const before = previous[side];
    const after = current[side];
    if (!before || !after) continue;
    const changed = (['name', 'date', 'time', 'place'] as const).filter((field) => (before[field] || '') !== (after[field] || ''));
    if (before.timeQuality !== after.timeQuality && !changed.includes('time')) changed.push('time');
    if (!changed.length) continue;
    const fields = changed.map((field) => FIELD_LABELS[language][field]).join(', ');
    const who = side === viewerSide
      ? (language === 'ru' ? 'Твои данные' : 'Your details')
      : after.name;
    notes.push(language === 'ru' ? `${who}: обновлено (${fields}).` : `${who}: updated (${fields}).`);
  }
  if (previous.context !== current.context) {
    notes.push(language === 'ru'
      ? `Тип связи теперь «${CONTEXT_LABELS[current.context].ru}».`
      : `The relationship type is now “${CONTEXT_LABELS[current.context].en}”.`);
  }
  return notes;
}

const inFlight = new Map<string, Promise<SynastryResult>>();

async function writePairStory(calculated: CalculatedCompatibility, low: PairPerson, high: PairPerson, language: 'ru' | 'en'): Promise<SynastryResult> {
  if (!getOpenAIResponsesClient()) throw new Error('PAIR_WRITER_UNAVAILABLE');
  const writerPerson = (person: PairPerson) => ({
    source: 'saved',
    name: person.name,
    gender: person.gender,
    zodiacSign: person.sunSign,
    birthTimeQuality: person.timeQuality,
  });
  const narrativeInput = {
    subjectName: low.name,
    partnerName: high.name,
    subjectGender: low.gender,
    partnerGender: high.gender,
    language,
    audience: 'pair' as const,
  };
  let revisionReason: string | undefined;
  let fallback: SynastryResult | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = buildCompatibilityStoryPrompt({
      language,
      calculated,
      subject: writerPerson(low),
      partner: writerPerson(high),
      revisionReason,
      audience: 'pair',
    });
    let content: string;
    try {
      const response = await createLunaStructuredResponse({
        instructions: prompt.system,
        input: prompt.user,
        maxOutputTokens: 2600,
        reasoningEffort: 'low',
        verbosity: 'low',
        schemaName: 'calculated_pair_compatibility_story',
        schema: COMPATIBILITY_STORY_SCHEMA,
      });
      content = response.content;
    } catch (error) {
      if (fallback) return fallback;
      throw error;
    }
    try {
      const story = JSON.parse(content);
      const result = buildCompatibilityResult(calculated, story, narrativeInput);
      const issues = attempt === 0 ? [...compatibilitySpokenViolations(story), ...pairAudienceViolations(story)] : [];
      if (!issues.length) return result;
      fallback = result;
      revisionReason = `${issues.join(', ')}: both people read this together, so speak to them as «вы» by names, plain spoken Russian, no long dash`;
    } catch (error) {
      if (fallback) return fallback;
      const retryable = error instanceof CompatibilityNarrativeError || error instanceof SyntaxError;
      if (attempt === 1 || !retryable) throw error;
      revisionReason = error instanceof CompatibilityNarrativeError ? error.reason : 'invalid_json';
    }
  }
  if (fallback) return fallback;
  throw new Error('PAIR_READING_UNAVAILABLE');
}

async function loadLatestOtherReading(pool: Pool, linkId: string, language: string, readingKey: string): Promise<ReadingInputs | null> {
  const result = await pool.query(
    `SELECT inputs FROM people_pair_readings
     WHERE link_id = $1::bigint AND language = $2 AND reading_key <> $3
     ORDER BY created_at DESC LIMIT 1`,
    [linkId, language, readingKey],
  );
  return (result.rows[0]?.inputs as ReadingInputs | undefined) || null;
}

async function manualCardDifferences(pool: Pool, linkId: string, viewerId: string, partner: PairPerson): Promise<Array<'date' | 'time' | 'place'>> {
  if (!partner.chartData) return [];
  const result = await pool.query(
    `SELECT c.birth_date, c.birth_time, c.birth_place
     FROM people_link_members m
     JOIN natal_charts c ON c.id = m.manual_chart_id AND c.user_id = m.user_id
     WHERE m.link_id = $1::bigint AND m.user_id = $2::bigint`,
    [linkId, viewerId],
  );
  const card = result.rows[0];
  if (!card) return [];
  const differs: Array<'date' | 'time' | 'place'> = [];
  if (dateOnly(card.birth_date) !== partner.birth.date) differs.push('date');
  if (clockTime(card.birth_time) !== partner.birth.time) differs.push('time');
  const place = (value: string) => value.toLocaleLowerCase().replace(/\s+/gu, ' ').split(',')[0].trim();
  if (place(String(card.birth_place || '')) !== place(partner.birth.place)) differs.push('place');
  return differs;
}

async function storePairStory(input: {
  pool: Pool;
  linkId: string;
  readingKey: string;
  language: 'ru' | 'en';
  context: LinkContext;
  calculationLevel: string;
  inputs: ReadingInputs;
  calculated: CalculatedCompatibility;
  low: PairPerson;
  high: PairPerson;
}): Promise<SynastryResult> {
  const { pool, linkId, readingKey, language } = input;
  const written = await writePairStory(input.calculated, input.low, input.high, language);
  await pool.query(
    `INSERT INTO people_pair_readings (link_id, reading_key, language, relationship_context, calculation_level, inputs, content)
     VALUES ($1::bigint, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
     ON CONFLICT (link_id, reading_key) DO NOTHING`,
    [linkId, readingKey, language, input.context, input.calculationLevel, JSON.stringify(input.inputs), JSON.stringify(written)],
  );
  // Keep the newest two versions: the current one and the one it replaced, for «what changed».
  await pool.query(
    `DELETE FROM people_pair_readings WHERE link_id = $1::bigint AND language = $2 AND id NOT IN (
       SELECT id FROM people_pair_readings WHERE link_id = $1::bigint AND language = $2 ORDER BY created_at DESC, id DESC LIMIT 2
     )`,
    [linkId, language],
  );
  // Another server may have saved first; everyone reads the stored version.
  const stored = await pool.query(
    'SELECT content FROM people_pair_readings WHERE link_id = $1::bigint AND reading_key = $2',
    [linkId, readingKey],
  );
  return (stored.rows[0]?.content as SynastryResult | undefined) || written;
}

/**
 * The one shared reading of a linked pair. The lower account id is always the
 * «subject», so both people get the same calculation and the same stored text.
 * Opening it again never writes a new text; new data writes one new version.
 */
export async function getPairReading(input: {
  viewerId: string;
  linkId: string;
  language: 'ru' | 'en';
  generate: boolean;
  pool?: Pool;
}): Promise<PairReadingResponse> {
  const pool = input.pool || getPool();
  const { viewerId, linkId, language } = input;
  await ensurePeopleSchema(pool);
  const members = await getLinkMembers(viewerId, linkId, pool);
  const viewerSide: 'low' | 'high' = members.lowId === String(viewerId) ? 'low' : 'high';
  const [low, high] = await Promise.all([loadPerson(members.lowId, language), loadPerson(members.highId, language)]);
  const me = viewerSide === 'low' ? low : high;
  const partner = viewerSide === 'low' ? high : low;
  const context = members.relationshipContext;
  const premiumFrom = me.isPremium ? 'me' : partner.isPremium ? 'partner' : null;
  const base: PairReadingResponse = {
    status: 'missing_data',
    relationshipContext: context,
    me: { name: me.name, sunSign: me.sunSign },
    partner: { name: partner.name, sunSign: partner.sunSign },
    missing: [],
    calculationLevel: null,
    preview: null,
    reading: null,
    premiumFrom,
    updateNotes: [],
    manualCardDiffers: await manualCardDifferences(pool, linkId, viewerId, partner),
    readingKey: null,
  };
  if (!me.chartData) base.missing.push('me');
  if (!partner.chartData) base.missing.push('partner');
  if (base.missing.length) return base;

  const classify = (person: PairPerson) => classifyCompatibilityPerson({
    source: 'saved',
    chartId: 1,
    date: person.birth.date,
    time: person.birth.time,
    place: person.birth.place,
    chartBirthTimeQuality: (person.chartData as NatalChartDataV2).birthTimeQuality,
  });
  const calculationLevel = resolveCompatibilityPairLevel(classify(low), classify(high));
  const calculated = calculateCompatibility({
    subjectChart: low.chartData!,
    partnerChart: high.chartData!,
    calculationLevel,
    relationshipContext: context,
    subjectName: low.name,
    partnerName: high.name,
    language,
  });
  let talkDays: ReturnType<typeof buildPairTalkCalendar> = [];
  try {
    talkDays = buildPairTalkCalendar(low.chartData!, high.chartData!, { language });
  } catch {
    talkDays = [];
  }
  const readingKey = pairReadingKey(low, high, context, language);
  const inputs: ReadingInputs = { low: snapshot(low), high: snapshot(high), context };
  const ready: PairReadingResponse = {
    ...base,
    status: premiumFrom ? 'ready' : 'locked',
    calculationLevel,
    preview: { ...buildCompatibilityPreview(calculated, { subject: low.name, partner: high.name }, language), talkDays },
    readingKey,
  };
  if (!premiumFrom) return ready;

  const stored = await pool.query(
    'SELECT content FROM people_pair_readings WHERE link_id = $1::bigint AND reading_key = $2',
    [linkId, readingKey],
  );
  let reading = (stored.rows[0]?.content as SynastryResult | undefined) || null;
  if (!reading && input.generate) {
    const flightKey = `${linkId}:${readingKey}`;
    let flight = inFlight.get(flightKey);
    if (!flight) {
      flight = storePairStory({ pool, linkId, readingKey, language, context, calculationLevel, inputs, calculated, low, high });
      inFlight.set(flightKey, flight);
      // A finished flight stays for a minute: someone who checked the table a moment
      // before it was saved gets this same text instead of starting a second one.
      flight.then(
        () => { const timer = setTimeout(() => inFlight.delete(flightKey), 60_000); timer.unref?.(); },
        () => { inFlight.delete(flightKey); },
      );
    }
    try {
      reading = await flight;
    } catch {
      return { ...ready, status: 'writing_failed' };
    }
  }
  if (!reading) return { ...ready, reading: null };

  const seen = await pool.query(
    'SELECT seen_reading_key FROM people_link_members WHERE link_id = $1::bigint AND user_id = $2::bigint',
    [linkId, viewerId],
  );
  const seenKey = seen.rows[0]?.seen_reading_key as string | null | undefined;
  let updateNotes: string[] = [];
  if (seenKey && seenKey !== readingKey) {
    updateNotes = describeReadingChanges(await loadLatestOtherReading(pool, linkId, language, readingKey), inputs, viewerSide, language);
  }
  if (seenKey !== readingKey) {
    await pool.query(
      'UPDATE people_link_members SET seen_reading_key = $3 WHERE link_id = $1::bigint AND user_id = $2::bigint',
      [linkId, viewerId, readingKey],
    );
  }
  return { ...ready, reading, updateNotes };
}

export { PeopleError };
