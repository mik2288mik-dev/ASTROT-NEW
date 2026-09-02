from pathlib import Path

BASE_COMMIT = "54cced79a292dd6cae79db929a0089ea41951021"


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding="utf-8")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one anchor, found {count}")
    return content.replace(old, new, 1)


# Settings: place the switch inside the existing admin-only developer screen.
path = "views/Settings.tsx"
content = read(path)
content = replace_once(
    content,
    "import { meetsMinimumPasswordLength } from '../lib/auth/passwordPolicy';\n",
    "import { meetsMinimumPasswordLength } from '../lib/auth/passwordPolicy';\n"
    "import {\n"
    "    NATAL_READING_VARIANT_CHANGED_EVENT,\n"
    "    natalReadingVariantLabel,\n"
    "    readNatalReadingVariant,\n"
    "    writeNatalReadingVariant,\n"
    "    type NatalReadingVariant,\n"
    "    type NatalReadingVariantChangedDetail,\n"
    "} from '../lib/natalReading/readingVariant';\n",
    "settings import",
)
content = replace_once(
    content,
    "    const [settingsScreen, setSettingsScreen] = useState<SettingsScreen>('root');\n",
    "    const [settingsScreen, setSettingsScreen] = useState<SettingsScreen>('root');\n"
    "    const [natalReadingVariant, setNatalReadingVariant] = useState<NatalReadingVariant>(() => (\n"
    "        readNatalReadingVariant(String(profile.id || ''), profile.isAdmin)\n"
    "    ));\n",
    "settings state",
)
content = replace_once(
    content,
    "    const settingsDetailBusy = savingProfile\n"
    "        || identityBusy\n"
    "        || restoreState === 'running'\n"
    "        || feedbackStatus === 'submitting'\n"
    "        || loggingOut\n"
    "        || deletingAccount;\n\n"
    "    useEffect(() => {\n",
    "    const settingsDetailBusy = savingProfile\n"
    "        || identityBusy\n"
    "        || restoreState === 'running'\n"
    "        || feedbackStatus === 'submitting'\n"
    "        || loggingOut\n"
    "        || deletingAccount;\n\n"
    "    useEffect(() => {\n"
    "        setNatalReadingVariant(readNatalReadingVariant(String(profile.id || ''), profile.isAdmin));\n"
    "    }, [profile.id, profile.isAdmin]);\n\n"
    "    useEffect(() => {\n"
    "        const userId = String(profile.id || '');\n"
    "        const handleVariantChange = (event: Event) => {\n"
    "            const detail = (event as CustomEvent<NatalReadingVariantChangedDetail>).detail;\n"
    "            if (!detail || detail.userId !== userId) return;\n"
    "            setNatalReadingVariant(detail.variant);\n"
    "        };\n"
    "        window.addEventListener(NATAL_READING_VARIANT_CHANGED_EVENT, handleVariantChange);\n"
    "        return () => window.removeEventListener(NATAL_READING_VARIANT_CHANGED_EVENT, handleVariantChange);\n"
    "    }, [profile.id]);\n\n"
    "    useEffect(() => {\n",
    "settings effects",
)
content = replace_once(
    content,
    "    const openSettingsScreen = (screen: Exclude<SettingsScreen, 'root'>) => {\n"
    "        lastRootTargetRef.current = screen;\n"
    "        setPreviewNotice('');\n"
    "        setSettingsScreen(screen);\n"
    "    };\n\n"
    "    const settingsTitle: Record<SettingsScreen, string> = profile.language === 'en'\n",
    "    const openSettingsScreen = (screen: Exclude<SettingsScreen, 'root'>) => {\n"
    "        lastRootTargetRef.current = screen;\n"
    "        setPreviewNotice('');\n"
    "        setSettingsScreen(screen);\n"
    "    };\n\n"
    "    const selectNatalReadingVariant = (variant: NatalReadingVariant) => {\n"
    "        setNatalReadingVariant(variant);\n"
    "        writeNatalReadingVariant(String(profile.id || ''), variant);\n"
    "    };\n\n"
    "    const settingsTitle: Record<SettingsScreen, string> = profile.language === 'en'\n",
    "settings action",
)
developer_anchor = """                        ) : null}
                        <div className="settings-developer-actions">
"""
developer_insert = """                        ) : null}
                        {profile.isAdmin ? (
                            <div className="settings-detail-section settings-detail-section--separated">
                                <h2>{profile.language === 'en' ? 'Natal reading version' : 'Вариант натального разбора'}</h2>
                                <p className="settings-helper-text">
                                    {profile.language === 'en'
                                        ? 'Auto uses the new reading first and returns to the previous stable version when the new generator is rejected.'
                                        : 'Авто сначала открывает новый разбор, а при отказе генератора сразу возвращает предыдущий стабильный вариант.'}
                                </p>
                                <div
                                    className="settings-selection-list"
                                    aria-label={profile.language === 'en' ? 'Natal reading version' : 'Вариант натального разбора'}
                                >
                                    {([
                                        ['auto', 'Авто', 'Auto', 'Новый с автоматическим возвратом', 'New with automatic fallback'],
                                        ['catalog', 'Новый', 'New', 'Только новый каталог — ошибки видны сразу', 'New catalogue only — errors stay visible'],
                                        ['legacy', 'Предыдущий', 'Previous', 'Старый стабильный экран и генератор', 'Previous stable screen and generator'],
                                    ] as const).map(([value, titleRu, titleEn, descriptionRu, descriptionEn]) => {
                                        const selected = natalReadingVariant === value;
                                        return (
                                            <button
                                                key={value}
                                                type="button"
                                                className="settings-selection-row"
                                                aria-pressed={selected}
                                                onClick={() => selectNatalReadingVariant(value)}
                                            >
                                                <span>
                                                    <strong>{profile.language === 'en' ? titleEn : titleRu}</strong>
                                                    <small>
                                                        {profile.language === 'en' ? descriptionEn : descriptionRu}
                                                    </small>
                                                </span>
                                                {selected ? <Check aria-hidden size={16} strokeWidth={2} /> : null}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}
                        <div className="settings-developer-actions">
"""
content = replace_once(content, developer_anchor, developer_insert, "developer selector")
content = replace_once(
    content,
    "                                        label={profile.language === 'en' ? 'For developers' : 'Для разработчика'}\n"
    "                                        target=\"developer\"\n",
    "                                        label={profile.language === 'en' ? 'For developers' : 'Для разработчика'}\n"
    "                                        value={natalReadingVariantLabel(natalReadingVariant, profile.language === 'en' ? 'en' : 'ru')}\n"
    "                                        target=\"developer\"\n",
    "developer row value",
)
write(path, content)


