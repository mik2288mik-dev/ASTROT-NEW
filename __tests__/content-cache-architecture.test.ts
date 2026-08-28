import fs from 'fs';
import path from 'path';
import { APP_VOICE_VERSION } from '../lib/appVoice';
import { getDefaultCacheKeyForContent } from '../lib/contentArchitecture';
import {
  getMoscowIsoWeekKey,
  getMoscowMonthKey,
  getMoscowTodayKey,
} from '../lib/date-utils';
import {
  NATAL_ANCHOR_CACHE_KEY,
  NATAL_FULL_CACHE_KEY,
  getCurrentNatalPeriodKey,
  buildNatalLivingCacheKey,
} from '../lib/natalReadings';
import { buildPlanetInsightCacheKey } from '../lib/natalPlanetMeta';
import { buildSynastryExtendedCacheKey } from '../lib/synastryExtended';
import {
  listContentAccessMatrix,
  getContentAccessConfig,
} from '../lib/contentAccessMatrix';
import { PREMIUM_CONTENT_PREWARM_STATUS } from '../lib/premiumContentPrewarm';

const ROOT = path.resolve(__dirname, '..');

const STATIC_PERSISTENT: Array<{ surface: string; variant: string }> = [
  { surface: 'natal', variant: 'anchor' },
  { surface: 'natal', variant: 'full' },
  { surface: 'natal', variant: 'planet_insight' },
  { surface: 'synastry', variant: 'brief' },
  { surface: 'synastry', variant: 'full' },
];

const DAILY_PERIODIC: Array<{ surface: string; variant: string }> = [
  { surface: 'forecast', variant: 'daily' },
  { surface: 'forecast', variant: 'weekly' },
  { surface: 'forecast', variant: 'monthly' },
];

const TODAY = getMoscowTodayKey();
const ISO_WEEK = getMoscowIsoWeekKey();
const MONTH = getMoscowMonthKey();

