import React from 'react';
import { CosmicSheet } from './lumia-ui/CosmicSheet';

interface PremiumPreviewProps {
  language: 'ru' | 'en';
  onClose: () => void;
  onPurchase: () => void;
}

const COPY = {
  ru: {
    title: 'NEBO Premium',
    tagline: 'Полный доступ к личным разделам.',
    subtitle: 'Подписка открывает то, что уже есть в NEBO: личные прогнозы, карту и совместимость по данным рождения.',
    close: 'Закрыть',
    features: [
      {
        title: 'Личный прогноз',
        desc: 'Полный Today, а также личные неделя и месяц.',
      },
      {
        title: 'Натальная карта',
        desc: 'Глубокий разбор карты и личности, включая вопросы по карте.',
      },
      {
        title: 'Совместимость',
        desc: 'Сравнение по данным рождения двух людей.',
      },
      {
        title: 'Дополнительные карты',
        desc: 'До 5 сохранённых карт помимо своей.',
      },
    ],
  },
  en: {
    title: 'NEBO Premium',
    tagline: 'Full access to personal sections.',
    subtitle: 'A subscription opens what already exists in NEBO: personal forecasts, chart readings, and birth-data compatibility.',
    close: 'Close',
    features: [
      {
        title: 'Personal forecast',
        desc: 'Full Today, plus your personal week and month.',
      },
      {
        title: 'Natal chart',
        desc: 'Deep chart and personality readings, including chart questions.',
      },
      {
        title: 'Compatibility',
        desc: 'A birth-data comparison of two people.',
      },
      {
        title: 'Additional charts',
        desc: 'Up to 5 saved charts in addition to your own.',
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
          {language === 'ru' ? 'Выбрать подписку' : 'Choose a subscription'}
        </button>
      )}
    >
        <p className="premium-preview-cosmic-intro">{copy.subtitle}</p>
        <dl className="premium-preview-cosmic-features">
          {copy.features.map((feature) => (
            <div key={feature.title} className="premium-preview-cosmic-feature">
              <div>
                <dt>{feature.title}</dt>
                <dd>{feature.desc}</dd>
              </div>
            </div>
          ))}
        </dl>
    </CosmicSheet>
  );
};
