#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one occurrence, found {count}: {old[:100]!r}")
    write(path, content.replace(old, new, 1))


READING_VARIANT = r'''export type NatalReadingVariant = 'auto' | 'catalog' | 'classic';
export type NatalReadingRenderer = Exclude<NatalReadingVariant, 'auto'>;

export const NATAL_READING_VARIANT_EVENT = 'nebo:natal-reading-variant-change';

const STORAGE_PREFIX = 'nebo:admin:natal-reading-variant:v1';
const DEFAULT_VARIANT: NatalReadingVariant = 'auto';

export type NatalReadingVariantStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

type NatalReadingVariantEventDetail = {
  userId: string;
  variant: NatalReadingVariant;
};

export function isNatalReadingVariant(value: unknown): value is NatalReadingVariant {
  return value === 'auto' || value === 'catalog' || value === 'classic';
}

function ownerKey(userId: unknown): string {
  return String(userId ?? '').trim();
}

function storageKey(userId: unknown): string {
  return `${STORAGE_PREFIX}:${encodeURIComponent(ownerKey(userId))}`;
}

function browserStorage(): NatalReadingVariantStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readNatalReadingVariant(
  userId: unknown,
  isAdmin: boolean,
  storage: NatalReadingVariantStorage | null = browserStorage(),
): NatalReadingVariant {
  if (!isAdmin) return DEFAULT_VARIANT;
  const owner = ownerKey(userId);
  if (!owner || !storage) return DEFAULT_VARIANT;
  try {
    const stored = storage.getItem(storageKey(owner));
    return isNatalReadingVariant(stored) ? stored : DEFAULT_VARIANT;
  } catch {
    return DEFAULT_VARIANT;
  }
}

export function writeNatalReadingVariant(
  userId: unknown,
  isAdmin: boolean,
  variant: NatalReadingVariant,
  storage: NatalReadingVariantStorage | null = browserStorage(),
): NatalReadingVariant {
  if (!isAdmin || !isNatalReadingVariant(variant)) return DEFAULT_VARIANT;
  const owner = ownerKey(userId);
  if (!owner) return DEFAULT_VARIANT;
  try {
    storage?.setItem(storageKey(owner), variant);
  } catch {
    // The switch remains active for the current React session when storage is unavailable.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<NatalReadingVariantEventDetail>(
      NATAL_READING_VARIANT_EVENT,
      { detail: { userId: owner, variant } },
    ));
  }
  return variant;
}

export function subscribeNatalReadingVariant(
  userId: unknown,
  isAdmin: boolean,
  listener: (variant: NatalReadingVariant) => void,
): () => void {
  if (typeof window === 'undefined' || !isAdmin) return () => undefined;
  const owner = ownerKey(userId);
  if (!owner) return () => undefined;
  const key = storageKey(owner);
  const onVariant = (event: Event) => {
    const detail = (event as CustomEvent<NatalReadingVariantEventDetail>).detail;
    if (detail?.userId === owner && isNatalReadingVariant(detail.variant)) {
      listener(detail.variant);
    }
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === key && isNatalReadingVariant(event.newValue)) {
      listener(event.newValue);
    }
  };
  window.addEventListener(NATAL_READING_VARIANT_EVENT, onVariant);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(NATAL_READING_VARIANT_EVENT, onVariant);
    window.removeEventListener('storage', onStorage);
  };
}

export function resolveNatalReadingRenderer(
  variant: NatalReadingVariant,
  catalogCached: boolean,
): NatalReadingRenderer {
  if (variant === 'catalog') return 'catalog';
  if (variant === 'classic') return 'classic';
  return catalogCached ? 'catalog' : 'classic';
}
'''

