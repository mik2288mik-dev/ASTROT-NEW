import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ActionTimingKey, ActionTimingRecommendation, NatalChartData, UserProfile } from '../../types';
import { hasActivePremium, hasNatalChart } from '../../lib/accessMatrix';
import { getActionTimingRecommendation } from '../../services/astrologyService';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { ChevronRightIcon } from '../../components/icons/UiIcons';

type Props = {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  onOpenChart?: () => void;
  onRequestPremium?: () => void;
};

const ACTIONS: Array<{ key: ActionTimingKey; ru: string; en: string }> = [
  { key: 'message', ru: 'Написать', en: 'Message' },
  { key: 'serious_talk', ru: 'Разговор', en: 'Talk' },
  { key: 'purchase', ru: 'Покупка', en: 'Purchase' },
  { key: 'work', ru: 'Работа', en: 'Work' },
];

const STATE_META: Record<string, { ru: string; en: string; cls: string }> = {
  now: { ru: 'Сейчас хорошо', en: 'Good now', cls: 'aw-state--now' },
  later: { ru: 'Лучше позже', en: 'Better later', cls: 'aw-state--later' },
  no_edge: { ru: 'Без разницы', en: 'No edge', cls: 'aw-state--flat' },
};

export function ActionWindows({ profile, chartData, chartId, onOpenChart, onRequestPremium }: Props) {
  const ru = profile.language !== 'en';
  const hasChart = hasNatalChart(profile, { chartData, primaryChartId: chartId ?? null });
  const premium = hasActivePremium(profile);

  const [active, setActive] = useState<ActionTimingKey | null>(null);
  const [rec, setRec] = useState<ActionTimingRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const select = async (key: ActionTimingKey) => {
    lumiaSelectionHaptic();
    setActive(key);
    setLoading(true);
    setError(null);
    setRec(null);
    try {
      setRec(await getActionTimingRecommendation(profile, chartData, chartId ?? null, key));
    } catch (e: any) {
      setError(e?.message || (ru ? 'Не удалось рассчитать окно.' : 'Could not calculate the window.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="aw">
      <div className="aw-head">
        <div className="aw-title">{ru ? 'Окна дня' : 'Day windows'}</div>
        <div className="aw-sub">{ru ? 'Когда лучше действовать — по твоей карте' : 'When to act — from your chart'}</div>
      </div>

      {!hasChart ? (
        <button type="button" className="aw-gate" onClick={() => { lumiaSelectionHaptic(); onOpenChart?.(); }}>
          <span>{ru ? 'Нужна твоя натальная карта' : 'Your natal chart is needed'}</span>
          <span className="aw-gate-cta">{ru ? 'Создать' : 'Create'}<ChevronRightIcon size={15} /></span>
        </button>
      ) : !premium ? (
        <button type="button" className="aw-gate" onClick={() => { lumiaSelectionHaptic(); onRequestPremium?.(); }}>
          <span>{ru ? 'Лучшее время для действий — в Premium' : 'Best timing — in Premium'}</span>
          <span className="aw-gate-cta">Premium<ChevronRightIcon size={15} /></span>
        </button>
      ) : (
        <>
          <div className="aw-chips">
            {ACTIONS.map((a) => (
              <button
                key={a.key}
                type="button"
                className={`aw-chip ${active === a.key ? 'active' : ''}`}
                onClick={() => void select(a.key)}
              >
                {ru ? a.ru : a.en}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="aw-muted">{ru ? 'Считаю окно…' : 'Calculating…'}</p>
          ) : error ? (
            <p className="aw-error">{error}</p>
          ) : rec ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={rec.actionKey + rec.date}
                className="aw-result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
              >
                <div className="aw-result-top">
                  <span className={`aw-state ${STATE_META[rec.state]?.cls || ''}`}>
                    {STATE_META[rec.state] ? (ru ? STATE_META[rec.state].ru : STATE_META[rec.state].en) : rec.state}
                  </span>
                  {rec.bestWindow?.label ? <span className="aw-window">{rec.bestWindow.label}</span> : null}
                </div>
                <div className="aw-result-title">{rec.title}</div>
                <p className="aw-result-summary">{rec.summary}</p>
                {rec.reasons?.length ? (
                  <ul className="aw-reasons">
                    {rec.reasons.slice(0, 3).map((r) => <li key={r}>{r}</li>)}
                  </ul>
                ) : null}
                {rec.caution ? <p className="aw-caution">{rec.caution}</p> : null}
              </motion.div>
            </AnimatePresence>
          ) : (
            <p className="aw-muted">{ru ? 'Выбери действие выше — покажу лучшее время.' : 'Pick an action above to see the best time.'}</p>
          )}
        </>
      )}
    </section>
  );
}
