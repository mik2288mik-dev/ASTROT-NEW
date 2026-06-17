import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { NatalChartData } from '../../types';
import {
  computeChartBalance,
  balanceSummaryRu,
  ELEMENT_LABEL_RU,
  ELEMENT_LABEL_EN,
  ELEMENT_COLOR,
  MODALITY_LABEL_RU,
  MODALITY_LABEL_EN,
  type ElementKey,
  type ModalityKey,
} from '../../lib/natal/chartBalance';

const MODALITY_COLOR: Record<ModalityKey, string> = {
  cardinal: '#FF9B6A',
  fixed: '#5BB6EC',
  mutable: '#34C39A',
};

type Row = { label: string; value: number; color: string };

function BalanceRow({ label, value, max, color, index, reduce }: Row & { max: number; index: number; reduce: boolean | null }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="nbal-row">
      <span className="nbal-label">{label}</span>
      <div className="nbal-track">
        <motion.div
          className="nbal-fill"
          style={{ background: `linear-gradient(90deg, ${color}99, ${color})` }}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={reduce ? { duration: 0 } : { duration: 0.7, delay: 0.05 * index, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="nbal-val">{value}</span>
    </div>
  );
}

export function ChartBalance({ chart, language }: { chart: NatalChartData; language: 'ru' | 'en' }) {
  const reduce = useReducedMotion();
  const balance = computeChartBalance(chart);
  if (!balance.total) return null;

  const ru = language === 'ru';
  const elLabel = ru ? ELEMENT_LABEL_RU : ELEMENT_LABEL_EN;
  const modLabel = ru ? MODALITY_LABEL_RU : MODALITY_LABEL_EN;

  const elOrder: ElementKey[] = ['fire', 'earth', 'air', 'water'];
  const modOrder: ModalityKey[] = ['cardinal', 'fixed', 'mutable'];
  const maxEl = Math.max(...elOrder.map((k) => balance.elements[k]), 1);
  const maxMod = Math.max(...modOrder.map((k) => balance.modalities[k]), 1);

  return (
    <section className="nbal">
      <div className="nbal-head">{ru ? 'Карта в цифрах' : 'Chart in numbers'}</div>

      <div className="nbal-group-title">{ru ? 'Стихии' : 'Elements'}</div>
      <div className="nbal-group">
        {elOrder.map((k, i) => (
          <BalanceRow key={k} label={elLabel[k]} value={balance.elements[k]} max={maxEl} color={ELEMENT_COLOR[k]} index={i} reduce={reduce} />
        ))}
      </div>

      <div className="nbal-group-title">{ru ? 'Как ты действуешь' : 'How you act'}</div>
      <div className="nbal-group">
        {modOrder.map((k, i) => (
          <BalanceRow key={k} label={modLabel[k]} value={balance.modalities[k]} max={maxMod} color={MODALITY_COLOR[k]} index={i} reduce={reduce} />
        ))}
      </div>

      {ru ? <p className="nbal-summary">{balanceSummaryRu(balance)}</p> : null}
    </section>
  );
}
