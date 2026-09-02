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
  { value: 'auto', ru: 'Авто', en: 'Auto' },
  { value: 'catalog', ru: 'Новый', en: 'New' },
  { value: 'classic', ru: 'Старый', en: 'Old' },
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
        {language === 'en' ? 'Natal chart version' : 'Вариант натальной карты'}
      </p>
      <div
        className="settings-selection-list"
        role="radiogroup"
        aria-label={language === 'en' ? 'Natal chart version' : 'Вариант натальной карты'}
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
          ? 'Auto opens the new version. If it does not answer, the old one opens instead. This choice applies only on this device.'
          : 'Авто открывает новый вариант. Если он не отвечает, откроется старый. Выбор действует только на этом устройстве.'}
      </p>
    </div>
  );
};