# Natal catalogue: keep the canonical implementation, add admin selection and automatic legacy fallback.
path = "components/NatalReading/NatalCatalogReport.tsx"
content = read(path)
content = replace_once(
    content,
    "import { NatalReportHub } from './NatalReportHub';\n",
    "import { NatalReportHub } from './NatalReportHub';\n"
    "import { HumanReport } from './HumanReport';\n"
    "import {\n"
    "  NATAL_READING_VARIANT_CHANGED_EVENT,\n"
    "  natalCatalogErrorCode,\n"
    "  natalReadingVariantLabel,\n"
    "  readNatalReadingVariant,\n"
    "  type NatalReadingVariant,\n"
    "  type NatalReadingVariantChangedDetail,\n"
    "} from '../../lib/natalReading/readingVariant';\n",
    "catalog imports",
)
content = replace_once(
    content,
    "  const [focusRequestId, setFocusRequestId] = useState(0);\n",
    "  const [focusRequestId, setFocusRequestId] = useState(0);\n"
    "  const [readingVariant, setReadingVariant] = useState<NatalReadingVariant>(() => (\n"
    "    readNatalReadingVariant(userId, profile.isAdmin)\n"
    "  ));\n"
    "  const [catalogFallbackCode, setCatalogFallbackCode] = useState('');\n",
    "catalog variant state",
)
content = replace_once(
    content,
    "  const displayCategoryPack = selectedAnswerKey ? detailCategoryPack : activeCategoryPack;\n\n"
    "  useEffect(() => {\n"
    "    setStorageReady(false);\n",
    "  const displayCategoryPack = selectedAnswerKey ? detailCategoryPack : activeCategoryPack;\n"
    "  const usePreviousReading = readingVariant === 'legacy'\n"
    "    || (readingVariant === 'auto' && catalogFallbackCode.length > 0);\n\n"
    "  useEffect(() => {\n"
    "    setReadingVariant(readNatalReadingVariant(userId, profile.isAdmin));\n"
    "    setCatalogFallbackCode('');\n"
    "  }, [profile.isAdmin, reportIdentity, userId]);\n\n"
    "  useEffect(() => {\n"
    "    const handleVariantChange = (event: Event) => {\n"
    "      const detail = (event as CustomEvent<NatalReadingVariantChangedDetail>).detail;\n"
    "      if (!detail || detail.userId !== userId) return;\n"
    "      setReadingVariant(detail.variant);\n"
    "      setCatalogFallbackCode('');\n"
    "      if (detail.variant !== 'legacy') {\n"
    "        setCategoryRetryToken((value) => value + 1);\n"
    "      }\n"
    "    };\n"
    "    window.addEventListener(NATAL_READING_VARIANT_CHANGED_EVENT, handleVariantChange);\n"
    "    return () => window.removeEventListener(NATAL_READING_VARIANT_CHANGED_EVENT, handleVariantChange);\n"
    "  }, [userId]);\n\n"
    "  useEffect(() => {\n"
    "    setStorageReady(false);\n",
    "catalog variant effects",
)
content = replace_once(
    content,
    "  useEffect(() => {\n"
    "    if (previewFixture) {\n"
    "      const previewState = previewFixture.state || 'ready';\n",
    "  useEffect(() => {\n"
    "    if (usePreviousReading) {\n"
    "      setCategoryLoading(false);\n"
    "      setCategoryError(null);\n"
    "      return;\n"
    "    }\n"
    "    if (previewFixture) {\n"
    "      const previewState = previewFixture.state || 'ready';\n",
    "catalog category guard",
)
content = replace_once(
    content,
    "      .catch((loadError) => {\n"
    "        if (!cancelled && !cached) setCategoryError(formatLoadError(loadError, language));\n"
    "      })\n",
    "      .catch((loadError) => {\n"
    "        if (cancelled || cached) return;\n"
    "        const code = natalCatalogErrorCode(loadError);\n"
    "        if (activeCategory === DEFAULT_CATEGORY && readingVariant === 'auto') {\n"
    "          setCatalogFallbackCode(code);\n"
    "          return;\n"
    "        }\n"
    "        setCategoryError(formatLoadError(loadError, language));\n"
    "      })\n",
    "catalog main fallback catch",
)
content = replace_once(
    content,
    "  }, [activeCategory, cacheIdentity, categoryRetryToken, chartId, language, previewFixture, userId]);\n\n"
    "  useEffect(() => {\n"
    "    if (previewFixture) {\n",
    "  }, [\n"
    "    activeCategory,\n"
    "    cacheIdentity,\n"
    "    categoryRetryToken,\n"
    "    chartId,\n"
    "    language,\n"
    "    previewFixture,\n"
    "    readingVariant,\n"
    "    usePreviousReading,\n"
    "    userId,\n"
    "  ]);\n\n"
    "  useEffect(() => {\n"
    "    if (usePreviousReading) {\n"
    "      setAnswerLoading(false);\n"
    "      setAnswerError(null);\n"
    "      return;\n"
    "    }\n"
    "    if (previewFixture) {\n",
    "catalog answer guard",
)
content = replace_once(
    content,
    "    selectedAnswerKey,\n"
    "    userId,\n"
    "  ]);\n\n"
    "  useEffect(() => {\n"
    "    if (!selectedAnswerKey || selectedAnswer?.answerKey !== selectedAnswerKey) return;\n",
    "    selectedAnswerKey,\n"
    "    usePreviousReading,\n"
    "    userId,\n"
    "  ]);\n\n"
    "  useEffect(() => {\n"
    "    if (!selectedAnswerKey || selectedAnswer?.answerKey !== selectedAnswerKey) return;\n",
    "catalog answer dependencies",
)
content = replace_once(
    content,
    "  return (\n"
    "    <article className=\"natal-catalog-report\" aria-label={language === 'ru' ? 'Разбор натальной карты' : 'Natal chart reading'}>\n",
    "  if (usePreviousReading) {\n"
    "    return (\n"
    "      <article className=\"natal-catalog-report natal-catalog-report--previous\" aria-label={language === 'ru' ? 'Предыдущий разбор натальной карты' : 'Previous natal chart reading'}>\n"
    "        {profile.isAdmin ? (\n"
    "          <p className=\"settings-helper-text\" role=\"status\">\n"
    "            {language === 'ru'\n"
    "              ? `Натальный разбор: ${natalReadingVariantLabel(readingVariant, language)}${catalogFallbackCode ? ` · новый вариант отклонён (${catalogFallbackCode})` : ''}`\n"
    "              : `Natal reading: ${natalReadingVariantLabel(readingVariant, language)}${catalogFallbackCode ? ` · new version rejected (${catalogFallbackCode})` : ''}`}\n"
    "          </p>\n"
    "        ) : null}\n"
    "        <HumanReport\n"
    "          profile={profile}\n"
    "          chartData={chartData}\n"
    "          chartId={chartId}\n"
    "          chartSubject={chartSubject}\n"
    "          requestPremium={requestPremium}\n"
    "          hideIntro={hideIntro}\n"
    "          premiumContinuation={premiumContinuation}\n"
    "          onPremiumContinuationHandled={onPremiumContinuationHandled}\n"
    "          canPromotePremium={canPromotePremium}\n"
    "          onOpenQuestions={onOpenQuestions}\n"
    "          surface=\"reading\"\n"
    "        />\n"
    "      </article>\n"
    "    );\n"
    "  }\n\n"
    "  return (\n"
    "    <article className=\"natal-catalog-report\" aria-label={language === 'ru' ? 'Разбор натальной карты' : 'Natal chart reading'}>\n",
    "catalog legacy render",
)
write(path, content)