VARIANT_SETTINGS = r'''import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import type { UserProfile } from '../../types';
import {
  readNatalReadingVariant,
  subscribeNatalReadingVariant,
  writeNatalReadingVariant,
  type NatalReadingVariant,
} from '../../lib/natalReading/readingVariant';

type Props = {
  profile: Pick<UserProfile, 'id' | 'isAdmin' | 'language'>;
};

const OPTIONS: ReadonlyArray<{
  value: NatalReadingVariant;
  ru: string;
  en: string;
}> = [
  { value: 'auto', ru: 'Авто — безопасный режим', en: 'Auto — safe mode' },
  { value: 'catalog', ru: 'Новый разбор', en: 'New reading' },
  { value: 'classic', ru: 'Старый разбор', en: 'Classic reading' },
];

export const NatalReadingVariantSettings: React.FC<Props> = ({ profile }) => {
  const isAdmin = profile.isAdmin === true;
  const [variant, setVariant] = useState<NatalReadingVariant>(() => (
    readNatalReadingVariant(profile.id, isAdmin)
  ));

  useEffect(() => {
    setVariant(readNatalReadingVariant(profile.id, isAdmin));
    return subscribeNatalReadingVariant(profile.id, isAdmin, (next) => setVariant(next));
  }, [isAdmin, profile.id]);

  if (!isAdmin) return null;
  const language = profile.language === 'en' ? 'en' : 'ru';

  return (
    <div className="settings-natal-variant">
      <p className="settings-detail-intro">
        {language === 'en' ? 'Natal reading version' : 'Версия разбора натальной карты'}
      </p>
      <div
        className="settings-selection-list"
        role="radiogroup"
        aria-label={language === 'en' ? 'Natal reading version' : 'Версия разбора натальной карты'}
      >
        {OPTIONS.map((option) => {
          const selected = option.value === variant;
          return (
            <button
              key={option.value}
              type="button"
              className="settings-selection-row"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                const next = writeNatalReadingVariant(profile.id, true, option.value);
                setVariant(next);
              }}
            >
              <span>{option[language]}</span>
              {selected ? <Check aria-hidden size={16} strokeWidth={2} /> : null}
            </button>
          );
        })}
      </div>
      <p className="settings-helper-text settings-helper-text--spaced">
        {language === 'en'
          ? 'Auto opens the new reading only when it is already ready; otherwise the stable classic reading opens immediately. This setting affects only this administrator on this device.'
          : 'Авто открывает новый разбор, только когда он уже готов. Иначе сразу открывается стабильный старый. Настройка действует только для этого администратора на этом устройстве.'}
      </p>
    </div>
  );
};
'''

VARIANT_TEST = r'''import {
  readNatalReadingVariant,
  resolveNatalReadingRenderer,
  writeNatalReadingVariant,
  type NatalReadingVariantStorage,
} from '../lib/natalReading/readingVariant';

function memoryStorage(): NatalReadingVariantStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe('admin natal reading variant', () => {
  it('always keeps non-admin users in safe auto mode', () => {
    const storage = memoryStorage();
    expect(writeNatalReadingVariant('user-1', false, 'catalog', storage)).toBe('auto');
    expect(readNatalReadingVariant('user-1', false, storage)).toBe('auto');
    expect(storage.values.size).toBe(0);
  });

  it('stores an admin choice separately for every user', () => {
    const storage = memoryStorage();
    expect(writeNatalReadingVariant('admin-1', true, 'catalog', storage)).toBe('catalog');
    expect(writeNatalReadingVariant('admin-2', true, 'classic', storage)).toBe('classic');
    expect(readNatalReadingVariant('admin-1', true, storage)).toBe('catalog');
    expect(readNatalReadingVariant('admin-2', true, storage)).toBe('classic');
    expect(readNatalReadingVariant('admin-3', true, storage)).toBe('auto');
  });

  it('uses classic as the auto fallback and catalog only when it is ready', () => {
    expect(resolveNatalReadingRenderer('auto', false)).toBe('classic');
    expect(resolveNatalReadingRenderer('auto', true)).toBe('catalog');
    expect(resolveNatalReadingRenderer('catalog', false)).toBe('catalog');
    expect(resolveNatalReadingRenderer('classic', true)).toBe('classic');
  });
});
'''

