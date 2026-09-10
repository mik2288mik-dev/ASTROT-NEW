import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import type { UserProfile } from '../../types';
import {
  readNatalReadingVariant,
  subscribeNatalReadingVariant,
  writeNatalReadingVariant,
  type NatalReadingVariant,
} from '../../lib/natalReading/readingVariant';

type Props = {
  profile: Pick<UserProfile, 'id' | 'isAdmin' | 'language'>;
};

const OPTIONS: ReadonlyArray<{
  value: NatalReadingVariant;
  ru: string;
  en: string;
}> = [
  { value: 'auto', ru: 'Авто — безопасный режим', en: 'Auto — safe mode' },
  { value: 'catalog', ru: 'Новый разбор', en: 'New reading' },
  { value: 'classic', ru: 'Старый разбор', en: 'Classic reading' },
];

export const NatalReadingVariantSettings: React.FC<Props> = ({ profile }) => {
  const isAdmin = profile.isAdmin === true;
  const [variant, setVariant] = useState<NatalReadingVariant>(() => (
    readNatalReadingVariant(profile.id, isAdmin)
  ));

  useEffect(() => {
    setVariant(readNatalReadingVariant(profile.id, isAdmin));
    return subscribeNatalReadingVariant(profile.id, isAdmin, (next) => setVariant(next));
  }, [isAdmin, profile.id]);

  if (!isAdmin) return null;
  const language = profile.language === 'en' ? 'en' : 'ru';

  return (
    <div className="settings-natal-variant">
      <p className="settings-detail-intro">
        {language === 'en' ? 'Natal reading version' : 'Версия разбора натальной карты'}
      </p>
      <div
        className="settings-selection-list"
        role="radiogroup"
        aria-label={language === 'en' ? 'Natal reading version' : 'Версия разбора натальной карты'}
      >
        {OPTIONS.map((option) => {
          const selected = option.value === variant;
          return (
            <button
              key={option.value}
              type="button"
              className="settings-selection-row"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                const next = writeNatalReadingVariant(profile.id, true, option.value);
                setVariant(next);
              }}
            >
              <span>{option[language]}</span>
              {selected ? <Check aria-hidden size={16} strokeWidth={2} /> : null}
            </button>
          );
        })}
      </div>
      <p className="settings-helper-text settings-helper-text--spaced">
        {language === 'en'
          ? 'Auto opens the new reading only when it is already ready; otherwise the stable classic reading opens immediately. This setting affects only this administrator on this device.'
          : 'Авто открывает новый разбор, только когда он уже готов. Иначе сразу открывается стабильный старый. Настройка действует только для этого администратора на этом устройстве.'}
      </p>
    </div>
  );
};
