import React, { useState } from 'react';
import { UserProfile } from '../types';
import { getText } from '../constants';

export interface BirthDataSubmit {
  name: string;
  birth_date: string;
  birth_time: string | null;
  birth_place: string;
  time_unknown: boolean;
}

interface BirthDataInputProps {
  userProfile: UserProfile;
  onBack: () => void;
  onSubmit: (data: BirthDataSubmit) => void | Promise<void>;
}

export const BirthDataInput: React.FC<BirthDataInputProps> = ({
  userProfile,
  onBack,
  onSubmit,
}) => {
  const lang = userProfile.language || 'ru';
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('');
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [birthPlace, setBirthPlace] = useState('');
  const [loading, setLoading] = useState(false);

  const isValid = birthDate.trim().length > 0 && birthPlace.trim().length > 0;
  const timeValue = timeUnknown ? '' : birthTime;

  const handleSubmit = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    try {
      await onSubmit({
        name: userProfile.name || '',
        birth_date: birthDate.trim(),
        birth_time: timeUnknown ? null : (birthTime.trim() || null),
        birth_place: birthPlace.trim(),
        time_unknown: timeUnknown,
      });
    } catch (e) {
      console.error('[BirthDataInput] Error:', e);
      alert('Ошибка расчета карты');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-hide px-4 pb-8">
      <h2 className="text-lg font-semibold text-astro-text pt-4 mb-6">
        {getText(lang, 'birth_input.title')}
      </h2>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-astro-text/80 mb-1.5">
            {getText(lang, 'birth_input.birth_date')}
          </label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 dark:bg-white/[0.03] border border-astro-border/60 text-astro-text focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-astro-text/80 mb-1.5">
            {getText(lang, 'birth_input.birth_time')}
          </label>
          <input
            type="time"
            value={timeValue}
            onChange={(e) => setBirthTime(e.target.value)}
            disabled={timeUnknown}
            className="w-full px-4 py-3 rounded-xl bg-white/5 dark:bg-white/[0.03] border border-astro-border/60 text-astro-text focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer py-1">
          <input
            type="checkbox"
            checked={timeUnknown}
            onChange={(e) => {
              setTimeUnknown(e.target.checked);
              if (e.target.checked) setBirthTime('');
            }}
            className="w-4 h-4 rounded border-astro-border/60 text-blue-600 focus:ring-blue-500/30"
          />
          <span className="text-sm text-astro-text/90">
            {getText(lang, 'birth_input.time_unknown')}
          </span>
        </label>

        {timeUnknown && (
          <p className="text-xs text-amber-600/90 dark:text-amber-500/90 bg-amber-500/10 dark:bg-amber-500/5 px-3 py-2 rounded-lg border border-amber-500/20">
            {getText(lang, 'birth_input.warning')}
          </p>
        )}

        <div>
          <label className="block text-sm font-medium text-astro-text/80 mb-1.5">
            {getText(lang, 'birth_input.birth_place')}
          </label>
          <input
            type="text"
            value={birthPlace}
            onChange={(e) => setBirthPlace(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 dark:bg-white/[0.03] border border-astro-border/60 text-astro-text focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
          />
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl border border-astro-border/60 text-astro-text/80 text-sm font-medium hover:bg-white/5 transition-colors"
        >
          {lang === 'ru' ? 'Назад' : 'Back'}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!isValid || loading}
          className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (lang === 'ru' ? 'Расчёт...' : 'Calculating...') : getText(lang, 'birth_input.submit')}
        </button>
      </div>
    </div>
  );
};
