import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type {
  NatalChartData,
  UserProfile,
} from '../types';
import { HumanReport, type PreloadedNatalReport } from '../components/NatalReading/HumanReport';
import { AppTopBar } from '../components/lumia-ui/AppTopBar';
import { CosmicSheet } from '../components/lumia-ui/CosmicSheet';
import { formatDisplayDate } from '../lib/date-utils';
import { getChartSubjectType } from '../lib/chartAccessPolicy';
import { isCanonicalNatalChartDataComplete } from '../lib/natalChartCanonical';
import {
  getCharts,
  type ChartListItem,
} from '../services/storageService';

export type PersonalityReportProps = {
  profile: UserProfile;
  primaryChartData: NatalChartData;
  primaryChartId?: number;
  preloadedReport?: PreloadedNatalReport | null;
  requestPremium: () => void;
  onBack: () => void;
  onOpenNatalChart: (chart: ChartListItem | null) => void;
  onCompareWithMe: (chart: ChartListItem) => void;
};

type ChartsLoadState = 'loading' | 'ready' | 'error';

export function PersonalityReport({
  profile,
  primaryChartData,
  primaryChartId,
  preloadedReport,
  requestPremium,
  onBack,
  onOpenNatalChart,
  onCompareWithMe,
}: PersonalityReportProps) {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const [charts, setCharts] = useState<ChartListItem[]>([]);
  const [chartsLoadState, setChartsLoadState] = useState<ChartsLoadState>('loading');
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedChartId, setSelectedChartId] = useState<number | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);

  useEffect(() => {
    setSelectedChartId(null);
    setCharts([]);
  }, [profile.id]);

  useEffect(() => {
    let active = true;
    if (!profile.id) {
      setChartsLoadState('error');
      return () => { active = false; };
    }

    setChartsLoadState('loading');
    void getCharts(profile.id, { repairPrimary: false })
      .then((response) => {
        if (!active) return;
        setCharts(response.charts);
        setChartsLoadState('ready');
      })
      .catch(() => {
        if (!active) return;
        setChartsLoadState('error');
      });

    return () => { active = false; };
  }, [profile.id, reloadToken]);

  const primaryChart = useMemo(
    () => charts.find((chart) => getChartSubjectType(chart) === 'self') ?? null,
    [charts],
  );
  const resolvedPrimaryChartData = primaryChart
    && isCanonicalNatalChartDataComplete(primaryChart.chart_data)
      ? primaryChart.chart_data
      : primaryChartData;
  const savedCharts = useMemo(
    () => charts.filter((chart) => getChartSubjectType(chart) === 'saved_person'),
    [charts],
  );
  const selectedChart = useMemo(
    () => savedCharts.find((chart) => chart.id === selectedChartId) ?? null,
    [savedCharts, selectedChartId],
  );

  useEffect(() => {
    if (chartsLoadState === 'ready' && selectedChartId !== null && !selectedChart) {
      setSelectedChartId(null);
    }
  }, [chartsLoadState, selectedChart, selectedChartId]);

  const isSelf = selectedChart === null;
  const subjectName = selectedChart?.name || profile.name;
  const subjectBirthDate = selectedChart?.birth_date || profile.birthDate;
  const selectedChartData = selectedChart
    && isCanonicalNatalChartDataComplete(selectedChart.chart_data)
      ? selectedChart.chart_data
      : null;
  const chartData = selectedChartData || resolvedPrimaryChartData;
  const chartId = selectedChart?.id ?? primaryChart?.id ?? primaryChartId;
  const chartSubject = selectedChart;
  const waitingForPrimaryId = isSelf
    && primaryChartId == null
    && chartsLoadState === 'loading';
  const reportKey = selectedChart
    ? `saved-person:${selectedChart.id}`
    : `self:${chartId ?? 'primary'}`;

  const selectSelf = () => {
    setSelectedChartId(null);
    setSelectorOpen(false);
  };

  const selectSavedChart = (chart: ChartListItem) => {
    if (chart.access_locked) {
      setSelectorOpen(false);
      requestPremium();
      return;
    }
    setSelectedChartId(chart.id);
    setSelectorOpen(false);
  };

  return (
    <div className="fresh-page personality-report-page">
      <AppTopBar
        title={language === 'ru' ? 'Разбор личности' : 'Personality reading'}
        onBack={onBack}
      />

      <main className="personality-report-main">
        <section className="personality-report-subject" aria-labelledby="personality-report-subject-label">
          <p id="personality-report-subject-label" className="personality-report-subject-label">
            {language === 'ru' ? 'Кого разбираем' : 'Whose chart'}
          </p>
          <button
            type="button"
            className="personality-report-subject-button"
            aria-haspopup="dialog"
            aria-expanded={selectorOpen}
            onClick={() => setSelectorOpen(true)}
          >
            <span>
              <strong>{subjectName || (language === 'ru' ? 'Ты' : 'You')}</strong>
              {subjectBirthDate ? (
                <small>{formatDisplayDate(subjectBirthDate, language)}</small>
              ) : null}
            </span>
            <ChevronDown aria-hidden="true" size={20} strokeWidth={1.8} />
          </button>

          {chartsLoadState === 'error' ? (
            <div className="personality-report-list-error" role="status">
              <span>
                {language === 'ru'
                  ? 'Другие сохранённые карты пока не загрузились.'
                  : 'Other saved charts could not be loaded.'}
              </span>
              <button type="button" onClick={() => setReloadToken((value) => value + 1)}>
                {language === 'ru' ? 'Повторить' : 'Retry'}
              </button>
            </div>
          ) : null}
        </section>

        <p className="personality-report-selection-status" aria-live="polite">
          {language === 'ru' ? `Открыт разбор: ${subjectName}` : `Reading open: ${subjectName}`}
        </p>

        <div className="personality-report-reading">
          {selectedChart && !selectedChartData ? (
            <div className="personality-report-reading-error" role="alert">
              {language === 'ru'
                ? 'У сохранённого человека нет готового снимка карты. Открой натальную карту и проверь данные — разбор не будет подменять её твоей картой.'
                : 'This saved person has no ready chart snapshot. Open the natal chart and check the data; the reading will not substitute your own chart.'}
            </div>
          ) : waitingForPrimaryId ? (
            <div className="personality-report-loading" role="status">
              {language === 'ru' ? 'Открываем разбор…' : 'Opening the reading…'}
            </div>
          ) : (
            <HumanReport
              key={reportKey}
              profile={profile}
              chartData={chartData}
              chartId={chartId}
              chartSubject={chartSubject}
              requestPremium={requestPremium}
              preloadedReport={isSelf ? preloadedReport : null}
            />
          )}
        </div>

        <footer className="personality-report-actions" aria-label={language === 'ru' ? 'Действия с разбором' : 'Reading actions'}>
          {selectedChart && selectedChartData ? (
            <button
              type="button"
              className="personality-report-action personality-report-action--primary"
              onClick={() => onCompareWithMe(selectedChart)}
            >
              {language === 'ru' ? 'Сравнить со мной' : 'Compare with me'}
            </button>
          ) : null}
          <button
            type="button"
            className={`personality-report-action${selectedChart ? ' personality-report-action--secondary' : ' personality-report-action--primary'}`}
            onClick={() => onOpenNatalChart(selectedChart)}
          >
            {language === 'ru' ? 'Открыть натальную карту' : 'Open natal chart'}
          </button>
        </footer>
      </main>

      <CosmicSheet
        open={selectorOpen}
        title={language === 'ru' ? 'Выбери человека' : 'Choose a person'}
        subtitle={language === 'ru'
          ? 'Разбор использует уже рассчитанную натальную карту.'
          : 'The reading uses an existing calculated natal chart.'}
        closeLabel={language === 'ru' ? 'Закрыть' : 'Close'}
        onClose={() => setSelectorOpen(false)}
        contentClassName="personality-report-sheet-content"
      >
        <ul className="personality-report-subject-list">
          <li>
            <button
              type="button"
              className="personality-report-subject-option"
              aria-pressed={isSelf}
              onClick={selectSelf}
            >
              <span>
                <strong>{profile.name || (language === 'ru' ? 'Я' : 'Me')}</strong>
                <small>{language === 'ru' ? 'Моя карта' : 'My chart'}</small>
              </span>
              {isSelf ? <Check aria-hidden="true" size={20} /> : null}
            </button>
          </li>

          {savedCharts.map((chart) => {
            const selected = chart.id === selectedChart?.id;
            return (
              <li key={chart.id}>
                <button
                  type="button"
                  className="personality-report-subject-option"
                  aria-pressed={selected}
                  onClick={() => selectSavedChart(chart)}
                >
                  <span>
                    <strong>{chart.name}</strong>
                    <small>
                      {chart.access_locked
                        ? (language === 'ru' ? 'Доступно в Premium' : 'Available with Premium')
                        : [chart.relation_label, formatDisplayDate(chart.birth_date, language)].filter(Boolean).join(' · ')}
                    </small>
                  </span>
                  {selected ? <Check aria-hidden="true" size={20} /> : null}
                </button>
              </li>
            );
          })}
        </ul>

        {chartsLoadState === 'loading' ? (
          <p className="personality-report-sheet-state" role="status">
            {language === 'ru' ? 'Загружаем сохранённые карты…' : 'Loading saved charts…'}
          </p>
        ) : chartsLoadState === 'ready' && savedCharts.length === 0 ? (
          <p className="personality-report-sheet-state">
            {language === 'ru' ? 'Пока здесь только ты.' : 'For now, it is just you.'}
          </p>
        ) : chartsLoadState === 'error' ? (
          <button
            type="button"
            className="personality-report-sheet-retry"
            onClick={() => setReloadToken((value) => value + 1)}
          >
            {language === 'ru' ? 'Загрузить карты ещё раз' : 'Load charts again'}
          </button>
        ) : null}
      </CosmicSheet>
    </div>
  );
}