UI_CONTRACT_TEST = r'''import fs from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('natal reading variant UI contract', () => {
  it('keeps the switch inside the admin-only developer settings screen', () => {
    const settings = source('views/Settings.tsx');
    const component = source('components/NatalReading/NatalReadingVariantSettings.tsx');
    expect(settings).toContain("case 'developer':");
    expect(settings).toContain('<NatalReadingVariantSettings profile={profile} />');
    expect(component).toContain('if (!isAdmin) return null;');
    expect(component).toContain("value: 'auto'");
    expect(component).toContain("value: 'catalog'");
    expect(component).toContain("value: 'classic'");
  });

  it('renders classic, forced catalog and cache-aware auto without a mid-reading swap', () => {
    const magazine = source('views/v2/NatalMagazine.tsx');
    expect(magazine).toContain("resolveNatalReadingRenderer(readingVariant, Boolean(cached))");
    expect(magazine).toContain("readingVariant === 'auto' && !cached && userId");
    expect(magazine).toContain('void ensureNatalCatalogCategory(');
    expect(magazine).toContain("readingRenderer === 'catalog'");
    expect(magazine).toContain('surface="reading"');
    expect(magazine).not.toContain('.then(() => setReadingRenderer');
  });
});
'''

CATALOG_DIAGNOSTICS_TEST = r'''import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.join(process.cwd(), 'lib/natalReading/reportCatalogGeneration.ts'),
  'utf8',
);

describe('natal catalog semantic repair diagnostics', () => {
  it('uses three semantic attempts and field-specific safe issue codes', () => {
    expect(source).toContain('const NATAL_REPORT_SEMANTIC_ATTEMPTS = 3;');
    expect(source).toContain("'PERSONALITY_COPY'");
    expect(source).toContain("'CATALOG_COPY'");
    expect(source).toContain("'RELIABILITY'");
    expect(source).toContain('COPY_VIOLATION:${path}:${kind}');
    expect(source).toContain('free_answers[${answerIndex}].paragraphs[${paragraphIndex}]');
  });

  it('logs only identifiers and issue codes and explains every repair class', () => {
    expect(source).toContain("'[natal/catalog-validation]'");
    expect(source).toContain('semanticAttempt: attempt');
    expect(source).toContain('responseId: result.responseId');
    expect(source).toContain('PERSONALITY_COPY means');
    expect(source).toContain('CATALOG_COPY means');
    expect(source).toContain('RELIABILITY means');
    expect(source).not.toContain('generatedText:');
    expect(source).not.toContain('birthData: input.profile');
  });
});
'''

write('lib/natalReading/readingVariant.ts', READING_VARIANT)
write('components/NatalReading/NatalReadingVariantSettings.tsx', VARIANT_SETTINGS)
write('__tests__/natal-reading-variant.test.ts', VARIANT_TEST)
write('__tests__/natal-reading-variant-ui-contract.test.ts', UI_CONTRACT_TEST)
write('__tests__/natal-catalog-repair-diagnostics.test.ts', CATALOG_DIAGNOSTICS_TEST)

# Settings: one imported component and one render point in the existing admin-only developer screen.
replace_once(
    'views/Settings.tsx',
    "import { meetsMinimumPasswordLength } from '../lib/auth/passwordPolicy';\n",
    "import { meetsMinimumPasswordLength } from '../lib/auth/passwordPolicy';\n"
    "import { NatalReadingVariantSettings } from '../components/NatalReading/NatalReadingVariantSettings';\n",
)
replace_once(
    'views/Settings.tsx',
    "                    <section className=\"settings-detail-panel\" aria-label={settingsTitle.developer}>\n"
    "                        {onOpenAdmin ? (\n",
    "                    <section className=\"settings-detail-panel\" aria-label={settingsTitle.developer}>\n"
    "                        <NatalReadingVariantSettings profile={profile} />\n"
    "                        {onOpenAdmin ? (\n",
)

