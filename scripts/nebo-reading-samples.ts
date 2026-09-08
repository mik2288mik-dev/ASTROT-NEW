/** Local review only: fictitious people, actual Swiss charts and current Luna writers.
 * No database, accounts, forecast cache or saved user charts are touched.
 * Run explicitly: npm exec -- tsx scripts/nebo-reading-samples.ts
 * Existing successful samples are reused; delete the sample file to regenerate.
 */
import { loadEnvConfig } from '@next/env';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import type { UserProfile } from '../types';
import type { NatalChartDataV2 } from '../lib/natalChartV2Types';
import type { PersonalForecastPackage } from '../lib/personalForecastContract';
import type { NatalReportCategoryKey, NatalReportCategoryPack } from '../lib/natalReading/reportCatalog';
import type { PersonalMicroForecast } from '../lib/personalMicroForecastContract';
import type { PersonalFutureForecast } from '../lib/personalFutureForecastContract';
import type { SignFutureReading } from '../lib/horoscope/signFutureContract';

loadEnvConfig(process.cwd(), true);
const destination = path.resolve('components/ui-preview/readingSamples.json');
type Sample = { id: string; profile: UserProfile; chart: NatalChartDataV2; forecasts: Partial<Record<'day' | 'week' | 'month', PersonalForecastPackage>>; categoryPacks: Partial<Record<NatalReportCategoryKey, NatalReportCategoryPack>>; microForecasts?: Partial<Record<'day' | 'week' | 'month', PersonalMicroForecast>>; futureForecasts?: PersonalFutureForecast[]; errors: Record<string, string> };
const saved = fs.existsSync(destination) ? JSON.parse(fs.readFileSync(destination, 'utf8')) : { people: [] };
const result: { generatedAt: string; source: string; people: Sample[]; zodiacFuture?: SignFutureReading[] } = {
  generatedAt: new Date().toISOString(), source: saved.people.length ? saved.source : 'Current Luna writers; fictitious profiles; Swiss Ephemeris natal charts', people: saved.people,
};
result.zodiacFuture = saved.zodiacFuture || [];
const extrasOnly = process.argv.includes('--extras-only');
const save = () => {
  const pending = destination + '.pending';
  fs.writeFileSync(pending, JSON.stringify(result, null, 2) + '\n');
  for (let attempt = 0; ; attempt += 1) {
    try { fs.renameSync(pending, destination); break; }
    catch (error) {
      if (!['EPERM', 'EBUSY'].includes((error as NodeJS.ErrnoException).code || '') || attempt >= 10) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
};

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
  // Optional local-only bridge for Windows without a compiled Node addon.
  // Calls the actual Swiss library through Python. Does not change app runtime.
  if (process.env.NEBO_PREVIEW_PYTHON) {
    const require = createRequire(import.meta.url);
    let ephemerisPath = '';
    const call = (method: string, args: unknown[]) => JSON.parse(execFileSync(process.env.NEBO_PREVIEW_PYTHON!, ['-c', `import json,sys,swisseph as s
s.set_ephe_path(sys.argv[1])
m=sys.argv[2]; a=json.loads(sys.argv[3])
if m=='julday': r=s.julday(*a)
elif m=='calc':
 x,f,*warnings=s.calc_ut(*a)
 if not f & s.FLG_SWIEPH: raise RuntimeError('Swiss ephemeris files were not used')
 r={'longitude':x[0],'speedLongitude':x[3]}
elif m=='houses':
 c,x=s.houses(a[0],a[1],a[2],a[3].encode())
 r={'house':list(c),'ascendant':x[0],'mc':x[1]}
print(json.dumps(r))`, ephemerisPath, method, JSON.stringify(args)], { encoding: 'utf8', timeout: 15000 }));
    const bridge = {
      swe_set_ephe_path: (value: string) => { ephemerisPath = value; },
      swe_julday: (...args: unknown[]) => call('julday', args),
      swe_calc_ut: (...args: unknown[]) => call('calc', args),
      swe_houses: (...args: unknown[]) => call('houses', args),
    };
    const modulePath = require.resolve('swisseph-v2');
    require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: bridge } as NodeModule;
    const packagePath = require.resolve('swisseph-v2/package.json');
    require.cache[packagePath] = { id: packagePath, filename: packagePath, loaded: true, exports: { version: 'pysweph 2.10.3.6 (local Python bridge)' } } as NodeModule;
    result.source = 'Current Luna writers; fictitious profiles; natal and selected-date Swiss calculations via local Python pysweph 2.10.3.6 (not native Node runtime)';
  }
  const { calculateNatalChart } = await import('../lib/swisseph-calculator');
  const { generatePersonalForecastPackage } = await import('../lib/personalForecastGeneration');
  const { getPersonalForecastPeriodKey, resolvePersonalForecastWindow } = await import('../lib/personalForecastContract');
  const { generateNatalReportCategoryPack } = await import('../lib/natalReading/reportCatalogGeneration');
  const { OPENAI_LUNA_MODEL } = await import('../lib/openai-models');
  if (process.argv.includes('--refresh-texts')) {
    const previous = destination.replace('.json', '.previous.json');
    fs.copyFileSync(destination, previous);
    for (const person of result.people) { person.forecasts = {}; person.categoryPacks = {}; person.errors = {}; }
    save();
  }
  if (process.argv.includes('--refresh-natal')) {
    for (const person of result.people) { person.categoryPacks = {}; person.errors = {}; }
    save();
  }
  if (process.argv.includes('--refresh-extras')) {
    for (const person of result.people) { person.microForecasts = {}; person.futureForecasts = []; }
    save();
  }
  if (process.argv.includes('--refresh-forecasts')) {
    for (const person of result.people) person.forecasts = {};
    save();
  }
  const definitions = [
    { id: 'alina', name: 'Алина', birthDate: '1990-03-14', birthTime: '09:41', gender: 'female', birthTimeMode: 'exact' },
    { id: 'artem', name: 'Артём', birthDate: '1987-08-05', birthTime: '18:20', gender: 'male', birthTimeMode: 'exact' },
    { id: 'mira', name: 'Мира', birthDate: '2001-12-02', birthTime: '', gender: 'female', birthTimeMode: 'unknown' },
  ] as const;
  // Calculate new synthetic profiles only; never repair or recalculate stored user data.
  for (const definition of definitions) {
    if (result.people.some(person => person.id === definition.id)) continue;
    const profile: UserProfile = { ...definition, id: `ui-review-${definition.id}`, birthPlace: 'Москва, Россия', birthLatitude: 55.7558, birthLongitude: 37.6173, birthTimezone: 'Europe/Moscow', language: 'ru', theme: 'light', isSetup: true, isPremium: true, premiumUntil: '2099-12-31T23:59:59.000Z' };
    const chart = await calculateNatalChart(profile.name, profile.birthDate, profile.birthTime, profile.birthPlace, { coordinates: { lat: 55.7558, lon: 37.6173, timezone: 'Europe/Moscow' }, birthTimeMode: definition.birthTimeMode });
    result.people.push({ id: definition.id, profile, chart, forecasts: {}, categoryPacks: {}, errors: {} });
    save();
  }
  if (!extrasOnly) await Promise.all(result.people.map(async person => {
    const run = async (key: string, action: () => Promise<void>) => {
      console.log(`${person.id}: ${key} started`);
      try { await action(); delete person.errors[key]; console.log(`${person.id}: ${key} ready`); }
      catch (error) { person.errors[key] = error instanceof Error ? error.message.slice(0, 400) : 'Generation failed'; console.log(`${person.id}: ${key} failed: ${person.errors[key]}`); }
      save();
    };
    if (!person.categoryPacks.main) await run('main', async () => { person.categoryPacks.main = await generateNatalReportCategoryPack({ profile: person.profile, chart: person.chart, categoryKey: 'main' }); });
    for (const period of ['day', 'week', 'month'] as const) {
      if (process.argv.includes('--day-only') && period !== 'day') continue;
      if (person.forecasts[period]) continue;
      await run(period, async () => {
        const periodKey = getPersonalForecastPeriodKey(period, new Date('2026-09-08T12:00:00+03:00'), person.profile.birthTimezone || 'Europe/Moscow');
        person.forecasts[period] = await generatePersonalForecastPackage({ natal: person.chart, profile: person.profile, model: OPENAI_LUNA_MODEL, period, window: resolvePersonalForecastWindow(period, periodKey, person.profile.birthTimezone || 'Europe/Moscow') });
      });
    }
    if (person.categoryPacks.main) for (const categoryKey of ['character', 'love', 'communication', 'work', 'money'] as const) {
      if (person.categoryPacks[categoryKey]) continue;
      await run(categoryKey, async () => { person.categoryPacks[categoryKey] = await generateNatalReportCategoryPack({ profile: person.profile, chart: person.chart, categoryKey, mainAnchor: person.categoryPacks.main }); });
    }
  }));
  if (extrasOnly) {
    const { getPersonalForecastRawProfile } = await import('../lib/personalForecastContract');
    const { generatePersonalMicroForecastText, validateCopy } = await import('../lib/personalMicroForecastGeneration');
    const { generatePersonalFutureForecastText, copyErrors } = await import('../lib/personalFutureForecastGeneration');
    const { getPersonalFutureTimelineStops, PERSONAL_FUTURE_FORECAST_TOPICS } = await import('../lib/personalFutureForecastContract');
    const { generateSignFutureText } = await import('../lib/horoscope/signFutureGeneration');
    const stops = getPersonalFutureTimelineStops('2026-09-08');
    await Promise.all(result.people.map(async (person, personIndex) => {
      person.microForecasts ||= {};
      person.futureForecasts ||= [];
      for (const period of ['day', 'week', 'month'] as const) {
        const existing = person.microForecasts[period];
        if (existing && validateCopy(existing, [], 'ru').length) delete person.microForecasts[period];
      }
      person.futureForecasts = person.futureForecasts.filter(value => !copyErrors(value.text, [], 'ru').length);
      const profile = person.profile;
      const record = async (key: string, action: () => Promise<void>) => {
        console.log(`${person.id}: ${key} started`);
        try { await action(); delete person.errors[key]; console.log(`${person.id}: ${key} ready`); }
        catch (error) { person.errors[key] = error instanceof Error ? `${error.message}:${JSON.stringify((error as Error & { diagnostics?: string[] }).diagnostics || [])}`.slice(0, 400) : 'Generation failed'; console.log(`${person.id}: ${key} failed: ${person.errors[key]}`); }
        save();
      };
      for (const period of ['day', 'week', 'month'] as const) if (!person.microForecasts[period]) await record(`micro-${period}`, async () => {
        const main = person.forecasts[period];
        if (!main) throw new Error('Main sample required');
        const history = Object.values(person.microForecasts!).flatMap(value => value?.topics.flatMap(topic => [topic.teaser, topic.text]) || []);
        person.microForecasts![period] = await generatePersonalMicroForecastText({ userId: person.profile.id!, profile, period, periodKey: main.periodKey, accessTier: 'premium' },
          { natal: person.chart, window: resolvePersonalForecastWindow(period, main.periodKey, profile.birthTimezone) },
          [main.overview.title || '', main.overview.text, ...main.sections.map(section => section.text)], main.evidence, history);
      });
      // Every topic for each person; day/week/month rotate across the three profiles.
      for (const [index, topic] of PERSONAL_FUTURE_FORECAST_TOPICS.entries()) {
        const period = (['day', 'week', 'month'] as const)[(personIndex + index) % 3];
        const selection = stops.find(stop => stop.period === period)!;
        if (person.futureForecasts.some(value => value.topic === topic && value.period === period && value.date === selection.date)) continue;
        await record(`future-${period}-${topic}`, async () => {
          const start = resolvePersonalForecastWindow(period === 'week' ? 'day' : period, period === 'month' ? selection.date.slice(0, 7) : selection.date, profile.birthTimezone);
          const end = selection.endDate ? resolvePersonalForecastWindow('day', selection.endDate, profile.birthTimezone) : start;
          const window = { ...start, period, periodEnd: selection.endDate || start.periodEnd, endsAt: end.endsAt, validTo: end.validTo };
          person.futureForecasts!.push(await generatePersonalFutureForecastText({ userId: person.profile.id!, profile, accessTier: 'premium', ...selection, topic },
            { natal: person.chart, window, profileHash: `fictional-${person.id}` }, person.futureForecasts!, {}));
        });
      }
    }));
    // Three signs, every future topic, using the same DeepSeek writer and Swiss sky digest.
    if (process.env.DEEPSEEK_API_KEY) await Promise.all((['Pisces', 'Leo', 'Sagittarius'] as const).map(async (sign, signIndex) => {
      for (const [index, topic] of PERSONAL_FUTURE_FORECAST_TOPICS.entries()) {
        const period = (['day', 'week', 'month'] as const)[(signIndex + index) % 3];
        const selection = stops.find(stop => stop.period === period)!;
        if (result.zodiacFuture!.some(value => value.sign === sign && value.topic === topic && value.period === period && value.date === selection.date)) continue;
        console.log(`${sign}: zodiac-${topic} started`);
        try { result.zodiacFuture!.push(await generateSignFutureText({ ...selection, sign, topic, language: 'ru' }, result.zodiacFuture!.filter(value => value.sign === sign))); console.log(`${sign}: zodiac-${topic} ready`); }
        catch (error) { console.log(`${sign}: zodiac-${topic} failed: ${error instanceof Error ? error.message : 'Generation failed'}`); }
        save();
      }
    }));
    else console.log('DeepSeek samples unavailable: DEEPSEEK_API_KEY is not configured locally.');
  }
  console.log(JSON.stringify(result.people.map(p => ({ id: p.id, forecasts: Object.keys(p.forecasts), chapters: Object.keys(p.categoryPacks), errors: p.errors }))));
  const lines = ['# NEBO — три примера чтения', '', 'Вымышленные люди. Тексты получены через текущие генераторы Luna, без ручной подмены ответов. Прогнозы относятся к 8 сентября 2026 года, неделе и сентябрю. Натальные схемы рассчитаны Swiss Ephemeris; на этой Windows-машине для примеров использован Python-модуль, а не отсутствующий нативный Node-модуль. Приложение при обычном чтении использует сохранённые данные.', ''];
  for (const person of result.people) {
    lines.push(`## ${person.profile.name}`, '', `${person.profile.birthDate} · ${person.profile.birthTime || 'время неизвестно'} · ${person.profile.birthPlace}`, '');
    for (const period of ['day', 'week', 'month'] as const) {
      const forecast = person.forecasts[period];
      lines.push(`### ${{ day: 'Сегодня', week: 'Неделя', month: 'Месяц' }[period]}`, '');
      if (forecast) lines.push(`**${forecast.overview.title}**`, '', forecast.overview.text, '', ...forecast.sections.flatMap(section => [section.text, '']));
      else lines.push('Генерация не завершена.', '');
    }
    for (const categoryKey of ['main', 'character', 'love', 'communication', 'work', 'money'] as const) {
      const pack = person.categoryPacks[categoryKey];
      lines.push(`### ${{ main: 'Коротко о тебе', character: 'Характер', love: 'Любовь', communication: 'Общение', work: 'Работа', money: 'Деньги' }[categoryKey]}`, '');
      if (pack) for (const paragraph of pack.summary) lines.push(`**${paragraph.title || ''}**`, '', paragraph.text, '', `Основания: ${paragraph.evidenceIds.join(', ')}`, '');
      else lines.push('Генерация не завершена.', '');
      if (pack?.followUps) lines.push(...pack.followUps.map(item => `- ${item.label} → ${item.categoryKey}`), '');
    }
    lines.push('### Дополнительные карточки', '');
    for (const [period, pack] of Object.entries(person.microForecasts || {})) for (const topic of pack.topics) lines.push(`**${period} · ${topic.id} — ${topic.teaser}**`, '', topic.text, '');
    lines.push('### Будущее · Premium', '');
    for (const forecast of person.futureForecasts || []) lines.push(`**${forecast.date}${forecast.endDate ? ` — ${forecast.endDate}` : ''} · ${forecast.period} · ${forecast.topic}**`, '', forecast.text, '');
  }
  lines.push('## Зодиак · будущее · DeepSeek · Premium', '');
  for (const forecast of result.zodiacFuture || []) lines.push(`### ${forecast.sign} · ${forecast.topic} · ${forecast.date} · ${forecast.period}`, '', `**${forecast.headline}**`, '', forecast.text, '');
  fs.writeFileSync(destination.replace('.json', '.md'), lines.join('\n'));
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Sample generation failed'); process.exitCode = 1; });
