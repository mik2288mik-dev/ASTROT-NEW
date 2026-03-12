import React, { useEffect, useState } from 'react';
import { getText } from '../constants';
import { getCardById } from '../services/cardsService';
import type { Language, Card, FullReport as FullReportType } from '../types';

interface FullReportProps {
  userId: string;
  cardId: number;
  language: string;
  onBack: () => void;
}

const SECTION_KEYS: Array<{ key: keyof FullReportType; titleKey: string }> = [
  { key: 'summary', titleKey: 'full_report.summary' },
  { key: 'personality', titleKey: 'full_report.personality' },
  { key: 'emotions', titleKey: 'full_report.emotions' },
  { key: 'relationships', titleKey: 'full_report.relationships' },
  { key: 'career', titleKey: 'full_report.career' },
  { key: 'karmic_vector', titleKey: 'full_report.karmic_vector' },
];

export const FullReport: React.FC<FullReportProps> = ({ userId, cardId, language, onBack }) => {
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const lang = (language || 'ru') as Language;

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getCardById(userId, cardId);
        if (res.success && res.card) {
          setCard(res.card as Card);
        }
      } catch (e: any) {
        console.error('[FullReport] Load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId, cardId]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-astro-text/60 text-sm">
        {getText(lang, 'loading')}
      </div>
    );
  }

  const report: FullReportType | undefined =
    card?.full_report ||
    (card?.data_json?.full_report as FullReportType | undefined);

  if (!report) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center">
        <h3 className="text-base font-semibold text-astro-text mb-2">
          {getText(lang, 'full_report.unavailable')}
        </h3>
        <p className="text-sm text-astro-text/50 mb-6 max-w-[260px]">
          {getText(lang, 'full_report.unavailable_desc')}
        </p>
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl border border-astro-border text-astro-text/70 text-sm"
        >
          {getText(lang, 'full_report.back')}
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-hide px-4 pb-10">
      <div className="pt-4 pb-2">
        <h2 className="text-lg font-semibold text-astro-text">
          {getText(lang, 'full_report.title')}
        </h2>
        {card?.name && (
          <p className="text-sm text-astro-text/50 mt-0.5">{card.name}</p>
        )}
      </div>

      <div className="mt-4 space-y-5">
        {SECTION_KEYS.map(({ key, titleKey }) => {
          const content = report[key];
          if (!content || key === 'generated_at') return null;
          return (
            <section key={key}>
              <h3 className="text-sm font-semibold text-astro-highlight uppercase tracking-wider mb-2">
                {getText(lang, titleKey)}
              </h3>
              <div className="text-sm text-astro-text/85 leading-relaxed whitespace-pre-line">
                {content}
              </div>
            </section>
          );
        })}
      </div>

      <button
        onClick={onBack}
        className="w-full mt-8 py-3 rounded-2xl border border-astro-border text-astro-text/60 text-sm transition-colors active:bg-astro-card/40"
      >
        {getText(lang, 'full_report.back')}
      </button>
    </div>
  );
};
