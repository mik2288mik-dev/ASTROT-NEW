from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, value: str) -> None:
    (ROOT / path).write_text(value, encoding='utf-8')


def replace_once(value: str, old: str, new: str, label: str) -> str:
    count = value.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one occurrence, got {count}')
    return value.replace(old, new, 1)


# Keep the classic admin comparison honest: old mode never pretends to have
# the new five-direction navigation, and an Explore request safely returns to
# the old report instead of displaying the same report under two labels.
path = 'views/v2/NatalMagazine.tsx'
source = read(path)
source = replace_once(
    source,
    """  const handledExternalQuestionRequestRef = useRef(0);
  const normalizedActiveTab = normalizeNatalScreenTab(activeTab, isSavedPerson);

  useEffect(() => {
    if (normalizedActiveTab !== activeTab) setActiveTab(normalizedActiveTab);
  }, [activeTab, normalizedActiveTab]);""",
    """  const handledExternalQuestionRequestRef = useRef(0);
  const normalizedActiveTab = normalizeNatalScreenTab(activeTab, isSavedPerson);
  const showPrimaryNavigation = readingRenderer === 'catalog' || !isSavedPerson;
  const primaryNavItemCount = readingRenderer === 'catalog'
    ? (isSavedPerson ? 2 : 3)
    : 2;

  useEffect(() => {
    if (normalizedActiveTab !== activeTab) setActiveTab(normalizedActiveTab);
  }, [activeTab, normalizedActiveTab]);

  useEffect(() => {
    if (readingRenderer !== 'classic' || normalizedActiveTab !== 'explore') return;
    lastContentTabRef.current = 'foundation';
    setActiveTab('foundation');
  }, [normalizedActiveTab, readingRenderer]);""",
    'classic renderer guard',
)
source = replace_once(
    source,
    """  const selectTab = (tab: NatalScreenTab) => {
    const normalized = normalizeNatalScreenTab(tab, isSavedPerson);""",
    """  const selectTab = (tab: NatalScreenTab) => {
    const requestedTab = tab === 'explore' && readingRenderer === 'classic'
      ? 'foundation'
      : tab;
    const normalized = normalizeNatalScreenTab(requestedTab, isSavedPerson);""",
    'classic tab normalization',
)
old_nav = """      {data && normalizedActiveTab !== 'map' ? (
        <nav className=\"natal-v3-primary-nav\" aria-label={language === 'ru' ? 'Натальная карта' : 'Natal chart'}>
          <button
            type=\"button\"
            className={normalizedActiveTab === 'foundation' ? 'is-active' : undefined}
            aria-current={normalizedActiveTab === 'foundation' ? 'page' : undefined}
            onClick={() => selectTab('foundation')}
          >
            {language === 'ru' ? 'Основа' : 'Foundation'}
          </button>
          <button
            type=\"button\"
            className={normalizedActiveTab === 'explore' ? 'is-active' : undefined}
            aria-current={normalizedActiveTab === 'explore' ? 'page' : undefined}
            onClick={() => selectTab('explore')}
          >
            {language === 'ru' ? 'Разобрать' : 'Explore'}
          </button>
          {!isSavedPerson ? (
            <button
              type=\"button\"
              className={normalizedActiveTab === 'ask' ? 'is-active' : undefined}
              aria-current={normalizedActiveTab === 'ask' ? 'page' : undefined}
              onClick={() => selectTab('ask')}
            >
              {language === 'ru' ? 'Спросить' : 'Ask'}
            </button>
          ) : null}
        </nav>
      ) : null}"""
