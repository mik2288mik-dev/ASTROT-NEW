import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('natal personality product flow', () => {
  it('keeps the complete Free portrait on an explicit personality route', () => {
    const app = read('App.tsx');
    const magazine = read('views/v2/NatalMagazine.tsx');

    expect(app).toContain("onboardingTargetViewRef = useRef<ViewState>('dashboard')");
    expect(app).toContain('const openPersonalityReport = useCallback(() => {');
    expect(app).toContain("openNatalSetupOnboarding(viewRef.current, 'personality')");
    expect(app).toContain("navigateTo('personality')");
    expect(app).toContain('<PersonalityReport');
    expect(app).toContain('onOpenPersonalityReport={openPersonalityReport}');
    expect(magazine).toContain('onOpenPersonalityReport: () => void');
  });

  it('uses selected saved snapshots and the existing compatibility route without Swiss calls', () => {
    const app = read('App.tsx');
    const view = read('views/PersonalityReport.tsx');

    expect(view).toContain('getCharts(profile.id, { repairPrimary: false })');
    expect(view).toContain('isCanonicalNatalChartDataComplete(primaryChart.chart_data)');
    expect(view).toContain('isCanonicalNatalChartDataComplete(selectedChart.chart_data)');
    expect(view).not.toMatch(/calculateNatalChart|createOrReuseCanonicalChart|createChart\(/);
    expect(view).toContain('Сравнить со мной');
    expect(view).toContain('Открыть натальную карту');
    expect(app).toContain('openSynastryWithPrefill({');
    expect(app).toContain("source: 'saved-chart'");
    expect(app).toContain('partnerChartId: selected.id');
  });

  it('keeps evidence and professional chart facts closed by default', () => {
    const report = read('components/NatalReading/HumanReport.tsx');

    expect(report).toContain('<details className="natal-evidence-disclosure">');
    expect(report).not.toContain('Почему так?');
    expect(report).toContain('Как это связано с картой');
    expect(report).toContain('<details className="natal-technical-details');
    expect(report).toContain('Как это видно в карте');
    expect(report).not.toContain('<details open');
  });

  it('shows the current subject name even when a chart-stable cached report has an older name', () => {
    const report = read('components/NatalReading/HumanReport.tsx');

    expect(report).toContain("subjectName || report?.userName || (language === 'ru' ? 'Твоя карта' : 'Your chart')");
  });

  it('lets every grounded assistant answer reveal its evidence', () => {
    const report = read('components/NatalReading/HumanReport.tsx');

    expect(report).toContain('function questionMessageEvidenceIds');
    expect(report).toContain("message.role === 'assistant'");
    expect(report).toContain('evidenceIds={questionMessageEvidenceIds(answer)}');
  });

  it('keeps natal-question failures localized and recoverable', () => {
    const report = read('components/NatalReading/HumanReport.tsx');

    expect(report).toContain("value?.code === 'NATAL_QUESTION_GENERATION_FAILED'");
    expect(report).toContain('Не удалось подготовить ответ по карте. Попробуй отправить вопрос ещё раз.');
    expect(report).not.toContain("return value?.message || (language === 'ru'");
    expect(report).toContain('setQuestionError(formatQuestionError(submitError, language))');
    expect(report).not.toContain('void loadNatalQuestionSnapshot(userId, chartId)\n        .then(setQuestionSnapshot)');
    expect(report).toContain('setUnansweredQuestionText(pendingText)');
    expect(report).toContain('Предыдущий вопрос остался без ответа. Отправь его ещё раз — лимит не спишется.');
    expect(report).toContain('Boolean(unansweredQuestionText && !canRetryUnanswered)');
  });
});