# NatalMagazine: freeze the selected renderer for one visit to the reading tab.
replace_once(
    'views/v2/NatalMagazine.tsx',
    "import { buildNatalChartFingerprint } from '../../lib/natalChartFingerprint';\n",
    "import { buildNatalChartFingerprint } from '../../lib/natalChartFingerprint';\n"
    "import { NATAL_REPORT_CATALOG_CONTRACT_VERSION } from '../../lib/natalReading/reportCatalog';\n"
    "import {\n"
    "  ensureNatalCatalogCategory,\n"
    "  getNatalCatalogCategoryCached,\n"
    "} from '../../services/natalCatalogService';\n"
    "import {\n"
    "  readNatalReadingVariant,\n"
    "  resolveNatalReadingRenderer,\n"
    "  subscribeNatalReadingVariant,\n"
    "  type NatalReadingRenderer,\n"
    "  type NatalReadingVariant,\n"
    "} from '../../lib/natalReading/readingVariant';\n",
)
replace_once(
    'views/v2/NatalMagazine.tsx',
    "  const previewConfig = process.env.NODE_ENV === 'development'\n"
    "    && process.env.NEXT_PUBLIC_UI_PREVIEW === '1'\n"
    "      ? uiPreview\n"
    "      : undefined;\n"
    "  const [activeTab, setActiveTab] = useState<NatalScreenTab>(() => (\n",
    "  const previewConfig = process.env.NODE_ENV === 'development'\n"
    "    && process.env.NEXT_PUBLIC_UI_PREVIEW === '1'\n"
    "      ? uiPreview\n"
    "      : undefined;\n"
    "  const catalogCacheIdentity = useMemo(() => data ? ({\n"
    "    chartFingerprint: buildNatalChartFingerprint(data),\n"
    "    reportVersion: NATAL_REPORT_CATALOG_CONTRACT_VERSION,\n"
    "  }) : null, [data]);\n"
    "  const [readingVariant, setReadingVariant] = useState<NatalReadingVariant>(() => (\n"
    "    readNatalReadingVariant(profile.id, profile.isAdmin === true)\n"
    "  ));\n"
    "  const [readingRenderer, setReadingRenderer] = useState<NatalReadingRenderer>(() => {\n"
    "    if (previewConfig?.catalog) return 'catalog';\n"
    "    if (!data || !catalogCacheIdentity) return 'classic';\n"
    "    const userId = String(profile.id || '').trim();\n"
    "    const cached = userId ? getNatalCatalogCategoryCached(\n"
    "      userId,\n"
    "      'main',\n"
    "      chartId,\n"
    "      language,\n"
    "      catalogCacheIdentity,\n"
    "    ) : null;\n"
    "    return resolveNatalReadingRenderer(\n"
    "      readNatalReadingVariant(profile.id, profile.isAdmin === true),\n"
    "      Boolean(cached),\n"
    "    );\n"
    "  });\n"
    "  const [activeTab, setActiveTab] = useState<NatalScreenTab>(() => (\n",
)
replace_once(
    'views/v2/NatalMagazine.tsx',
    "  useEffect(() => {\n"
    "    if (normalizedActiveTab !== activeTab) setActiveTab(normalizedActiveTab);\n"
    "  }, [activeTab, normalizedActiveTab]);\n\n"
    "  useEffect(() => {\n"
    "    if (\n"
    "      !openQuestionRequest\n",
    "  useEffect(() => {\n"
    "    if (normalizedActiveTab !== activeTab) setActiveTab(normalizedActiveTab);\n"
    "  }, [activeTab, normalizedActiveTab]);\n\n"
    "  useEffect(() => {\n"
    "    const isAdmin = profile.isAdmin === true;\n"
    "    setReadingVariant(readNatalReadingVariant(profile.id, isAdmin));\n"
    "    return subscribeNatalReadingVariant(profile.id, isAdmin, (next) => {\n"
    "      setReadingVariant(next);\n"
    "    });\n"
    "  }, [profile.id, profile.isAdmin]);\n\n"
    "  useEffect(() => {\n"
    "    if (normalizedActiveTab !== 'reading') return;\n"
    "    if (previewConfig?.catalog) {\n"
    "      setReadingRenderer('catalog');\n"
    "      return;\n"
    "    }\n"
    "    if (!data || !catalogCacheIdentity) {\n"
    "      setReadingRenderer('classic');\n"
    "      return;\n"
    "    }\n"
    "    const userId = String(profile.id || '').trim();\n"
    "    const cached = userId ? getNatalCatalogCategoryCached(\n"
    "      userId,\n"
    "      'main',\n"
    "      chartId,\n"
    "      language,\n"
    "      catalogCacheIdentity,\n"
    "    ) : null;\n"
    "    setReadingRenderer(resolveNatalReadingRenderer(readingVariant, Boolean(cached)));\n"
    "    if (readingVariant === 'auto' && !cached && userId) {\n"
    "      void ensureNatalCatalogCategory(\n"
    "        userId,\n"
    "        'main',\n"
    "        chartId,\n"
    "        language,\n"
    "        catalogCacheIdentity,\n"
    "      ).catch((error: unknown) => {\n"
    "        console.warn(\n"
    "          '[NatalMagazine] Natal catalog background warm-up failed:',\n"
    "          error instanceof Error ? error.message : error,\n"
    "        );\n"
    "      });\n"
    "    }\n"
    "  }, [\n"
    "    catalogCacheIdentity,\n"
    "    chartId,\n"
    "    data,\n"
    "    language,\n"
    "    normalizedActiveTab,\n"
    "    previewConfig?.catalog,\n"
    "    profile.id,\n"
    "    readingVariant,\n"
    "  ]);\n\n"
    "  useEffect(() => {\n"
    "    if (\n"
    "      !openQuestionRequest\n",
)

