import React from 'react';
import { getText } from '../constants';
import { CosmicSheet } from './lumia-ui/CosmicSheet';

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
        title: 'Сегодня, неделя и месяц',
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
        title: 'Today, week, and month',
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
    <CosmicSheet
      open
      title={copy.title}
      subtitle={copy.tagline}
      closeLabel={copy.close}
      className="premium-preview-cosmic"
      contentClassName="premium-preview-cosmic-content"
      onClose={onClose}
      footer={(
        <button
          type="button"
          onClick={onPurchase}
          className="premium-preview-cosmic-cta"
        >
          {getText(language, 'premium_preview.cta')}
        </button>
      )}
    >
        <p className="premium-preview-cosmic-intro">{copy.subtitle}</p>
        <div className="premium-preview-cosmic-features">
          {copy.features.map((feature) => (
            <div key={feature.title} className="premium-preview-cosmic-feature">
              <span className="premium-preview-cosmic-mark" aria-hidden="true">•</span>
              <div>
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
    </CosmicSheet>
  );
};
