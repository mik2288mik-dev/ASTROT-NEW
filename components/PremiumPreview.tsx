import React from 'react';
import { motion } from 'framer-motion';
import { getText } from '../constants';

interface PremiumPreviewProps {
  language: 'ru' | 'en';
  onClose: () => void;
  onPurchase: () => void;
}

const COPY = {
  ru: {
    title: 'Premium',
    tagline: 'Что откроется',
    subtitle: 'Все личные прогнозы, ответы на вопросы, подробные разборы натальной карты и полная совместимость.',
    close: 'Закрыть',
    features: [
      {
        title: 'Сегодня, неделя, месяц и год',
        desc: 'Готовые личные прогнозы по твоей натальной карте и выбранному периоду.',
      },
      {
        title: 'Ответы на вопросы',
        desc: 'Отношения, работа, деньги и решения — по расчётам нужной даты.',
      },
      {
        title: 'Подробные разборы карты',
        desc: 'Отдельные большие разделы про отношения, деньги, работу и другие темы.',
      },
      {
        title: 'Полная совместимость',
        desc: 'Сравнение двух натальных карт для любви, дружбы, семьи или работы.',
      },
    ],
  },
  en: {
    title: 'Premium',
    tagline: 'What you get',
    subtitle: 'All personal forecasts, question answers, detailed natal readings, and full compatibility.',
    close: 'Close',
    features: [
      {
        title: 'Today, week, month, and year',
        desc: 'Ready-to-read personal forecasts based on your natal chart and selected period.',
      },
      {
        title: 'Answers to your questions',
        desc: 'Relationships, work, money, and decisions based on the calculation for that period.',
      },
      {
        title: 'Detailed natal readings',
        desc: 'Full sections about relationships, money, work, and other subjects.',
      },
      {
        title: 'Full compatibility',
        desc: 'A comparison of two natal charts for romance, friendship, family, or work.',
      },
    ],
  },
} as const;

export const PremiumPreview: React.FC<PremiumPreviewProps> = ({ language, onClose, onPurchase }) => {
  const copy = COPY[language];

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-lg flex items-center justify-center p-4"
      style={{
        paddingTop: 'calc(max(env(safe-area-inset-top, 0px), var(--tg-content-safe-area-inset-top, 0px)) + 1rem)',
        paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), var(--tg-content-safe-area-inset-bottom, 0px)) + 1rem)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-astro-bg w-full max-w-md rounded-2xl border border-astro-border p-6 relative overflow-hidden"
      >
        <div className="absolute -top-20 -right-20 w-56 h-56 bg-accent-gold/10 rounded-full blur-3xl pointer-events-none" aria-hidden />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-astro-subtext hover:text-astro-text"
          aria-label={copy.close}
        >
          ×
        </button>

        <h2 className="text-2xl font-bold font-serif text-astro-text mb-2 text-center">{copy.title}</h2>
        <p className="text-center text-[10px] uppercase tracking-widest text-accent-gold">{copy.tagline}</p>
        <p className="mt-3 mb-8 text-center text-sm leading-relaxed text-astro-subtext">{copy.subtitle}</p>

        <div className="space-y-4 mb-8">
          {copy.features.map((feature, index) => (
            <div key={feature.title} className="flex items-center gap-4 bg-astro-card p-3 rounded-lg border border-astro-border">
              <div className="w-8 h-8 rounded-full bg-accent-gold/15 flex items-center justify-center text-[10px] font-semibold uppercase tracking-widest text-accent-gold shrink-0">
                {String(index + 1).padStart(2, '0')}
              </div>
              <div className="min-w-0">
                <h4 className="text-astro-text text-sm font-bold">{feature.title}</h4>
                <p className="text-astro-subtext text-xs">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onPurchase}
          className="w-full bg-accent-gold text-white py-4 rounded-full font-bold uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-md ring-1 ring-black/10"
        >
          {getText(language, 'premium_preview.cta')}
        </button>
      </motion.div>
    </div>
  );
};