magazine = read('views/v2/NatalMagazine.tsx')
old_catalog_render = '''          <NatalCatalogReport
            key={reportSubjectKey}
            profile={profile}
            chartData={data}
            chartId={chartId}
            chartSubject={chartSubject}
            requestPremium={requestPremium}
            premiumContinuation={premiumContinuation}
            onPremiumContinuationHandled={onPremiumContinuationHandled}
            canPromotePremium={canPromotePremium}
            onOpenQuestions={isSavedPerson ? undefined : () => {
              selectTab('questions');
              requestAnimationFrame(() => {
                window.scrollTo({ top: 0, behavior: 'auto' });
              });
            }}
            hideIntro
            uiPreview={previewConfig?.catalog}
          />'''
new_catalog_render = '''          {readingRenderer === 'catalog' ? (
            <NatalCatalogReport
              key={`catalog:${reportSubjectKey}`}
              profile={profile}
              chartData={data}
              chartId={chartId}
              chartSubject={chartSubject}
              requestPremium={requestPremium}
              premiumContinuation={premiumContinuation}
              onPremiumContinuationHandled={onPremiumContinuationHandled}
              canPromotePremium={canPromotePremium}
              onOpenQuestions={isSavedPerson ? undefined : () => {
                selectTab('questions');
                requestAnimationFrame(() => {
                  window.scrollTo({ top: 0, behavior: 'auto' });
                });
              }}
              hideIntro
              uiPreview={previewConfig?.catalog}
            />
          ) : (
            <HumanReport
              key={`classic:${reportSubjectKey}`}
              profile={profile}
              chartData={data}
              chartId={chartId}
              chartSubject={chartSubject}
              requestPremium={requestPremium}
              onUpdateProfile={onUpdateProfile}
              preloadedReport={preloadedReport}
              hideIntro
              surface="reading"
              premiumContinuation={premiumContinuation}
              onPremiumContinuationHandled={onPremiumContinuationHandled}
              canPromotePremium={canPromotePremium}
              onOpenQuestions={isSavedPerson ? undefined : () => {
                selectTab('questions');
                requestAnimationFrame(() => {
                  window.scrollTo({ top: 0, behavior: 'auto' });
                });
              }}
              uiPreview={previewConfig ? {
                state: previewConfig.reportState || 'ready',
                premiumReport: previewConfig.premiumReport,
              } : undefined}
            />
          )}'''
if magazine.count(old_catalog_render) != 1:
    raise RuntimeError('views/v2/NatalMagazine.tsx: catalog render block did not match exactly')
write('views/v2/NatalMagazine.tsx', magazine.replace(old_catalog_render, new_catalog_render, 1))

# Catalog generator: keep all current gates, but diagnose exactly which field and gate failed.
generator_path = 'lib/natalReading/reportCatalogGeneration.ts'
generator = read(generator_path)
generator = generator.replace(
    'const NATAL_REPORT_SEMANTIC_ATTEMPTS = 2;',
    'const NATAL_REPORT_SEMANTIC_ATTEMPTS = 3;',
    1,
)

