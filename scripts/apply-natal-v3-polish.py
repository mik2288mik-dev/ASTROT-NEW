from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, value: str) -> None:
    (ROOT / path).write_text(value, encoding='utf-8')


def replace_once(value: str, old: str, new: str, label: str) -> str:
    count = value.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, got {count}')
    return value.replace(old, new, 1)


# Fix the optional preview-tab type without allowing an untyped value into the screen state.
path = 'views/v2/NatalMagazine.tsx'
source = read(path)
source = replace_once(
    source,
    """function previewTabToScreen(
  value: NatalMagazineProps['uiPreview'] extends { initialTab?: infer T } ? T : never,
  openQuestion: boolean,
): NatalScreenTab {""",
    """type NatalPreviewInitialTab = NonNullable<NatalMagazineProps['uiPreview']>['initialTab'];

function previewTabToScreen(
  value: NatalPreviewInitialTab,
  openQuestion: boolean,
): NatalScreenTab {""",
    'preview initial-tab type',
)
write(path, source)


# Add the missing user-facing depth choice and make the answer category expression explicit.
path = 'components/NatalReading/NatalMeaningExperience.tsx'
source = read(path)
source = replace_once(
    source,
    """  onWhy: () => void;
}> = ({ statement, language, onWhy }) => {""",
    """  onMeaning: () => void;
  onWhy: () => void;
}> = ({ statement, language, onMeaning, onWhy }) => {""",
    'statement actions props',
)
source = replace_once(
    source,
    """      <button type=\"button\" className=\"natal-v3-inline-action\" onClick={onWhy}>
        {language === 'ru' ? 'Почему так?' : 'Why?'}
      </button>""",
    """      <div className=\"natal-v3-statement-actions\">
        <button type=\"button\" className=\"natal-v3-inline-action\" onClick={onMeaning}>
          {language === 'ru' ? 'Как это выглядит' : 'How this looks'}
        </button>
        <button type=\"button\" className=\"natal-v3-inline-action\" onClick={onWhy}>
          {language === 'ru' ? 'Почему так?' : 'Why?'}
        </button>
      </div>""",
    'statement action buttons',
)
source = replace_once(
    source,
    """  const categoryKey = definition?.categoryKey || preview?.answerKey
    ? definition?.categoryKey || 'main'
    : 'main';""",
    """  const categoryKey: NatalReportCategoryKey = definition?.categoryKey || 'main';""",
    'answer category expression',
)
source = replace_once(
    source,
    """      statement={statement}
      language={language}
      onWhy={() => setExplanation({""",
    """      statement={statement}
      language={language}
      onMeaning={() => {
        const copy = splitLead(statement.text);
        setExplanation({
          mode: 'meaning',
          title: view === 'foundation'
            ? (language === 'ru' ? 'Как это выглядит в жизни' : 'How this looks in life')
            : categoryTitle(activeCategoryKey, language),
          text: copy.body || statement.text,
          evidenceIds: statement.evidenceIds,
        });
      }}
      onWhy={() => setExplanation({""",
    'statement meaning callback',
)
write(path, source)


# Escape closes only the top explanation sheet, not the answer sheet beneath it.
path = 'components/NatalReading/NatalEvidenceSheet.tsx'
source = read(path)
source = replace_once(
    source,
    """    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };""",
    """    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      onClose();
    };""",
    'nested sheet escape handling',
)
write(path, source)


# Do not erase a just-restored paid answer when the parent switches to the matching view.
path = 'components/NatalReading/NatalCatalogReport.tsx'
source = read(path)
source = replace_once(
    source,
    """    if (desiredCategory !== activeCategory) {
      setActiveCategory(desiredCategory);
      setCategoryError(null);
    }
    setSelectedAnswerKey(null);
    setAnswerOriginCategory(null);
    setAnswerError(null);
  }, [view]);""",
    """    if (desiredCategory !== activeCategory) {
      setActiveCategory(desiredCategory);
      setCategoryError(null);
    }
  }, [view]);""",
    'view change answer preservation',
)
source = replace_once(
    source,
    """          section_key: categoryKey,
          access_state: 'navigation',
          source: 'meaning_map',""",
    """          section_key: categoryKey,
          access_state: 'open',
          source: 'meaning_map',""",
    'analytics access state',
)
write(path, source)


