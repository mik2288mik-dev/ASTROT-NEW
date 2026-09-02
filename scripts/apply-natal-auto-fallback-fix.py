from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, value: str) -> None:
    (ROOT / path).write_text(value, encoding="utf-8")


def replace_once(value: str, old: str, new: str, label: str) -> str:
    count = value.count(old)
    if count < 1:
        raise RuntimeError(f"{label}: expected at least one occurrence, found {count}")
    return value.replace(old, new, 1)


def regex_once(value: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, value, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one regex match, found {count}")
    return updated


# 1. Start auto mode with the new catalog; the screen owns the timed fallback.
path = "lib/natalReading/readingVariant.ts"
source = read(path)
source = regex_once(
    source,
    r"""export function resolveNatalReadingRenderer\(
  variant: NatalReadingVariant,
  catalogCached: boolean,
\): NatalReadingRenderer \{
  if \(variant === 'catalog'\) return 'catalog';
  if \(variant === 'classic'\) return 'classic';
  return catalogCached \? 'catalog' : 'classic';
\}""",
    """export function resolveNatalReadingRenderer(
  variant: NatalReadingVariant,
  _catalogCached: boolean,
): NatalReadingRenderer {
  if (variant === 'classic') return 'classic';
  return 'catalog';
}""",
    "reading variant resolver",
)
write(path, source)

# 2. Make the admin labels match the actual behavior.
path = "components/NatalReading/NatalReadingVariantSettings.tsx"
source = read(path)
source = replace_once(
    source,
    """  { value: 'auto', ru: 'Авто — безопасный режим', en: 'Auto — safe mode' },
  { value: 'catalog', ru: 'Новый разбор', en: 'New reading' },
  { value: 'classic', ru: 'Старый разбор', en: 'Classic reading' },""",
    """  { value: 'auto', ru: 'Авто: новый, при сбое старый', en: 'Auto: new, then stable fallback' },
  { value: 'catalog', ru: 'Новый каталог', en: 'New catalog' },
  { value: 'classic', ru: 'Старый стабильный разбор', en: 'Stable classic reading' },""",
    "variant labels",
)
source = source.replace(
    "language === 'en' ? 'Natal reading version' : 'Версия разбора натальной карты'",
    "language === 'en' ? 'Natal chart version' : 'Вариант натальной карты'",
)
source = replace_once(
    source,
    """        {language === 'en'
          ? 'Auto opens the new reading only when it is already ready; otherwise the stable classic reading opens immediately. This setting affects only this administrator on this device.'
          : 'Авто открывает новый разбор, только когда он уже готов. Иначе сразу открывается стабильный старый. Настройка действует только для этого администратора на этом устройстве.'}""",
    """        {language === 'en'
          ? 'Auto tries the new catalog first. If it fails or is not ready within 12 seconds, the stable classic reading opens. This setting affects only this administrator on this device.'
          : 'Авто сначала открывает новый каталог. Если он вернул ошибку или не загрузился за 12 секунд, откроется старый стабильный разбор. Настройка действует только для этого администратора на этом устройстве.'}""",
    "variant helper copy",
)
write(path, source)

# 3. Report catalog: callbacks only for the main category.
path = "components/NatalReading/NatalCatalogReport.tsx"
source = read(path)
source = replace_once(
    source,
    """  onOpenQuestions?: () => void;
  hideIntro?: boolean;
  uiPreview?: NatalCatalogReportUiPreview;""",
    """  onOpenQuestions?: () => void;
  hideIntro?: boolean;
  onReady?: () => void;
  onUnavailable?: (error: unknown) => void;
  uiPreview?: NatalCatalogReportUiPreview;""",
    "catalog callback props",
)
source = replace_once(
    source,
    """  onOpenQuestions,
  hideIntro = false,
  uiPreview,""",
    """  onOpenQuestions,
  hideIntro = false,
  onReady,
  onUnavailable,
  uiPreview,""",
    "catalog callback destructuring",
)
source = replace_once(
    source,
    """  const firstResultIdentityRef = useRef('');
  const handledContinuationRef = useRef('');

  const activeCategoryPack""",
    """  const firstResultIdentityRef = useRef('');
  const handledContinuationRef = useRef('');
  const onReadyRef = useRef(onReady);
  const onUnavailableRef = useRef(onUnavailable);
  const mainAvailabilityRef = useRef<'pending' | 'ready' | 'unavailable'>('pending');

  useEffect(() => {
    onReadyRef.current = onReady;
    onUnavailableRef.current = onUnavailable;
  }, [onReady, onUnavailable]);

  const activeCategoryPack""",
    "catalog callback refs",
)
source = replace_once(
    source,
    """  const displayCategoryPack = selectedAnswerKey ? detailCategoryPack : activeCategoryPack;

  useEffect(() => {""",
    """  const displayCategoryPack = selectedAnswerKey ? detailCategoryPack : activeCategoryPack;

  const notifyMainReady = () => {
    if (mainAvailabilityRef.current === 'ready') return;
    mainAvailabilityRef.current = 'ready';
    onReadyRef.current?.();
  };

  const notifyMainUnavailable = (error: unknown) => {
    if (mainAvailabilityRef.current === 'ready') return;
    mainAvailabilityRef.current = 'unavailable';
    onUnavailableRef.current?.(error);
  };

  useEffect(() => {
    mainAvailabilityRef.current = 'pending';
  }, [storageScope]);

  useEffect(() => {""",
    "catalog availability helpers",
)
source = replace_once(
    source,
    """      setCategoryError(previewState === 'error'
        ? language === 'ru'
          ? 'Разбор не загрузился. Нажми «Попробовать снова».'
          : 'The reading did not load. Try again.'
        : null);
      return;""",
    """      setCategoryError(previewState === 'error'
        ? language === 'ru'
          ? 'Разбор не загрузился. Нажми «Попробовать снова».'
          : 'The reading did not load. Try again.'
        : null);
      if (previewState === 'ready' && previewFixture.categoryPacks[DEFAULT_CATEGORY]) {
        notifyMainReady();
      } else if (previewState === 'error') {
        notifyMainUnavailable(new Error('NATAL_REPORT_CATEGORY_PREVIEW_FAILED'));
      }
      return;""",
    "preview availability callbacks",
)
source = replace_once(
    source,
    """    if (!userId) {
      setCategoryLoading(false);
      setCategoryError(language === 'ru'
        ? 'Разбор не открылся. Вернись к карте и попробуй ещё раз.'
        : 'The reading did not open. Return to the chart and try again.');
      return;
    }""",
    """    if (!userId) {
      setCategoryLoading(false);
      setCategoryError(language === 'ru'
        ? 'Разбор не открылся. Вернись к карте и попробуй ещё раз.'
        : 'The reading did not open. Return to the chart and try again.');
      if (activeCategory === DEFAULT_CATEGORY) {
        notifyMainUnavailable(new Error('NATAL_CATALOG_USER_ID_MISSING'));
      }
      return;
    }""",
    "missing user callback",
)
source = replace_once(
    source,
    """    if (cached) {
      setCategoryPacks((current) => ({ ...current, [activeCategory]: cached }));
      setAnswers((current) => ({
        ...current,
        ...Object.fromEntries(cached.freeAnswers.map((answer) => [answer.answerKey, answer])),
      }));
    }""",
    """    if (cached) {
      setCategoryPacks((current) => ({ ...current, [activeCategory]: cached }));
      setAnswers((current) => ({
        ...current,
        ...Object.fromEntries(cached.freeAnswers.map((answer) => [answer.answerKey, answer])),
      }));
      if (activeCategory === DEFAULT_CATEGORY) notifyMainReady();
    }""",
    "cached main callback",
)
source = replace_once(
    source,
    """          setAnswers((current) => ({
            ...current,
            ...Object.fromEntries(next.freeAnswers.map((answer) => [answer.answerKey, answer])),
          }));
        }
      })
      .catch((loadError) => {
        if (!cancelled && !cached) setCategoryError(formatLoadError(loadError, language));
      })""",
    """          setAnswers((current) => ({
            ...current,
            ...Object.fromEntries(next.freeAnswers.map((answer) => [answer.answerKey, answer])),
          }));
          if (activeCategory === DEFAULT_CATEGORY) notifyMainReady();
        }
      })
      .catch((loadError) => {
        if (!cancelled && !cached) {
          setCategoryError(formatLoadError(loadError, language));
          if (activeCategory === DEFAULT_CATEGORY) notifyMainUnavailable(loadError);
        }
      })""",
    "network main callbacks",
)
write(path, source)

# 4. New catalog first; in auto mode switch to the stable report after a real
# main failure or 12 seconds without a ready signal.
path = "views/v2/NatalMagazine.tsx"
source = read(path)
source = source.replace(
    "import { NATAL_REPORT_CATALOG_CONTRACT_VERSION } from '../../lib/natalReading/reportCatalog';\n",
    "",
)
source = source.replace(
    """import {
  ensureNatalCatalogCategory,
  getNatalCatalogCategoryCached,
} from '../../services/natalCatalogService';
""",
    "",
)
source = replace_once(
    source,
    """export type NatalScreenTab = 'map' | 'reading' | 'questions' | 'matrix';

export function isSavedPersonChartSubject(""",
    """export type NatalScreenTab = 'map' | 'reading' | 'questions' | 'matrix';

const NATAL_CATALOG_AUTO_FALLBACK_MS = 12_000;

export function isSavedPersonChartSubject(""",
    "fallback constant",
)
source = regex_once(
    source,
    r"""  const catalogCacheIdentity = useMemo\(\(\) => data \? \(\{
    chartFingerprint: buildNatalChartFingerprint\(data\),
    reportVersion: NATAL_REPORT_CATALOG_CONTRACT_VERSION,
  \}\) : null, \[data\]\);
  const \[readingVariant, setReadingVariant\] = useState<NatalReadingVariant>\(\(\) => \(
    readNatalReadingVariant\(profile.id, profile.isAdmin === true\)
  \)\);
  const \[readingRenderer, setReadingRenderer\] = useState<NatalReadingRenderer>\(\(\) => \{
    if \(previewConfig\?\.catalog\) return 'catalog';
    if \(!data \|\| !catalogCacheIdentity\) return 'classic';
    const userId = String\(profile.id \|\| ''\).trim\(\);
    const cached = userId \? getNatalCatalogCategoryCached\(
      userId,
      'main',
      chartId,
      language,
      catalogCacheIdentity,
    \) : null;
    return resolveNatalReadingRenderer\(
      readNatalReadingVariant\(profile.id, profile.isAdmin === true\),
      Boolean\(cached\),
    \);
  \}\);""",
    """  const [readingVariant, setReadingVariant] = useState<NatalReadingVariant>(() => (
    readNatalReadingVariant(profile.id, profile.isAdmin === true)
  ));
  const [readingRenderer, setReadingRenderer] = useState<NatalReadingRenderer>(() => (
    previewConfig?.catalog
      ? 'catalog'
      : resolveNatalReadingRenderer(
          readNatalReadingVariant(profile.id, profile.isAdmin === true),
          false,
        )
  ));""",
    "initial renderer",
)
source = replace_once(
    source,
    """  const [matrixMounted, setMatrixMounted] = useState(false);
  const handledExternalQuestionRequestRef = useRef(0);
  const tabs = useMemo(() => {""",
    """  const [matrixMounted, setMatrixMounted] = useState(false);
  const handledExternalQuestionRequestRef = useRef(0);
  const catalogReadyRef = useRef(false);
  const autoFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabs = useMemo(() => {""",
    "fallback refs",
)
source = regex_once(
    source,
    r"""  useEffect\(\(\) => \{
    if \(normalizedActiveTab !== 'reading'\) return;
    if \(previewConfig\?\.catalog\) \{
      setReadingRenderer\('catalog'\);
      return;
    \}
    if \(!data \|\| !catalogCacheIdentity\) \{
      setReadingRenderer\('classic'\);
      return;
    \}
    const userId = String\(profile.id \|\| ''\).trim\(\);
    const cached = userId \? getNatalCatalogCategoryCached\(
      userId,
      'main',
      chartId,
      language,
      catalogCacheIdentity,
    \) : null;
    setReadingRenderer\(resolveNatalReadingRenderer\(readingVariant, Boolean\(cached\)\)\);
    if \(readingVariant === 'auto' && !cached && userId\) \{
      void ensureNatalCatalogCategory\(
        userId,
        'main',
        chartId,
        language,
        catalogCacheIdentity,
      \).catch\(\(error: unknown\) => \{
        console.warn\(
          '\[NatalMagazine\] Natal catalog background warm-up failed:',
          error instanceof Error \? error.message : error,
        \);
      \}\);
    \}
  \}, \[
    catalogCacheIdentity,
    chartId,
    data,
    language,
    normalizedActiveTab,
    previewConfig\?\.catalog,
    profile.id,
    readingVariant,
  \]\);""",
    """  useEffect(() => {
    if (autoFallbackTimerRef.current) {
      clearTimeout(autoFallbackTimerRef.current);
      autoFallbackTimerRef.current = null;
    }
    catalogReadyRef.current = false;

    if (normalizedActiveTab !== 'reading') return;
    if (previewConfig?.catalog) {
      setReadingRenderer('catalog');
      return;
    }
    if (!data) {
      setReadingRenderer('classic');
      return;
    }

    const nextRenderer = resolveNatalReadingRenderer(readingVariant, false);
    setReadingRenderer(nextRenderer);
    if (readingVariant !== 'auto' || nextRenderer !== 'catalog') return;

    autoFallbackTimerRef.current = setTimeout(() => {
      if (!catalogReadyRef.current) setReadingRenderer('classic');
      autoFallbackTimerRef.current = null;
    }, NATAL_CATALOG_AUTO_FALLBACK_MS);

    return () => {
      if (autoFallbackTimerRef.current) {
        clearTimeout(autoFallbackTimerRef.current);
        autoFallbackTimerRef.current = null;
      }
    };
  }, [
    chartId,
    data,
    normalizedActiveTab,
    previewConfig?.catalog,
    profile.id,
    readingVariant,
  ]);""",
    "auto fallback effect",
)
source = replace_once(
    source,
    """              hideIntro
              uiPreview={previewConfig?.catalog}
            />""",
    """              hideIntro
              onReady={() => {
                catalogReadyRef.current = true;
                if (autoFallbackTimerRef.current) {
                  clearTimeout(autoFallbackTimerRef.current);
                  autoFallbackTimerRef.current = null;
                }
              }}
              onUnavailable={() => {
                if (readingVariant !== 'auto' || catalogReadyRef.current) return;
                if (autoFallbackTimerRef.current) {
                  clearTimeout(autoFallbackTimerRef.current);
                  autoFallbackTimerRef.current = null;
                }
                setReadingRenderer('classic');
              }}
              uiPreview={previewConfig?.catalog}
            />""",
    "catalog renderer callbacks",
)
write(path, source)

# 5. Repair requests need the rejected candidate, not only abstract codes.
path = "lib/natalReading/reportCatalogGeneration.ts"
source = read(path)
source = replace_once(
    source,
    """function buildSemanticRepairPrompt(
  prompt: string,
  issues: readonly string[],
  language: 'ru' | 'en',
): string {""",
    """function buildSemanticRepairPrompt(
  prompt: string,
  issues: readonly string[],
  previousCandidate: unknown,
  language: 'ru' | 'en',
): string {""",
    "repair signature",
)
source = replace_once(
    source,
    """  return prompt + instruction + guide;
}""",
    r"""  const previous = '\n\nPREVIOUS REJECTED JSON:\n'
    + JSON.stringify(previousCandidate, null, 2);
  return prompt + instruction + guide + previous;
}""",
    "repair previous candidate",
)
source = replace_once(
    source,
    """  let validationIssues: string[] = [];
  for (let attempt = 1; attempt <= NATAL_REPORT_SEMANTIC_ATTEMPTS; attempt += 1) {
    const { result } = await callStructuredWithBudgetRetry({""",
    """  let validationIssues: string[] = [];
  let previousCandidate: RawNatalReportCategoryPayload | null = null;
  for (let attempt = 1; attempt <= NATAL_REPORT_SEMANTIC_ATTEMPTS; attempt += 1) {
    const { result } = await callStructuredWithBudgetRetry({""",
    "category previous state",
)
source = replace_once(
    source,
    """: buildSemanticRepairPrompt(basePrompt, validationIssues, language),
      maxOutputTokens: 2400,""",
    """: buildSemanticRepairPrompt(
            basePrompt,
            validationIssues,
            previousCandidate,
            language,
          ),
      maxOutputTokens: 2400,""",
    "category repair call",
)
source = replace_once(
    source,
    """    const raw = parseJson<RawNatalReportCategoryPayload>(result.content);
    const report = materializeNatalReportCategoryPack({""",
    """    const raw = parseJson<RawNatalReportCategoryPayload>(result.content);
    previousCandidate = raw;
    const report = materializeNatalReportCategoryPack({""",
    "category candidate assignment",
)
source = replace_once(
    source,
    """  let validationIssues: string[] = [];
  for (let attempt = 1; attempt <= NATAL_REPORT_SEMANTIC_ATTEMPTS; attempt += 1) {
    const { result } = await callStructuredWithBudgetRetry({""",
    """  let validationIssues: string[] = [];
  let previousCandidate: RawNatalReportAnswerPayload | null = null;
  for (let attempt = 1; attempt <= NATAL_REPORT_SEMANTIC_ATTEMPTS; attempt += 1) {
    const { result } = await callStructuredWithBudgetRetry({""",
    "answer previous state",
)
source = replace_once(
    source,
    """: buildSemanticRepairPrompt(basePrompt, validationIssues, language),
      maxOutputTokens: 1400,""",
    """: buildSemanticRepairPrompt(
            basePrompt,
            validationIssues,
            previousCandidate,
            language,
          ),
      maxOutputTokens: 1400,""",
    "answer repair call",
)
source = replace_once(
    source,
    """    const raw = parseJson<RawNatalReportAnswerPayload>(result.content);
    const report = materializeNatalReportAnswer({""",
    """    const raw = parseJson<RawNatalReportAnswerPayload>(result.content);
    previousCandidate = raw;
    const report = materializeNatalReportAnswer({""",
    "answer candidate assignment",
)
write(path, source)

# 6. Invalidate old failed cache identities without changing the response schema.
path = "lib/natalReading/reportCatalog.ts"
source = read(path)
for old, new in [
    ("`${NATAL_REPORT_CATALOG_CONTRACT_VERSION}.category.v1`", "`${NATAL_REPORT_CATALOG_CONTRACT_VERSION}.category.v2`"),
    ("`${NATAL_REPORT_CATALOG_CONTRACT_VERSION}.answer.v1`", "`${NATAL_REPORT_CATALOG_CONTRACT_VERSION}.answer.v2`"),
    ("'natal.report-catalog.category.v1'", "'natal.report-catalog.category.v2'"),
    ("'natal.report-catalog.answer.v1'", "'natal.report-catalog.answer.v2'"),
]:
    source = replace_once(source, old, new, f"catalog version {old}")
write(path, source)

# 7. Focused regression and source-contract tests.
write(
    "__tests__/natal-reading-variant.test.ts",
    """import {
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

  it('starts auto with the catalog and preserves forced modes', () => {
    expect(resolveNatalReadingRenderer('auto', false)).toBe('catalog');
    expect(resolveNatalReadingRenderer('auto', true)).toBe('catalog');
    expect(resolveNatalReadingRenderer('catalog', false)).toBe('catalog');
    expect(resolveNatalReadingRenderer('classic', true)).toBe('classic');
  });
});
""",
)

write(
    "__tests__/natal-reading-variant-ui-contract.test.ts",
    """import fs from 'node:fs';
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
    expect(component).toContain('Вариант натальной карты');
    expect(component).toContain('Авто: новый, при сбое старый');
    expect(component).toContain('Новый каталог');
    expect(component).toContain('Старый стабильный разбор');
  });

  it('tries catalog first in auto, falls back after 12 seconds or main failure, and respects forced modes', () => {
    const magazine = source('views/v2/NatalMagazine.tsx');
    const report = source('components/NatalReading/NatalCatalogReport.tsx');
    expect(magazine).toContain('const NATAL_CATALOG_AUTO_FALLBACK_MS = 12_000;');
    expect(magazine).toContain("resolveNatalReadingRenderer(readingVariant, false)");
    expect(magazine).toContain("readingVariant !== 'auto'");
    expect(magazine).toContain("setReadingRenderer('classic')");
    expect(magazine).toContain('onReady={() =>');
    expect(magazine).toContain('onUnavailable={() =>');
    expect(magazine).toContain("readingRenderer === 'catalog'");
    expect(magazine).toContain('surface="reading"');
    expect(report).toContain('onReady?: () => void;');
    expect(report).toContain('onUnavailable?: (error: unknown) => void;');
    expect(report).toContain('activeCategory === DEFAULT_CATEGORY');
    expect(report).toContain('notifyMainReady()');
    expect(report).toContain('notifyMainUnavailable(loadError)');
  });
});
""",
)

path = "__tests__/natal-catalog-repair-diagnostics.test.ts"
source = read(path)
source = replace_once(
    source,
    """    expect(source).toContain('RELIABILITY means');
    expect(source).not.toContain('generatedText:');""",
    """    expect(source).toContain('RELIABILITY means');
    expect(source).toContain('PREVIOUS REJECTED JSON');
    expect(source).toContain('previousCandidate = raw;');
    expect(source).not.toContain('generatedText:');""",
    "repair diagnostics test",
)
write(path, source)

path = "__tests__/natal-catalog-contract.test.ts"
source = read(path)
source = replace_once(
    source,
    """    expect(prompts[1]).toContain('SUMMARY_TOTAL_TOO_SHORT:300');
    expect(report.summary.reduce((sum, item) => sum + item.text.length, 0)).toBe(600);""",
    """    expect(prompts[1]).toContain('SUMMARY_TOTAL_TOO_SHORT:300');
    expect(prompts[1]).toContain('PREVIOUS REJECTED JSON');
    expect(prompts[1]).toContain(JSON.stringify(tooShort, null, 2));
    expect(report.summary.reduce((sum, item) => sum + item.text.length, 0)).toBe(600);""",
    "catalog previous JSON test",
)
write(path, source)

write(
    "__tests__/natal-report-cache-version.test.ts",
    """import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.join(process.cwd(), 'lib/natalReading/reportCatalog.ts'),
  'utf8',
);

describe('natal report cache identity', () => {
  it('uses v2 prompt and cache identities after validator repair changes', () => {
    expect(source).toContain('.category.v2');
    expect(source).toContain('.answer.v2');
    expect(source).toContain('natal.report-catalog.category.v2');
    expect(source).toContain('natal.report-catalog.answer.v2');
    expect(source).not.toContain('natal.report-catalog.category.v1');
    expect(source).not.toContain('natal.report-catalog.answer.v1');
  });
});
""",
)

print("Natal catalog auto fallback patch applied.")