is_copy_allowed = '''function isCopyAllowed(value: string, built: BuiltNatalModelContext): boolean {
  return value.length > 0
    && !hasNatalPersonalityCopyViolation(value)
    && !hasNatalReportCatalogCopyViolation(value)
    && isNatalReliabilityTextAllowed(value, built);
}
'''
copy_helpers = is_copy_allowed + r'''
export type NatalReportCopyValidationKind =
  | 'PERSONALITY_COPY'
  | 'CATALOG_COPY'
  | 'RELIABILITY';

export function getNatalReportCopyValidationKinds(
  value: string,
  built: BuiltNatalModelContext,
): NatalReportCopyValidationKind[] {
  const kinds: NatalReportCopyValidationKind[] = [];
  if (!value || hasNatalPersonalityCopyViolation(value)) kinds.push('PERSONALITY_COPY');
  if (!value || hasNatalReportCatalogCopyViolation(value)) kinds.push('CATALOG_COPY');
  if (!value || !isNatalReliabilityTextAllowed(value, built)) kinds.push('RELIABILITY');
  return unique(kinds) as NatalReportCopyValidationKind[];
}

function appendCopyValidationIssues(
  issues: string[],
  path: string,
  value: string,
  built: BuiltNatalModelContext,
): void {
  for (const kind of getNatalReportCopyValidationKinds(value, built)) {
    issues.push(`COPY_VIOLATION:${path}:${kind}`);
  }
}
'''
if generator.count(is_copy_allowed) != 1:
    raise RuntimeError('reportCatalogGeneration.ts: isCopyAllowed block mismatch')
generator = generator.replace(is_copy_allowed, copy_helpers, 1)

category_copy_start = generator.index('  const copyValues = [')
category_copy_end = generator.index('  return unique(issues);', category_copy_start)
category_copy_replacement = r'''  const copyFields: Array<{ path: string; value: string }> = [
    ...summary.map((statement, index) => ({
      path: `summary[${index}]`,
      value: text(statement?.text),
    })),
    ...observations.map((statement, index) => ({
      path: `observations[${index}]`,
      value: text(statement?.text),
    })),
    ...previews.map((preview, index) => ({
      path: `previews[${index}]`,
      value: text(preview?.preview),
    })),
    ...freeAnswers.flatMap((answer, answerIndex) => (
      Array.isArray(answer?.paragraphs)
        ? answer.paragraphs.map((paragraph, paragraphIndex) => ({
            path: `free_answers[${answerIndex}].paragraphs[${paragraphIndex}]`,
            value: text(paragraph?.text),
          }))
        : []
    )),
  ].filter((field) => field.value.length > 0);
  const copyIssueCountBefore = issues.length;
  for (const field of copyFields) {
    appendCopyValidationIssues(issues, field.path, field.value, input.built);
  }
  if (issues.length > copyIssueCountBefore) {
    issues.push('COPY_OR_RELIABILITY_VIOLATION');
  }
'''
generator = generator[:category_copy_start] + category_copy_replacement + generator[category_copy_end:]

old_answer_copy = '''  if (paragraphs.some((paragraph) => !isCopyAllowed(text(paragraph?.text), input.built))) {
    issues.push('COPY_OR_RELIABILITY_VIOLATION');
  }
'''
new_answer_copy = r'''  const copyIssueCountBefore = issues.length;
  paragraphs.forEach((paragraph, index) => {
    appendCopyValidationIssues(
      issues,
      `paragraphs[${index}]`,
      text(paragraph?.text),
      input.built,
    );
  });
  if (issues.length > copyIssueCountBefore) {
    issues.push('COPY_OR_RELIABILITY_VIOLATION');
  }
'''
if generator.count(old_answer_copy) != 1:
    raise RuntimeError('reportCatalogGeneration.ts: answer copy validation block mismatch')
generator = generator.replace(old_answer_copy, new_answer_copy, 1)

