import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { NatalChartData } from '../../types';
import {
  computeChartBalance,
  balanceSummaryRu,
  ELEMENT_LABEL_RU,
  ELEMENT_LABEL_EN,
  type ElementKey,
} from '../../lib/natal/chartBalance';

const ELEMENT_TONE: Record<ElementKey, string> = {
  fire: '#1478FF',
  earth: '#2563EB',
  air: '#38BDF8',
  water: '#64748B',
};

/**
 * «Стихии в карте» — один аккуратный спектр-бар + легенда. Без крестов/жаргона,
 * подписи в легенде (не наезжают на шкалу). Считается локально из карты.
 */
export function ChartBalance({ chart, language }: { chart: NatalChartData; language: 'ru' | 'en' }) {
  const reduce = useReducedMotion();
  const balance = computeChartBalance(chart);
  if (!balance.total) return null;

  const ru = language === 'ru';
  const order: ElementKey[] = ['fire', 'earth', 'air', 'water'];
  const labels = ru ? ELEMENT_LABEL_RU : ELEMENT_LABEL_EN;

  return (
    <section className="cib">
      <div className="cib-head">{ru ? 'Стихии в твоей карте' : 'Elements in your chart'}</div>

      <motion.div
        className="cib-bar"
        style={{ transformOrigin: 'left' }}
        initial={reduce ? false : { scaleX: 0, opacity: 0.6 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={reduce ? { duration: 0 } : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {order.map((k) => {
          const pct = (balance.elements[k] / balance.total) * 100;
          if (pct <= 0) return null;
          return <span key={k} className="cib-seg" style={{ flexGrow: pct, background: ELEMENT_TONE[k] }} />;
        })}
      </motion.div>

      <div className="cib-legend">
        {order.map((k) => (
          <div key={k} className="cib-leg">
            <span className="cib-leg-dot" style={{ background: ELEMENT_TONE[k] }} />
            <span className="cib-leg-name">{labels[k]}</span>
            <span className="cib-leg-val">{balance.elements[k]}</span>
          </div>
        ))}
      </div>

      {ru ? <p className="cib-summary">{balanceSummaryRu(balance)}</p> : null}
    </section>
  );
}
