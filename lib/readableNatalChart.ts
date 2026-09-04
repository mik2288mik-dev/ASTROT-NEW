import type { NatalChartData } from '../types';

type NatalChartCandidate = Partial<NatalChartData> & {
  birth?: { time?: { mode?: string | null } | null } | null;
};

/**
 * A chart does not need a reliable Ascendant when the entered birth time was
 * approximate, ranged, or unknown. Sun and Moon remain enough to render the
 * reliable part of that canonical chart; exact/legacy charts still require it.
 */
export function isReadableNatalChart(value: unknown): value is NatalChartData {
  const chart = value as NatalChartCandidate | null;
  if (!chart?.sun || !chart?.moon) return false;
  const mode = chart.birth?.time?.mode;
  const quality = chart.birthTimeQuality || chart.chartQuality?.birthTimeQuality;
  return mode === 'approximate'
    || mode === 'range'
    || mode === 'unknown'
    || quality === 'approximate'
    || quality === 'unknown'
    || Boolean(chart.rising);
}
