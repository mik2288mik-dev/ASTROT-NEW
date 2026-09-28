import React, { useMemo, useState } from 'react';
import type { NatalChartData } from '../../types';
import type { NatalChartDataV2 } from '../../lib/natalChartV2Types';
import {
  buildNatalInterpretation,
  type NatalInterpretationEvidence,
  type NatalMeaning,
  type RejectedNatalInterpretationEvidence,
} from '../../lib/natalInterpretation';

type Props = {
  chartData: NatalChartData;
};

function canonical(chart: NatalChartData): NatalChartDataV2 | null {
  const value = chart as unknown as NatalChartDataV2;
  return value?.schemaVersion === 'natal-chart-data-v2' ? value : null;
}

function labelForEvidence(fact: NatalInterpretationEvidence): string {
  if (fact.kind === 'body_sign') return `${fact.bodyKey} · знак ${fact.sign}`;
  if (fact.kind === 'body_house') return `${fact.bodyKey} · дом ${fact.house}`;
  if (fact.kind === 'body_retrograde') return `${fact.bodyKey} · ${fact.retrograde ? 'ретроградное' : 'директное'} движение`;
  if (fact.kind === 'angle_sign') return `${fact.angleKey} · знак ${fact.sign}`;
  if (fact.kind === 'house_cusp') return `куспид ${fact.house} дома · ${fact.sign}`;
  return `${fact.fromKey} · ${fact.aspectType} · ${fact.toKey}`;
}

function rawFact(fact: NatalInterpretationEvidence): string {
  const values = [
    `id=${fact.id}`,
    `kind=${fact.kind}`,
    `reliability=${fact.reliability}`,
    fact.degree != null ? `degree=${fact.degree.toFixed(2)}` : '',
    fact.orb != null ? `orb=${fact.orb.toFixed(2)}` : '',
    fact.phase ? `phase=${fact.phase}` : '',
    fact.sampleCoverage != null ? `coverage=${fact.sampleCoverage}` : '',
  ].filter(Boolean);
  return values.join(' · ');
}

function rejectedLabel(fact: RejectedNatalInterpretationEvidence): string {
  return `${fact.id} · ${fact.reason}`;
}

function MeaningRow(props: {
  fact: NatalInterpretationEvidence;
  meaning: NatalMeaning | null;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="natal-debug-row">
      <button
        type="button"
        className="natal-debug-row-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{labelForEvidence(props.fact)}</span>
        <span>{open ? '−' : '+'}</span>
      </button>
      {open ? (
        <div className="natal-debug-row-body">
          <p className="natal-debug-raw">{rawFact(props.fact)}</p>
          <p><strong>Технически:</strong> {props.meaning?.technicalText || '—'}</p>
          <p><strong>Наш смысл:</strong> {props.meaning?.text || 'НЕТ ИНТЕРПРЕТАЦИИ'}</p>
          <p className="natal-debug-ids">
            <strong>Связь:</strong> {props.meaning?.semanticKey || '—'}
          </p>
        </div>
      ) : null}
    </section>
  );
}

export const NatalInterpretationDebugPanel: React.FC<Props> = ({ chartData }) => {
  const v2 = canonical(chartData);
  const interpretation = useMemo(
    () => v2 ? buildNatalInterpretation(v2, 'ru') : null,
    [v2],
  );
  const [showRejected, setShowRejected] = useState(false);

  if (!v2 || !interpretation) {
    return (
      <section className="natal-debug-panel">
        <h2>Проверка нового натала</h2>
        <p>Нет канонической NatalChartDataV2 — проверять пока нечего.</p>
      </section>
    );
  }

  const meaningByEvidence = new Map<string, NatalMeaning>();
  interpretation.meanings.forEach((meaning) => {
    meaning.evidenceIds.forEach((id) => meaningByEvidence.set(id, meaning));
  });

  return (
    <section className="natal-debug-panel" aria-label="Проверка нового натала">
      <div className="natal-debug-head">
        <div>
          <p className="natal-debug-kicker">Только для администратора · без AI</p>
          <h2>Проверка нового натала</h2>
          <p>
            Здесь видно ровно цепочку «Swiss → надёжный факт → наше объяснение».
            Если смысл кривой, правим интерпретатор, а не Writer.
          </p>
        </div>
      </div>

      <div className="natal-debug-stats">
        <span>Время: <strong>{interpretation.birthTimeQuality}</strong></span>
        <span>Учтено: <strong>{interpretation.evidence.length}</strong></span>
        <span>Объяснений: <strong>{interpretation.meanings.length}</strong></span>
        <span>Не использовано: <strong>{interpretation.rejectedEvidence.length}</strong></span>
      </div>

      <div className="natal-debug-list">
        {interpretation.evidence.map((fact) => (
          <MeaningRow
            key={fact.id}
            fact={fact}
            meaning={meaningByEvidence.get(fact.id) || null}
          />
        ))}
      </div>

      {interpretation.rejectedEvidence.length ? (
        <div className="natal-debug-rejected">
          <button
            type="button"
            className="natal-debug-rejected-toggle"
            aria-expanded={showRejected}
            onClick={() => setShowRejected((value) => !value)}
          >
            {showRejected ? 'Скрыть неиспользованные данные' : 'Показать неиспользованные данные'}
          </button>
          {showRejected ? (
            <div>
              {interpretation.rejectedEvidence.map((fact) => (
                <p key={fact.id}>{rejectedLabel(fact)}</p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
