import React from 'react';
import { lumiaSelectionHaptic } from '../../lib/haptics';

export type MyChartSegment = 'natal' | 'matrix' | 'numbers' | 'tarot' | 'runes';

type MyChartHeaderProps = {
  /** Serif title of the current part, e.g. «Натальная карта». */
  title: string;
  /** Small line under it, e.g. «Михаил · Рыбы». */
  subtitle?: string;
  active: MyChartSegment;
  onOpen: (segment: MyChartSegment) => void;
};

const SEGMENTS: ReadonlyArray<{ id: MyChartSegment; label: string }> = [
  { id: 'natal', label: 'Карта' },
  { id: 'matrix', label: 'Матрица' },
  { id: 'numbers', label: 'Числа' },
  { id: 'tarot', label: 'Таро' },
  { id: 'runes', label: 'Руны' },
];

/** «Чья карта»: the saved chart that is open now. Sits in the top bar in place of the NEBO brand. */
export function ChartWhoseButton({ label, onChoose }: { label: string; onChoose: () => void }) {
  return (
    <button type="button" className="nebo-mychart-whose" onClick={onChoose}>
      <span>{label}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </button>
  );
}

/** «Моя карта» as on the canvas: the serif title and the switch between its parts. */
export function MyChartHeader({ title, subtitle, active, onOpen }: MyChartHeaderProps) {
  return (
    <div className="nebo-mychart-header">
      <div className="nebo-page-title" data-glyph={active}>
        <h1>{title}</h1>
        <p>{subtitle || '\u00a0'}</p>
      </div>
      <nav className="nebo-mychart-switch" aria-label="Разделы моей карты">
        {SEGMENTS.map((segment) => (
          <button
            key={segment.id}
            type="button"
            aria-pressed={segment.id === active}
            onClick={() => {
              if (segment.id === active) return;
              lumiaSelectionHaptic();
              onOpen(segment.id);
            }}
          >
            {segment.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
