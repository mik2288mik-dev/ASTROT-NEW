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

  it('renders personality through the unified interpretation path instead of HumanReport', () => {
    const view = read('views/PersonalityReport.tsx');
    const unified = read('components/NatalReading/NatalUnifiedReport.tsx');

    expect(view).toContain("import { NatalUnifiedReport } from '../components/NatalReading/NatalUnifiedReport';");
    expect(view).toContain('<NatalUnifiedReport');
    expect(view).not.toContain('HumanReport');
    expect(unified).toContain('buildNatalInterpretation');
    expect(unified).toContain('ensureNatalUnifiedReading');
    expect(unified).toContain('getNatalUnifiedReadingCached');
    expect(unified).not.toContain('ensureHumanBaseReport');
    expect(unified).not.toContain('ensureHumanPremiumReport');
  });

  it('lets every finished grounded assistant answer reveal its evidence', () => {
    const questions = read('components/NatalReading/NatalQuestionExperience.tsx');

    expect(questions).toContain('function questionMessageEvidenceIds');
    expect(questions).toContain("if (message.role !== 'assistant') continue;");
    expect(questions).toContain('evidenceIds: questionMessageEvidenceIds(answer)');
    expect(questions).toContain('На чём основано');
    expect(questions).toContain('<NatalEvidenceSheet');
  });

  it('keeps natal-question failures localized and recoverable', () => {
    const questions = read('components/NatalReading/NatalQuestionExperience.tsx');

    expect(questions).toContain("value?.code === 'NATAL_QUESTION_GENERATION_FAILED'");
    expect(questions).toContain('Не удалось закончить ответ. Отправь этот же вопрос ещё раз, лимит не спишется.');
    expect(questions).toContain('setError(formatQuestionError(submitError, language))');
    expect(questions).toContain('setUnansweredQuestionText(value)');
    expect(questions).toContain('Предыдущий вопрос остался без ответа. Отправь его ещё раз, лимит не спишется.');
    expect(questions).toContain('Boolean(unansweredQuestionText && !canRetryUnanswered)');
  });

  it('builds evidence disclosure from the unified interpretation layer', () => {
    const evidence = read('components/NatalReading/NatalEvidenceSheet.tsx');

    expect(evidence).toContain('buildNatalInterpretation');
    expect(evidence).not.toContain('buildNatalModelContext');
  });
});
