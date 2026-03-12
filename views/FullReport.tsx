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
        <p className="text-sm text-astro-text/55 mb-6 max-w-[260px]">
          {getText(lang, 'full_report.unavailable_desc')}
        </p>
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl border border-astro-border/60 text-astro-text/70 text-sm font-medium hover:bg-white/5"
        >
          {getText(lang, 'full_report.back')}
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-hide px-4 pb-10">
      <div className="pt-4 pb-4">
        <h2 className="text-lg font-semibold text-astro-text">
          {getText(lang, 'full_report.title')}
        </h2>
        {card?.name && (
          <p className="text-sm text-astro-text/55 mt-1">{card.name}</p>
        )}
      </div>

      <div className="max-w-[65ch] space-y-6">
        {SECTION_KEYS.map(({ key, titleKey }) => {
          const content = report[key];
          if (!content || key === 'generated_at') return null;
          return (
            <section key={key} className="border-b border-astro-border/40 pb-6 last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-3">
                {getText(lang, titleKey)}
              </h3>
              <div className="text-sm text-astro-text/90 leading-relaxed whitespace-pre-line">
                {content}
              </div>
            </section>
          );
        })}
      </div>

      <button
        onClick={onBack}
        className="w-full mt-8 py-3 rounded-xl border border-astro-border/60 text-astro-text/60 text-sm font-medium hover:bg-white/5 transition-colors"
      >
        {getText(lang, 'full_report.back')}
      </button>
    </div>
  );
};