function readApiSource(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function assertNoGenerationBefore(source: string, generateCall: string) {
  const generateIdx = source.indexOf(`await ${generateCall}`);
  expect(generateIdx).toBeGreaterThan(-1);
  const getIdx = source.indexOf("if (req.method === 'GET')");
  expect(getIdx).toBeGreaterThan(-1);
  expect(getIdx).toBeLessThan(generateIdx);
  expect(source.slice(getIdx, generateIdx)).not.toContain(`await ${generateCall}`);
}

describe('content cache architecture', () => {
  describe('static natal interpretations are persistent', () => {
    it('marks static layers as persist calculation + interpretation', () => {
      for (const { surface, variant } of STATIC_PERSISTENT) {
        const config = getContentAccessConfig(surface as any, variant as any);
        expect(config?.shouldPersistInterpretation).toBe(true);
        expect(config?.shouldPersistCalculation).toBe(true);
      }
    });

    it('uses non-date cache keys for natal anchor and full', () => {
      expect(NATAL_ANCHOR_CACHE_KEY).toBe(`base:voice:${APP_VOICE_VERSION}`);
      expect(NATAL_FULL_CACHE_KEY).toBe(`personality:voice:${APP_VOICE_VERSION}`);
      expect(NATAL_ANCHOR_CACHE_KEY).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(NATAL_FULL_CACHE_KEY).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(getDefaultCacheKeyForContent('natal', 'anchor')).toBe('base');
      expect(getDefaultCacheKeyForContent('natal', 'full')).toBe('personality');
    });

    it('scopes planet insight by planet and calculation version', () => {
      const key = buildPlanetInsightCacheKey('venus', 'ru', 'calc-v1');
      expect(key).toMatch(/^planet:venus:/);
      expect(key).toContain(`:voice:${APP_VOICE_VERSION}`);
      expect(key).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('forecast interpretations are date or period scoped', () => {
    it('marks forecast layers as persist interpretation', () => {
      for (const { surface, variant } of DAILY_PERIODIC) {
        const config = getContentAccessConfig(surface as any, variant as any);
        expect(config?.shouldPersistInterpretation).toBe(true);
      }
    });

    it('uses date and period cache keys', () => {
      expect(getDefaultCacheKeyForContent('forecast', 'daily')).toBe(TODAY);
      expect(getDefaultCacheKeyForContent('forecast', 'weekly')).toBe(ISO_WEEK);
      expect(getDefaultCacheKeyForContent('forecast', 'monthly')).toBe(MONTH);
    });
  });

  describe('natal living period key', () => {
    it('versions the generated living cache key without changing the base period key', () => {
      const periodKey = getCurrentNatalPeriodKey();
      expect(buildNatalLivingCacheKey(periodKey)).toBe(`${periodKey}:voice:${APP_VOICE_VERSION}`);
      expect(getDefaultCacheKeyForContent('natal', 'living')).toBe(periodKey);
    });
  });

  describe('content prewarm must be non-blocking and deduplicated', () => {
    it('documents prewarm as implemented', () => {
      expect(PREMIUM_CONTENT_PREWARM_STATUS).toBe('implemented');
      const doc = fs.readFileSync(path.join(ROOT, 'docs/CONTENT_CACHE_AND_PREWARM.md'), 'utf8');
      expect(doc).toContain('Client requests are deduplicated');
      expect(doc).toContain('Startup never awaits model generation');
    });
  });

  describe('no static premium layer uses daily cacheKey in APIs', () => {
    it('natal full and anchor APIs use stable cache constants', () => {
      const anchor = readApiSource('pages/api/content/natal/anchor.ts');
      const full = readApiSource('pages/api/content/natal/full.ts');
      expect(anchor).toContain('NATAL_ANCHOR_CACHE_KEY');
      expect(full).toContain('NATAL_FULL_CACHE_KEY');
      expect(anchor).not.toMatch(/cacheKey:\s*getMoscowTodayKey\(\)/);
      expect(full).not.toMatch(/cacheKey:\s*getMoscowTodayKey\(\)/);
    });

    it('synastry extended uses stable pair hash, not date key', () => {
      const key = buildSynastryExtendedCacheKey('u1', 1, 2, 'Alex', '1990-01-01', 'романтика', 'ru');
      expect(key).toHaveLength(64);
      expect(key).not.toMatch(/^\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('no repeated generation on GET if interpretation exists', () => {
    it('personal forecast GET only reads the canonical V3 cache', () => {
      const source = readApiSource('pages/api/content/forecast/personal.ts');
      assertNoGenerationBefore(source, 'ensurePersonalForecast');
      expect(source).toContain('getCachedPersonalForecast');
      expect(source).toContain("code: 'PERSONAL_FORECAST_NOT_READY'");
      expect(source).toContain('return res.status(404).json');
      expect(source).toContain('slicePersonalForecastForAccess');
      expect(source).toContain('lockedSectionIds');
      expect(source).toContain('periodLocked');
      expect(source).not.toContain('lockedTopicKeys');
    });

    it('natal anchor GET does not call generateNatalAnchorReading', () => {
      const source = readApiSource('pages/api/content/natal/anchor.ts');
      assertNoGenerationBefore(source, 'generateNatalAnchorReading');
    });

    it('natal full GET does not call generateNatalFullReading', () => {
      const source = readApiSource('pages/api/content/natal/full.ts');
      assertNoGenerationBefore(source, 'generateNatalFullReading');
    });

    it('planet insight GET does not call generatePlanetInsight', () => {
      const source = readApiSource('pages/api/content/natal/planet-insight.ts');
      assertNoGenerationBefore(source, 'generatePlanetInsight');
    });
  });

  describe('natal chart persistence policy', () => {
    it('documents invalidation on birth data change', () => {
      const dbSource = readApiSource('lib/db.ts');
      expect(dbSource).toContain('DELETE FROM content_interpretations WHERE chart_id');
      expect(dbSource).toContain('Invalidated cached interpretations after primary chart input change');
    });

    it('primary chart flow uses input hash cache before recalculating', () => {
      const api = readApiSource('pages/api/charts/index.ts');
      const persistence = readApiSource('lib/natalChartPersistence.ts');
      expect(api).toContain('ensureCanonicalPrimaryChart');
      expect(persistence).toContain('findByInputHash');
    });
  });

  describe('content access matrix registry', () => {
    it('indexes all product layers used in cache policy', () => {
      const matrix = listContentAccessMatrix();
      const keys = matrix.map((e) => `${e.surface}:${e.variant}`);
      for (const { surface, variant } of [...STATIC_PERSISTENT, ...DAILY_PERIODIC, { surface: 'natal', variant: 'living' }]) {
        expect(keys).toContain(`${surface}:${variant}`);
      }
    });
  });
});