# Generator: diagnose exact fields, provide previous candidate to repair, and allow one more semantic attempt.
path = "lib/natalReading/reportCatalogGeneration.ts"
content = read(path)
content = replace_once(
    content,
    "const NATAL_REPORT_SEMANTIC_ATTEMPTS = 2;\n",
    "const NATAL_REPORT_SEMANTIC_ATTEMPTS = 3;\n\n"
    "type NatalReportFieldIssue = {\n"
    "  path: string;\n"
    "  reasons: string[];\n"
    "};\n",
    "semantic attempts",
)
old_repair = """function buildSemanticRepairPrompt(
  prompt: string,
  issues: readonly string[],
  language: 'ru' | 'en',
): string {
  const instruction = language === 'ru'
    ? '\\n\\nREPAIR REQUIRED:\\nПредыдущий вариант не прошёл серверную проверку: '
      + JSON.stringify(issues)
      + '. Напиши весь JSON заново. Исправь каждую причину, сохрани только разрешённые evidence_ids и не копируй предыдущий текст.'
    : '\\n\\nREPAIR REQUIRED:\\nThe previous candidate failed server validation: '
      + JSON.stringify(issues)
      + '. Rewrite the complete JSON. Fix every issue, keep only allowed evidence_ids, and do not copy the previous wording.';
  return prompt + instruction;
}
"""
new_repair = """function natalReportFieldReasons(
  value: string,
  built: BuiltNatalModelContext,
): string[] {
  const reasons: string[] = [];
  if (!value) reasons.push('EMPTY_TEXT');
  if (value && hasNatalPersonalityCopyViolation(value)) {
    reasons.push('VOICE_ASTROLOGY_ADVICE_OR_FORBIDDEN_COPY');
  }
  if (value && hasNatalReportCatalogCopyViolation(value)) {
    reasons.push('CATALOG_JARGON_CLICHE_OR_TIME_REFERENCE');
  }
  if (value && !isNatalReliabilityTextAllowed(value, built)) {
    reasons.push('UNRELIABLE_ANGLE_OR_HOUSE_REFERENCE');
  }
  return unique(reasons);
}

function natalReportCategoryFieldIssues(
  raw: RawNatalReportCategoryPayload,
  built: BuiltNatalModelContext,
): NatalReportFieldIssue[] {
  const fields: Array<{ path: string; value: string }> = [];
  const summary = Array.isArray(raw.summary) ? raw.summary : [];
  const observations = Array.isArray(raw.observations) ? raw.observations : [];
  const previews = Array.isArray(raw.previews) ? raw.previews : [];
  const freeAnswers = Array.isArray(raw.free_answers) ? raw.free_answers : [];

  summary.forEach((statement, index) => fields.push({
    path: `summary[${index}].text`,
    value: text(statement?.text),
  }));
  observations.forEach((statement, index) => fields.push({
    path: `observations[${index}].text`,
    value: text(statement?.text),
  }));
  previews.forEach((preview, index) => fields.push({
    path: `previews[${text(preview?.answer_key) || index}].preview`,
    value: text(preview?.preview),
  }));
  freeAnswers.forEach((answer, answerIndex) => {
    const paragraphs = Array.isArray(answer?.paragraphs) ? answer.paragraphs : [];
    paragraphs.forEach((paragraph, paragraphIndex) => fields.push({
      path: `free_answers[${text(answer?.answer_key) || answerIndex}].paragraphs[${paragraphIndex}].text`,
      value: text(paragraph?.text),
    }));
  });

  return fields.flatMap((field) => {
    const reasons = natalReportFieldReasons(field.value, built);
    return reasons.length > 0 ? [{ path: field.path, reasons }] : [];
  });
}

function natalReportAnswerFieldIssues(
  raw: RawNatalReportAnswerPayload,
  built: BuiltNatalModelContext,
): NatalReportFieldIssue[] {
  const paragraphs = Array.isArray(raw.paragraphs) ? raw.paragraphs : [];
  return paragraphs.flatMap((paragraph, index) => {
    const reasons = natalReportFieldReasons(text(paragraph?.text), built);
    return reasons.length > 0
      ? [{ path: `paragraphs[${index}].text`, reasons }]
      : [];
  });
}

function logNatalReportValidation(input: {
  kind: 'category' | 'answer';
  itemKey: string;
  attempt: number;
  issues: readonly string[];
  fieldIssues: readonly NatalReportFieldIssue[];
}): void {
  console.warn('[natal-report-validation]', JSON.stringify({
    kind: input.kind,
    itemKey: input.itemKey,
    attempt: input.attempt,
    issues: input.issues,
    fields: input.fieldIssues,
  }));
}

function buildSemanticRepairPrompt(
  prompt: string,
  issues: readonly string[],
  fieldIssues: readonly NatalReportFieldIssue[],
  previousCandidate: unknown,
  language: 'ru' | 'en',
): string {
  const instruction = language === 'ru'
    ? `

REPAIR REQUIRED:
Предыдущий JSON отклонён сервером.
Перепиши JSON полностью, но не меняй answer_key и используй только разрешённые evidence_ids.
Поля из FIELD_VALIDATION_ISSUES перепиши другими словами.
VOICE_ASTROLOGY_ADVICE_OR_FORBIDDEN_COPY: убери астрологические названия, советы, команды, мистику, психологический и коучинговый жаргон.
CATALOG_JARGON_CLICHE_OR_TIME_REFERENCE: убери клише, запрещённые слова, даты, прогнозы и обещания будущих событий.
UNRELIABLE_ANGLE_OR_HOUSE_REFERENCE: полностью убери упоминание угла или дома, не добавляй оговорку.
Проверь каждое текстовое поле отдельно: одна запрещённая фраза отклонит весь JSON.`
    : `

REPAIR REQUIRED:
The previous JSON was rejected by the server.
Rewrite the complete JSON, keep every answer_key unchanged, and use only allowed evidence_ids.
Rewrite every field listed in FIELD_VALIDATION_ISSUES.
VOICE_ASTROLOGY_ADVICE_OR_FORBIDDEN_COPY: remove visible astrology, advice, commands, mysticism, psychology, and coaching jargon.
CATALOG_JARGON_CLICHE_OR_TIME_REFERENCE: remove clichés, forbidden jargon, dates, predictions, and promises.
UNRELIABLE_ANGLE_OR_HOUSE_REFERENCE: remove the angle or house reference completely; do not qualify it.
Check every text field separately: one forbidden phrase rejects the complete JSON.`;

  return `${prompt}${instruction}

AGGREGATE_VALIDATION_ISSUES:
${JSON.stringify(issues, null, 2)}

FIELD_VALIDATION_ISSUES:
${JSON.stringify(fieldIssues, null, 2)}

PREVIOUS_CANDIDATE_TO_REWRITE:
${JSON.stringify(previousCandidate, null, 2)}`;
}
"""
content = replace_once(content, old_repair, new_repair, "repair helpers")
content = replace_once(
    content,
    "  let validationIssues: string[] = [];\n"
    "  for (let attempt = 1; attempt <= NATAL_REPORT_SEMANTIC_ATTEMPTS; attempt += 1) {\n",
    "  let validationIssues: string[] = [];\n"
    "  let fieldIssues: NatalReportFieldIssue[] = [];\n"
    "  let previousCandidate: RawNatalReportCategoryPayload | null = null;\n"
    "  for (let attempt = 1; attempt <= NATAL_REPORT_SEMANTIC_ATTEMPTS; attempt += 1) {\n",
    "category generation state",
)
content = replace_once(
    content,
    "        : buildSemanticRepairPrompt(basePrompt, validationIssues, language),\n",
    "        : buildSemanticRepairPrompt(\n"
    "            basePrompt,\n"
    "            validationIssues,\n"
    "            fieldIssues,\n"
    "            previousCandidate,\n"
    "            language,\n"
    "          ),\n",
    "category repair call",
)
content = replace_once(
    content,
    "    if (validationIssues.length === 0) validationIssues = ['SEMANTIC_CONTRACT_INVALID'];\n"
    "  }\n"
    "  throw new Error(\n"
    "    'NATAL_REPORT_CATEGORY_VALIDATION_FAILED:' + validationIssues.join(','),\n",
    "    if (validationIssues.length === 0) validationIssues = ['SEMANTIC_CONTRACT_INVALID'];\n"
    "    fieldIssues = natalReportCategoryFieldIssues(raw, built);\n"
    "    previousCandidate = raw;\n"
    "    logNatalReportValidation({\n"
    "      kind: 'category',\n"
    "      itemKey: input.categoryKey,\n"
    "      attempt,\n"
    "      issues: validationIssues,\n"
    "      fieldIssues,\n"
    "    });\n"
    "  }\n"
    "  throw new Error(\n"
    "    'NATAL_REPORT_CATEGORY_VALIDATION_FAILED:'\n"
    "      + unique([\n"
    "        ...validationIssues,\n"
    "        ...fieldIssues.flatMap((issue) => issue.reasons.map((reason) => `${issue.path}:${reason}`)),\n"
    "      ]).slice(0, 16).join(','),\n",
    "category diagnostics",
)
content = replace_once(
    content,
    "  let validationIssues: string[] = [];\n"
    "  for (let attempt = 1; attempt <= NATAL_REPORT_SEMANTIC_ATTEMPTS; attempt += 1) {\n",
    "  let validationIssues: string[] = [];\n"
    "  let fieldIssues: NatalReportFieldIssue[] = [];\n"
    "  let previousCandidate: RawNatalReportAnswerPayload | null = null;\n"
    "  for (let attempt = 1; attempt <= NATAL_REPORT_SEMANTIC_ATTEMPTS; attempt += 1) {\n",
    "answer generation state",
)
content = replace_once(
    content,
    "        : buildSemanticRepairPrompt(basePrompt, validationIssues, language),\n",
    "        : buildSemanticRepairPrompt(\n"
    "            basePrompt,\n"
    "            validationIssues,\n"
    "            fieldIssues,\n"
    "            previousCandidate,\n"
    "            language,\n"
    "          ),\n",
    "answer repair call",
)
content = replace_once(
    content,
    "    if (validationIssues.length === 0) validationIssues = ['SEMANTIC_CONTRACT_INVALID'];\n"
    "  }\n"
    "  throw new Error(\n"
    "    'NATAL_REPORT_ANSWER_VALIDATION_FAILED:' + validationIssues.join(','),\n",
    "    if (validationIssues.length === 0) validationIssues = ['SEMANTIC_CONTRACT_INVALID'];\n"
    "    fieldIssues = natalReportAnswerFieldIssues(raw, built);\n"
    "    previousCandidate = raw;\n"
    "    logNatalReportValidation({\n"
    "      kind: 'answer',\n"
    "      itemKey: input.answerKey,\n"
    "      attempt,\n"
    "      issues: validationIssues,\n"
    "      fieldIssues,\n"
    "    });\n"
    "  }\n"
    "  throw new Error(\n"
    "    'NATAL_REPORT_ANSWER_VALIDATION_FAILED:'\n"
    "      + unique([\n"
    "        ...validationIssues,\n"
    "        ...fieldIssues.flatMap((issue) => issue.reasons.map((reason) => `${issue.path}:${reason}`)),\n"
    "      ]).slice(0, 16).join(','),\n",
    "answer diagnostics",
)
write(path, content)


