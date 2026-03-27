import React, { useCallback, useEffect, useState } from 'react';
import type { UserProfile } from '../../types';
import { fetchAdminAiSettings, saveAdminAiModel } from '../../services/adminService';

type Props = { profile: UserProfile };

const T = (lang: 'ru' | 'en', ru: string, en: string) => (lang === 'ru' ? ru : en);

export const AdminAiSettingsTab: React.FC<Props> = ({ profile }) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const [options, setOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [modelId, setModelId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await fetchAdminAiSettings();
      setOptions(data.options || []);
      setModelId(data.modelId || '');
    } catch (e: any) {
      setMessage(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await saveAdminAiModel(modelId);
      setMessage(T(lang, 'Модель сохранена', 'Model saved'));
      await load();
    } catch (e: any) {
      setMessage(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-astro-border bg-astro-card/60 p-5">
      <h3 className="font-serif text-lg text-astro-text">
        {T(lang, 'Модель OpenAI для интерпретаций', 'OpenAI model for interpretations')}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
        {T(
          lang,
          'Одна модель для натала, гороскопов, Deep Dive, синастрии и Oracle. Если API вернёт ошибку по имени модели — выберите другую или задайте OPENAI_INTERPRETATION_MODEL в окружении.',
          'One model for natal, horoscopes, Deep Dive, synastry, and Oracle. If the API rejects a model id, pick another or set OPENAI_INTERPRETATION_MODEL in the environment.'
        )}
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-astro-subtext">{T(lang, 'Загрузка…', 'Loading…')}</p>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block text-[10px] uppercase tracking-widest text-astro-subtext">
            {T(lang, 'Модель', 'Model')}
          </label>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="w-full rounded-xl border border-astro-border bg-astro-bg/40 px-3 py-3 text-sm text-astro-text"
          >
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label} ({opt.id})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving || !modelId}
            className="w-full rounded-xl border border-astro-highlight/40 bg-astro-highlight/15 py-3 text-sm font-semibold text-astro-highlight disabled:opacity-50"
          >
            {saving ? T(lang, 'Сохранение…', 'Saving…') : T(lang, 'Сохранить', 'Save')}
          </button>
        </div>
      )}

      {message && <p className="mt-3 text-sm text-astro-text">{message}</p>}
    </div>
  );
};