repair_start = generator.index('function buildSemanticRepairPrompt(')
repair_end = generator.index('\n\nexport function materializeNatalReportCategoryPack', repair_start)
repair_function = r'''function buildSemanticRepairPrompt(
  prompt: string,
  issues: readonly string[],
  language: 'ru' | 'en',
): string {
  const guide = language === 'ru'
    ? `\nРасшифровка кодов:\n- PERSONALITY_COPY means: в указанном поле есть астрологические названия, мистика, психологическое клише, совет, коучинговая команда, диагноз, гарантия или универсальная фраза. Удали всё это.\n- CATALOG_COPY means: в указанном поле есть запрещённый жаргон, текущая дата, обещание будущего или рекламная интрига. Перепиши обычными словами.\n- RELIABILITY means: поле ссылается на дом, угол, асцендент, MC или другой вывод, которого нет среди надёжных входных данных. Удали такой вывод; не заменяй его догадкой.\nВо всём пользовательском тексте не называй планеты, знаки, дома, аспекты, градусы, углы, асцендент или MC. Не давай советов. Не упоминай сегодня, завтра, даты и будущие события. Перепиши каждое поле с указанным путём полностью, но верни весь JSON и сохрани разрешённые evidence_ids.`
    : `\nIssue guide:\n- PERSONALITY_COPY means: the field contains visible astrology, mysticism, a psychological cliché, advice, coaching language, a diagnosis, a guarantee, or a generic personality formula. Remove it.\n- CATALOG_COPY means: the field contains banned report jargon, a current date, a future promise, or an advertising cliffhanger. Rewrite it in ordinary words.\n- RELIABILITY means: the field refers to a house, angle, Ascendant, MC, or another claim not present in reliable input. Remove that claim and do not replace it with a guess.\nNever name planets, signs, houses, aspects, degrees, angles, Ascendant, or MC in user-facing text. Give no advice. Mention no current dates or future events. Fully rewrite every field whose path is listed, return the complete JSON, and keep only allowed evidence_ids.`;
  const instruction = language === 'ru'
    ? '\n\nREPAIR REQUIRED:\nПредыдущий вариант не прошёл серверную проверку: '
      + JSON.stringify(issues)
      + '. Не пытайся угадать одно запрещённое слово: используй путь и тип каждого кода, затем напиши весь JSON заново. Не копируй предыдущий текст.'
    : '\n\nREPAIR REQUIRED:\nThe previous candidate failed server validation: '
      + JSON.stringify(issues)
      + '. Do not guess one offending word: use every field path and issue type, then rewrite the complete JSON without copying the previous wording.';
  return prompt + instruction + guide;
}'''
generator = generator[:repair_start] + repair_function + generator[repair_end:]

# Make the original prompt match the actual runtime gates before a repair is needed.
generator = generator.replace(
    '- Никакой психологии, коучинга, воспитания, мистики и астрологического языка. Не используй «ресурс», «опора», «границы», «паттерн», «потенциал», «энергия», «предназначение» и похожие слова.\n',
    '- Никакой психологии, коучинга, воспитания, мистики и астрологического языка. Не используй «ресурс», «опора», «границы», «паттерн», «потенциал», «энергия», «предназначение» и похожие слова.\n- Вообще не называй планеты, знаки, дома, аспекты, градусы, углы, асцендент или MC. Не упоминай сегодня, завтра, даты и будущие события.\n- Не используй готовые обороты «это про тебя», «считывается», «проверка фактов», «что стоит заметить», «внутренняя точность» и рекламные недосказанности.\n',
    1,
)
generator = generator.replace(
    '- No psychology, coaching, instruction, mysticism, or visible astrology. Avoid report jargon such as resource, support point, boundaries, pattern, potential, energy, or destiny.\n',
    '- No psychology, coaching, instruction, mysticism, or visible astrology. Avoid report jargon such as resource, support point, boundaries, pattern, potential, energy, or destiny.\n- Never name planets, signs, houses, aspects, degrees, angles, Ascendant, or MC. Mention no current dates or future events.\n- Avoid canned phrases, pseudo-insight, report language, and advertising cliffhangers.\n',
    1,
)

log_needle = "    if (validationIssues.length === 0) validationIssues = ['SEMANTIC_CONTRACT_INVALID'];\n"
category_log = log_needle + r'''    console.warn('[natal/catalog-validation]', JSON.stringify({
      kind: 'category',
      categoryKey: input.categoryKey,
      semanticAttempt: attempt,
      responseId: result.responseId,
      validationIssues,
    }));
'''
if generator.count(log_needle) != 2:
    raise RuntimeError(f'reportCatalogGeneration.ts: expected two semantic issue sites, found {generator.count(log_needle)}')
generator = generator.replace(log_needle, category_log, 1)
answer_log = log_needle + r'''    console.warn('[natal/catalog-validation]', JSON.stringify({
      kind: 'answer',
      answerKey: input.answerKey,
      semanticAttempt: attempt,
      responseId: result.responseId,
      validationIssues,
    }));
'''
generator = generator.replace(log_needle, answer_log, 1)
write(generator_path, generator)

print('Natal admin switch and catalog diagnostics patch applied.')