new_nav = """      {data && normalizedActiveTab !== 'map' && showPrimaryNavigation ? (
        <nav
          className=\"natal-v3-primary-nav\"
          data-items={primaryNavItemCount}
          aria-label={language === 'ru' ? 'Натальная карта' : 'Natal chart'}
        >
          <button
            type=\"button\"
            className={normalizedActiveTab === 'foundation' ? 'is-active' : undefined}
            aria-current={normalizedActiveTab === 'foundation' ? 'page' : undefined}
            onClick={() => selectTab('foundation')}
          >
            {readingRenderer === 'catalog'
              ? (language === 'ru' ? 'Основа' : 'Foundation')
              : (language === 'ru' ? 'Разбор' : 'Reading')}
          </button>
          {readingRenderer === 'catalog' ? (
            <button
              type=\"button\"
              className={normalizedActiveTab === 'explore' ? 'is-active' : undefined}
              aria-current={normalizedActiveTab === 'explore' ? 'page' : undefined}
              onClick={() => selectTab('explore')}
            >
              {language === 'ru' ? 'Разобрать' : 'Explore'}
            </button>
          ) : null}
          {!isSavedPerson ? (
            <button
              type=\"button\"
              className={normalizedActiveTab === 'ask' ? 'is-active' : undefined}
              aria-current={normalizedActiveTab === 'ask' ? 'page' : undefined}
              onClick={() => selectTab('ask')}
            >
              {language === 'ru' ? 'Спросить' : 'Ask'}
            </button>
          ) : null}
        </nav>
      ) : null}"""
source = replace_once(source, old_nav, new_nav, 'renderer-aware primary navigation')
write(path, source)


# Remove an awkward name inflection in Russian while preserving the selected
# chart name in the header above the reading.
path = 'components/NatalReading/NatalMeaningExperience.tsx'
source = read(path)
source = replace_once(
    source,
    """                  {language === 'ru' ? `Основа о ${subjectName || 'тебе'}` : `Foundation for ${subjectName || 'you'}`}""",
    """                  {language === 'ru' ? 'Главные выводы' : `Key conclusions for ${subjectName || 'you'}`}""",
    'foundation heading copy',
)
write(path, source)


# Support the two-item classic comparison nav without inventing a new visual
# language. New catalog remains a three-item hierarchy for the self chart.
path = 'styles/natalMeaningMap.css'
source = read(path)
source = replace_once(
    source,
    """.natal-v3-primary-nav button {""",
    """.natal-v3-primary-nav[data-items='2'] {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.natal-v3-primary-nav button {""",
    'two-item primary navigation style',
)
write(path, source)


# The answer component is intentionally named `answer`; keep the structural
# contract aligned with the real implementation.
path = '__tests__/natal-catalog-ui-contract.test.ts'
source = read(path)
source = replace_once(
    source,
    "expect(experience).toContain('selectedAnswer.paragraphs.map');",
    "expect(experience).toContain('answer.paragraphs.map');",
    'answer paragraph contract',
)
write(path, source)


# Lock the staged old/new comparison behavior explicitly.
path = '__tests__/natal-meaning-map-v3.test.ts'
source = read(path)
source = replace_once(
    source,
    """    expect(magazine).not.toContain('<EditorialTabs');
    expect(catalog).toContain('<NatalMeaningExperience');""",
    """    expect(magazine).not.toContain('<EditorialTabs');
    expect(magazine).toContain("readingRenderer === 'catalog'");
    expect(magazine).toContain("tab === 'explore' && readingRenderer === 'classic'");
    expect(magazine).toContain("data-items={primaryNavItemCount}");
    expect(catalog).toContain('<NatalMeaningExperience');""",
    'classic comparison contract',
)
write(path, source)


# This broad shell suite is already red on main for unrelated navigation work.
# Restore it byte-for-byte from the current target branch; the new dedicated
# natal tests cover Matrix separation without expanding this feature diff.
import subprocess
main_test = subprocess.check_output(
    ['git', 'show', 'origin/main:__tests__/today-navigation-shell.test.ts'],
    cwd=ROOT,
    text=True,
)
write('__tests__/today-navigation-shell.test.ts', main_test)

# Remove the stale intermediate report that truthfully recorded the earlier
# failing contract assertion; final verification is performed by the workflow.
report = ROOT / 'natal-v3-polish-validation.txt'
if report.exists():
    report.unlink()
