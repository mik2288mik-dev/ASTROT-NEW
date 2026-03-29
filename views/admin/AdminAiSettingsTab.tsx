import React, { useCallback, useEffect, useState } from 'react';
import type { UserProfile } from '../../types';
import { fetchAdminAiSettings, saveAdminAiModel } from '../../services/adminService';
import { AdminButton, AdminSectionHeader, AdminSelect, AdminStateBanner, AdminSurface } from './AdminPrimitives';

type Props = { profile: UserProfile };

const T = (lang: 'ru' | 'en', ru: string, en: string) => (lang === 'ru' ? ru : en);

export const AdminAiSettingsTab: React.FC<Props> = ({ profile }) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const [options, setOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [modelId, setModelId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'success' | 'error' | 'info'>('info');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await fetchAdminAiSettings();
      setOptions(data.options || []);
      setModelId(data.modelId || '');
    } catch (error: any) {
      setMessageTone('error');
      setMessage(error?.message || T(lang, 'Не удалось загрузить настройки', 'Failed to load settings'));
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await saveAdminAiModel(modelId);
      setMessageTone('success');
      setMessage(T(lang, 'Модель сохранена', 'Model saved'));
      await load();
    } catch (error: any) {
      setMessageTone('error');
      setMessage(error?.message || T(lang, 'Не удалось сохранить модель', 'Failed to save model'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {message ? <AdminStateBanner tone={messageTone}>{message}</AdminStateBanner> : null}

      <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
        <AdminSectionHeader
          eyebrow="AI"
          title={T(lang, 'Модель интерпретаций', 'Interpretation model')}
          subtitle={T(
            lang,
            'Единая модель для натала, гороскопа, Deep Dive, синастрии и Oracle. Меняйте её здесь без ручной правки окружения.',
            'One model for natal, horoscope, Deep Dive, synastry, and Oracle. Change it here without editing environment values.'
          )}
        />

        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="admin-surface-muted p-4 sm:p-5">
            <label className="admin-field-label" htmlFor="admin-ai-model">
              {T(lang, 'Активная модель', 'Active model')}
            </label>
            {loading ? (
              <p className="text-sm leading-6 text-slate-400">{T(lang, 'Загружаем доступные модели…', 'Loading available models…')}</p>
            ) : (
              <AdminSelect
                id="admin-ai-model"
                value={modelId}
                onChange={(event) => setModelId(event.target.value)}
              >
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} ({option.id})
                  </option>
                ))}
              </AdminSelect>
            )}
          </div>

          <div className="admin-surface-muted p-4 sm:p-5">
            <p className="admin-label">{T(lang, 'Подсказка', 'Guidance')}</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {T(
                lang,
                'Если OpenAI отклоняет конкретный model id, выберите другой вариант здесь. Это изменение сразу влияет на основные интерпретационные поверхности Lumia.',
                'If OpenAI rejects a specific model id, choose another one here. The change affects Lumia’s main interpretation surfaces immediately.'
              )}
            </p>
            <div className="mt-5">
              <AdminButton tone="primary" disabled={saving || !modelId || loading} onClick={() => void onSave()}>
                {saving ? T(lang, 'Сохраняем…', 'Saving…') : T(lang, 'Сохранить модель', 'Save model')}
              </AdminButton>
            </div>
          </div>
        </div>
      </AdminSurface>
    </div>
  );
};