# Update the existing question policy contract to the new contextual question surface.
path = '__tests__/natal-question-policy.test.ts'
source = read(path)
source = replace_once(
    source,
    """  it('keeps Ask about yourself in the natal chart only for the self chart', () => {
    const magazine = read('views/v2/NatalMagazine.tsx');

    expect(magazine).toContain(\"type NatalScreenTab = 'map' | 'reading' | 'questions' | 'matrix'\");
    expect(magazine).toContain(\"{ id: 'questions' as const\");
    expect(magazine).toContain(\"availableTabs.filter((tab) => tab.id !== 'questions')\");
    expect(magazine).toContain(\"return isSavedPerson && tab === 'questions' ? 'map' : tab\");
    expect(magazine).toContain(\"if (isSavedPerson && tab === 'questions') return\");
    expect(magazine).toContain('onOpenQuestions={isSavedPerson ? undefined');
    expect(magazine).toContain(\"setActiveTab('questions')\");
    expect(magazine).toContain('surface=\"questions\"');
    expect(magazine).not.toContain('<CosmicSheet');
  });""",
    """  it('keeps contextual questions in the natal chart only for the self chart', () => {
    const magazine = read('views/v2/NatalMagazine.tsx');
    const questions = read('components/NatalReading/NatalQuestionExperience.tsx');

    expect(magazine).toContain(\"export type NatalScreenTab = 'foundation' | 'explore' | 'ask' | 'map'\");
    expect(magazine).toContain(\"return isSavedPerson && tab === 'ask' ? 'foundation' : tab\");
    expect(magazine).toContain('onOpenQuestions={isSavedPerson ? undefined');
    expect(magazine).toContain(\"setActiveTab('ask')\");
    expect(magazine).toContain(\"normalizedActiveTab === 'ask' && !isSavedPerson\");
    expect(magazine).toContain('<NatalQuestionExperience');
    expect(questions).toContain('contextCategory');
    expect(questions).toContain('QUESTION_CONTEXTS');
    expect(magazine).not.toContain('<CosmicSheet');
  });""",
    'saved-person question UI contract',
)
source = replace_once(
    source,
    """  it('offers six fill-only starters and explains the saved-chart boundary', () => {
    const report = read('components/NatalReading/HumanReport.tsx');
    const starterBlock = report.slice(
      report.indexOf('const NATAL_QUESTION_STARTERS'),
      report.indexOf('const ANGLE_NAMES'),
    );

    expect(starterBlock.match(/\\bru:/gu)).toHaveLength(6);
    expect(report).toContain('type=\"button\"');
    expect(report).toContain('setQuestionText(suggestion);');
    expect(report).toContain('Один полный ответ по твоей карте — бесплатно');
    expect(report).toMatch(/до 5 новых вопросов в день/iu);
    expect(report).toContain('Не указывай сведения о здоровье, документы, контакты, пароли или платёжные данные.');
    expect(report).toContain('natal-question-sensitive-data-warning');
  });""",
    """  it('offers contextual fill-only starters and explains the saved-chart boundary', () => {
    const report = read('components/NatalReading/NatalQuestionExperience.tsx');

    expect(report).toContain('const QUESTION_STARTERS');
    expect(report).toContain('character:');
    expect(report).toContain('love:');
    expect(report).toContain('communication:');
    expect(report).toContain('work:');
    expect(report).toContain('money:');
    expect(report).toContain('type=\"button\"');
    expect(report).toContain('setQuestionText(starter);');
    expect(report).toContain('Первый полный ответ — бесплатно.');
    expect(report).toMatch(/до 5 новых вопросов в день/iu);
    expect(report).toContain('Не указывай документы, контакты, пароли, платёжные или медицинские данные.');
    expect(report).toContain('natal-v3-question-warning');
  });""",
    'contextual question starter contract',
)
write(path, source)


# Style the two depth actions as one quiet line rather than two new cards.
path = 'styles/natalMeaningMap.css'
source = read(path)
marker = ".natal-v3-inline-action,\n.natal-v3-text-action {"
if marker not in source:
    raise RuntimeError('statement action CSS marker missing')
addition = """.natal-v3-statement-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px;
  margin-top: 12px;
}

.natal-v3-statement-actions .natal-v3-inline-action {
  margin: -6px 0;
}

"""
source = source.replace(marker, addition + marker, 1)
write(path, source)
