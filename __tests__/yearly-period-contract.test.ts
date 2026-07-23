import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { buildContentCacheKey, getContentAccess, getContentPolicy } from '../lib/contentMatrix';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('yearly period without Dashboard redesign', () => {
  it('uses the shared sign-year-language cache and existing Dashboard cards after an explicit click', () => {
    expect(getContentPolicy('sign_yearly')).toMatchObject({
      modelTier: 'fast',
      words: { min: 0, max: 170 },
      cacheScope: 'shared',
      generationPolicy: 'explicit_only',
    });
    expect(getContentAccess('sign_yearly').tier).toBe('free');
    expect(buildContentCacheKey('sign_yearly', {
      zodiacSign: 'Leo',
      periodKey: '2026',
      contentKey: 'en',
    })).toBe('sign_yearly|en|period:2026|sign:leo');

    const generator = read('lib/horoscope/signYearly.ts');
    const endpoint = read('pages/api/content/horoscope/sign-yearly.ts');
    const service = read('services/astrologyService.ts');
    const dashboard = read('views/Dashboard.tsx');
    const generationLock = read('lib/contentGenerationLock.ts');

    expect(generator).toContain('ForecastDailyReading');
    expect(generator).toContain("content_type = 'sign_yearly'");
    expect(generator).toContain("VALUES ('sign_yearly'");
    expect(generator).toContain('buildSignYearlyHoroscopePrompt');
    expect(generator).toContain('Это общий разбор для твоего знака. Личная картина начинается с натальной карты.');
    expect(generator).not.toMatch(/CREATE\s+TABLE|ALTER\s+TABLE/i);
    expect(endpoint).toContain('withContentGenerationLock');
    expect(generationLock).toContain("export type ContentGenerationVariant = ContentVariant | 'yearly'");
    expect(endpoint).toContain('getCachedSignYearlyHoroscope');
    expect(endpoint).toContain('getOrGenerateSignYearlyHoroscope');
    expect(service).toContain('getCachedYearlySignHoroscope');
    expect(service).toContain('ensureYearlySignHoroscope');
    expect(service).toContain('signYearlyClientCache');
    expect(dashboard).toContain("if (period !== 'today') void loadPeriod(period);");
    expect(dashboard).toContain('getCachedYearlySignHoroscope');
    expect(dashboard).toContain('ensureYearlySignHoroscope');
    expect(dashboard).toContain('home-day-hero');
    expect(dashboard).toContain('home-sphere-card');
    expect(read('lib/migrations.ts')).not.toContain('sign_yearly');

    const changedFiles = execFileSync('git', ['diff', '--name-only'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim().split(/\r?\n/).filter(Boolean);
    expect(changedFiles.some((file) => file.endsWith('.css'))).toBe(false);
  });
});