# Source-contract test for the new behavior.
write(
    "__tests__/natal-reading-variant-contract.test.ts",
    """import fs from 'node:fs';
import path from 'node:path';
import {
  isNatalReadingVariant,
  natalReadingVariantLabel,
} from '../lib/natalReading/readingVariant';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('admin natal reading variants and safe fallback', () => {
  it('accepts only the supported variants', () => {
    expect(isNatalReadingVariant('auto')).toBe(true);
    expect(isNatalReadingVariant('catalog')).toBe(true);
    expect(isNatalReadingVariant('legacy')).toBe(true);
    expect(isNatalReadingVariant('broken')).toBe(false);
    expect(natalReadingVariantLabel('catalog', 'ru')).toBe('Новый');
    expect(natalReadingVariantLabel('legacy', 'en')).toBe('Previous');
  });

  it('places the selector in the admin-only developer settings', () => {
    const settings = read('views/Settings.tsx');
    expect(settings).toContain('profile.isAdmin');
    expect(settings).toContain("['auto', 'Авто', 'Auto'");
    expect(settings).toContain("['catalog', 'Новый', 'New'");
    expect(settings).toContain("['legacy', 'Предыдущий', 'Previous'");
    expect(settings).toContain('writeNatalReadingVariant');
  });

  it('keeps the canonical catalogue component and falls back only in auto mode', () => {
    const report = read('components/NatalReading/NatalCatalogReport.tsx');
    expect(report).toContain('ensureNatalCatalogCategory(');
    expect(report).toContain("readingVariant === 'auto'");
    expect(report).toContain('catalogFallbackCode');
    expect(report).toContain('<HumanReport');
    expect(report).toContain('usePreviousReading');
  });

  it('repairs rejected fields by path and logs no generated text', () => {
    const generator = read('lib/natalReading/reportCatalogGeneration.ts');
    expect(generator).toContain('NATAL_REPORT_SEMANTIC_ATTEMPTS = 3');
    expect(generator).toContain('FIELD_VALIDATION_ISSUES');
    expect(generator).toContain('PREVIOUS_CANDIDATE_TO_REWRITE');
    expect(generator).toContain('natal-report-validation');
    expect(generator).toContain('path: `summary[${index}].text`');
    expect(generator).not.toContain('fields: fields');
  });
});
""",
)
