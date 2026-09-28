import fs from 'node:fs';
import path from 'node:path';
import type { UserProfile } from '../types';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';
import { buildNatalInterpretation } from '../lib/natalInterpretation';
import {
  buildNatalUnifiedWriterPlan,
  materializeNatalUnifiedReading,
} from '../lib/natalReading/unifiedGeneration';
import {
  adaptUnifiedToLegacyCatalogAnswer,
  adaptUnifiedToLegacyCatalogCategory,
  adaptUnifiedToLegacyFreeReport,
  adaptUnifiedToLegacyHumanSection,
  adaptUnifiedToLegacyPremiumReport,
  legacyEvidenceAlias,
  withLegacyNatalEvidenceAliases,
} from '../lib/natalReading/legacyCompatibility';
import {
  isNatalPermanentFreeReport,
  isNatalPermanentPremiumReport,
} from '../lib/natalReading/permanentReport';
import {
  isNatalReportAnswer,
  isNatalReportCategoryPack,
  NATAL_REPORT_ANSWER_KEYS,
  NATAL_REPORT_CATEGORY_KEYS,
} from '../lib/natalReading/reportCatalog';
import { HUMAN_PAID_SECTION_KEYS } from '../lib/natalHumanShared';

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function fixture() {
  const chart = canonicalNatalChart();
  const interpretation = buildNatalInterpretation(chart, 'ru');
  const plan = buildNatalUnifiedWriterPlan(interpretation, 'premium');
  const text = 'Обычно ты сначала разбираешься в деталях, сравниваешь варианты и только потом выбираешь понятный способ действовать без лишней суеты.';
  const raw = {
    story: plan.story.map((block) => ({
      id: block.id,
      text,
      meaning_ids: [...block.meaningIds],
    })),
    topics: plan.topics.map((topic) => ({
      key: topic.key,
      title: topic.title,
      blocks: topic.blocks.map((block) => ({
        id: block.id,
        text,
        meaning_ids: [...block.meaningIds],
      })),
    })),
  };
  const materialized = materializeNatalUnifiedReading({
    raw,
    interpretation,
    tier: 'premium',
    plan,
  });
  if (!materialized.reading) {
    throw new Error(materialized.errors.join('; '));
  }
  const profile = {
    id: 'legacy-compat-test',
    name: 'Алина',
    birthDate: chart.birth.localDate,
    birthTime: chart.birth.localTime,
    birthPlace: chart.birth.place,
    language: 'ru',
    isPremium: true,
    isSetup: true,
    theme: 'light',
  } as UserProfile;
  return { chart, profile, reading: materialized.reading };
}

describe('legacy natal compatibility uses the unified reading only', () => {
  it('projects the unified reading into old human report contracts', () => {
    const { chart, profile, reading } = fixture();
    const free = adaptUnifiedToLegacyFreeReport({ chart, profile, reading });
    const premium = adaptUnifiedToLegacyPremiumReport({ chart, profile, reading });

    expect(isNatalPermanentFreeReport(free)).toBe(true);
    expect(isNatalPermanentPremiumReport(premium)).toBe(true);
    expect(free.freeSections.length).toBeGreaterThan(0);
    expect(premium.sections.some((section) => section.id === 'relationships')).toBe(true);
    expect(premium.sections.some((section) => section.id === 'work')).toBe(true);
  });

  it('projects every old catalog category and answer into the old validator shapes', () => {
    const { chart, profile, reading } = fixture();

    for (const categoryKey of NATAL_REPORT_CATEGORY_KEYS) {
      const category = adaptUnifiedToLegacyCatalogCategory({
        chart,
        profile,
        reading,
        categoryKey,
      });
      expect(isNatalReportCategoryPack(category)).toBe(true);
    }

    for (const answerKey of NATAL_REPORT_ANSWER_KEYS) {
      const answer = adaptUnifiedToLegacyCatalogAnswer({
        chart,
        profile,
        reading,
        answerKey,
      });
      expect(isNatalReportAnswer(answer)).toBe(true);
    }
  });

  it('projects every old paid human section without invoking the old semantic compiler', () => {
    const { chart, profile, reading } = fixture();

    for (const sectionKey of HUMAN_PAID_SECTION_KEYS) {
      const section = adaptUnifiedToLegacyHumanSection({
        chart,
        profile,
        reading,
        sectionKey,
      });
      expect(section.key).toBe(sectionKey);
      expect(section.content.length).toBeGreaterThan(0);
      expect(section.evidenceIds?.length).toBeGreaterThan(0);
    }
  });

  it('keeps modern evidence ids and adds aliases understood by the published client', () => {
    expect(legacyEvidenceAlias('position:sun:sign')).toBe('natal.position.sun');
    expect(legacyEvidenceAlias('position:moon:house')).toBe('natal.position.moon');
    expect(legacyEvidenceAlias('angle:ascendant:sign')).toBe('natal.angle.ascendant');
    expect(legacyEvidenceAlias('house:1:cusp')).toBe('natal.house.1');
    expect(legacyEvidenceAlias('aspect:sun-square-moon')).toBe('natal.aspect.sun-square-moon');

    expect(withLegacyNatalEvidenceAliases([
      'position:sun:sign',
      'angle:ascendant:sign',
    ])).toEqual([
      'position:sun:sign',
      'natal.position.sun',
      'angle:ascendant:sign',
      'natal.angle.ascendant',
    ]);
  });

  it('routes all published legacy endpoints away from legacy generators', () => {
    for (const endpoint of [
      'pages/api/content/natal/human-base.ts',
      'pages/api/content/natal/human-premium.ts',
      'pages/api/content/natal/human-section.ts',
      'pages/api/content/natal/catalog.ts',
      'pages/api/content/natal/catalog-answer.ts',
    ]) {
      const code = source(endpoint);
      expect(code).toContain('loadUnifiedReadingForLegacyEndpoint');
      expect(code).toContain('natal_unified_compat_v1');
      expect(code).not.toContain('permanentApi');
      expect(code).not.toContain('natalHumanInterpretation');
      expect(code).not.toContain('reportCatalogApi');
      expect(code).not.toContain('reportCatalogGeneration');
    }
  });

  it('keeps Ask on unified meanings while exposing legacy evidence aliases', () => {
    const questions = source('pages/api/content/natal/questions.ts');
    expect(questions).toContain('withLegacyNatalEvidenceAliases(answer.evidenceIds)');
    expect(questions).not.toContain('getCachedPermanentPremiumReport');
  });
});
