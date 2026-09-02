import React, { useEffect, useState } from 'react';
import {
  Settings as SettingsBase,
  type SettingsProps,
} from './SettingsBase';
import {
  NATAL_READING_VARIANT_CHANGED_EVENT,
  natalReadingVariantLabel,
  readNatalReadingVariant,
  writeNatalReadingVariant,
  type NatalReadingVariant,
  type NatalReadingVariantChangedDetail,
} from '../lib/natalReading/readingVariant';

export type { SettingsProps } from './SettingsBase';

const VARIANTS: ReadonlyArray<{
  value: NatalReadingVariant;
  ru: { title: string; description: string };
  en: { title: string; description: string };
}> = [
  {
    value: 'auto',
    ru: {
      title: 'Авто',
      description: 'Открывать новый разбор. Если он не собрался — сразу показывать предыдущий.',
    },
    en: {
      title: 'Auto',
      description: 'Open the new reading and immediately use the previous one if generation fails.',
    },
  },
  {
    value: 'catalog',
    ru: {
      title: 'Новый разбор',
      description: 'Всегда проверять новый каталог. Ошибки не скрываются предыдущим вариантом.',
    },
    en: {
      title: 'New reading',
      description: 'Always test the new catalogue. Errors are not hidden by the previous version.',
    },
  },
  {
    value: 'legacy',
    ru: {
      title: 'Предыдущий разбор',
      description: 'Использовать старый стабильный экран и генератор.',
    },
    en: {
      title: 'Previous reading',
      description: 'Use the previous stable screen and generator.',
    },
  },
];

export const Settings: React.FC<SettingsProps> = (props) => {
  const userId = String(props.profile.id || '');
  const language: 'ru' | 'en' = props.profile.language === 'en' ? 'en' : 'ru';
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<NatalReadingVariant>(() => (
    readNatalReadingVariant(userId, props.profile.isAdmin)
  ));

  useEffect(() => {
    setVariant(readNatalReadingVariant(userId, props.profile.isAdmin));
  }, [props.profile.isAdmin, userId]);

  useEffect(() => {
    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<NatalReadingVariantChangedDetail>).detail;
      if (!detail || detail.userId !== userId) return;
      setVariant(detail.variant);
    };
    window.addEventListener(NATAL_READING_VARIANT_CHANGED_EVENT, handleChange);
    return () => window.removeEventListener(NATAL_READING_VARIANT_CHANGED_EVENT, handleChange);
  }, [userId]);

  const selectVariant = (next: NatalReadingVariant) => {
    setVariant(next);
    writeNatalReadingVariant(userId, next);
    setOpen(false);
  };

  return (
    <>
      <SettingsBase {...props} />
      {props.profile.isAdmin ? (
        <>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            style={{
              position: 'fixed',
              right: 14,
              bottom: 88,
              zIndex: 240,
              minHeight: 40,
              padding: '9px 13px',
              border: '1px solid rgba(15, 23, 42, 0.14)',
              borderRadius: 999,
              background: 'rgba(255, 255, 255, 0.96)',
              boxShadow: '0 8px 30px rgba(15, 23, 42, 0.12)',
              color: '#111827',
              fontSize: 12,
              fontWeight: 650,
            }}
          >
            {language === 'ru' ? 'Натал' : 'Natal'}: {natalReadingVariantLabel(variant, language)}
          </button>
          {open ? (
            <div
              role="presentation"
              onMouseDown={(event) => {
                if (event.currentTarget === event.target) setOpen(false);
              }}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 500,
                display: 'grid',
                placeItems: 'end center',
                padding: 16,
                background: 'rgba(15, 23, 42, 0.32)',
              }}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-natal-variant-title"
                style={{
                  width: 'min(100%, 520px)',
                  maxHeight: '80vh',
                  overflowY: 'auto',
                  padding: 18,
                  borderRadius: 24,
                  background: '#ffffff',
                  boxShadow: '0 24px 80px rgba(15, 23, 42, 0.24)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                      {language === 'ru' ? 'Только для администратора' : 'Administrator only'}
                    </p>
                    <h2 id="admin-natal-variant-title" style={{ margin: '5px 0 0', fontSize: 21 }}>
                      {language === 'ru' ? 'Вариант натального разбора' : 'Natal reading version'}
                    </h2>
                  </div>
                  <button
                    type="button"
                    aria-label={language === 'ru' ? 'Закрыть' : 'Close'}
                    onClick={() => setOpen(false)}
                    style={{
                      width: 36,
                      height: 36,
                      border: 0,
                      borderRadius: 18,
                      background: '#f1f5f9',
                      fontSize: 21,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ display: 'grid', gap: 9, marginTop: 18 }}>
                  {VARIANTS.map((option) => {
                    const copy = option[language];
                    const selected = option.value === variant;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => selectVariant(option.value)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto',
                          gap: 12,
                          width: '100%',
                          padding: 14,
                          border: selected ? '1.5px solid #111827' : '1px solid #e2e8f0',
                          borderRadius: 16,
                          background: selected ? '#f8fafc' : '#ffffff',
                          color: '#0f172a',
                          textAlign: 'left',
                        }}
                      >
                        <span>
                          <strong style={{ display: 'block', fontSize: 15 }}>{copy.title}</strong>
                          <small style={{ display: 'block', marginTop: 4, color: '#64748b', lineHeight: 1.4 }}>
                            {copy.description}
                          </small>
                        </span>
                        <span style={{ alignSelf: 'center', minWidth: 62, textAlign: 'right', fontSize: 12 }}>
                          {selected ? (language === 'ru' ? 'Выбрано' : 'Selected') : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p style={{ margin: '14px 2px 0', color: '#64748b', fontSize: 12, lineHeight: 1.45 }}>
                  {language === 'ru'
                    ? 'Выбор хранится только для этого администратора на этом устройстве и применяется при следующем открытии карты.'
                    : 'The choice is stored only for this administrator on this device and applies the next time the chart opens.'}
                </p>
              </section>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
};
