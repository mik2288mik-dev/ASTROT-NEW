import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ContentType } from '../types';

interface RegenerateButtonProps {
  userId: string;
  contentType: ContentType;
  isPremium: boolean;
  language: 'ru' | 'en';
  profile: any;
  chartData?: any;
  partnerData?: any;
  onRegenerate: (newData: any) => void;
  onRequestPremium?: () => void;
  className?: string;
}

type ButtonState = 'idle' | 'loading' | 'success' | 'error' | 'limit_reached';

export const RegenerateButton: React.FC<RegenerateButtonProps> = ({
  userId,
  contentType,
  isPremium,
  language,
  profile,
  chartData,
  partnerData,
  onRegenerate,
  onRequestPremium,
  className = ''
}) => {
  const [state, setState] = useState<ButtonState>('idle');
  const [showTooltip, setShowTooltip] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(true);

  const lang = language === 'ru';

  const texts = {
    idle: lang ? 'Рассказать по-другому' : 'Tell differently',
    loading: lang ? 'Пересказываю…' : 'Retelling…',
    success: lang ? 'Готово!' : 'Done!',
    error: lang ? 'Ошибка' : 'Error',
    limitReached: lang ? 'Доступно завтра' : 'Available tomorrow',
    premiumOnly: lang ? 'Рассказать по-другому (Премиум)' : 'Tell differently (Premium)',
    tooltipFree: lang 
      ? 'Если захочешь — я могу пересказать твой разбор другими словами, но не чаще одного раза в день 💫'
      : 'If you want — I can retell your reading in different words, but not more than once a day 💫',
    tooltipPaid: lang
      ? 'Следующая регенерация будет стоить 50 звёзд ⭐'
      : 'Next regeneration will cost 50 stars ⭐',
    tooltipLimit: lang
      ? 'Сегодня ты уже менял текст. Я смогу рассказать иначе завтра 🌗'
      : 'You already changed the text today. I can tell it differently tomorrow 🌗',
  };

  const handleClick = async () => {
    if (!isPremium) {
      if (onRequestPremium) {
        onRequestPremium();
      }
      return;
    }

    if (state === 'loading') return;

    setState('loading');
    setErrorMessage('');

    try {
      const response = await fetch('/api/astrology/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          contentType,
          profile,
          chartData,
          partnerData
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.message?.includes('звёзд')) {
          setState('limit_reached');
          setErrorMessage(data.message);
        } else {
          setState('error');
          setErrorMessage(data.message || 'Что-то пошло не так');
        }
        setTimeout(() => setState('idle'), 3000);
        return;
      }

      // Успех
      setState('success');
      setIsFirstTime(false);
      onRegenerate(data.data);

      // Вернуться к idle через 2 секунды
      setTimeout(() => setState('idle'), 2000);
    } catch (error: any) {
      console.error('[RegenerateButton] Error:', error);
      setState('error');
      setErrorMessage(error.message || 'Network error');
      setTimeout(() => setState('idle'), 3000);
    }
  };

  // Для не-премиум пользователей
  if (!isPremium) {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={handleClick}
          className="group w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-astro-border/30 bg-astro-card/50 text-astro-subtext hover:border-astro-highlight/50 transition-all relative overflow-hidden"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <span className="text-lg opacity-30">🔒</span>
          <span className="text-xs uppercase tracking-widest font-bold opacity-50">
            {texts.premiumOnly}
          </span>
        </button>

        <AnimatePresence>
          {showTooltip && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-astro-highlight text-white text-xs rounded-lg whitespace-nowrap shadow-lg z-50"
            >
              {texts.premiumOnly}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Для премиум пользователей
  const isDisabled = state === 'loading' || state === 'limit_reached';

  return (
    <div className={`relative ${className}`}>
      <motion.button
        onClick={handleClick}
        disabled={isDisabled}
        className={`group w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all relative overflow-hidden ${
          state === 'idle' 
            ? 'border-astro-highlight/30 bg-astro-card hover:bg-astro-highlight hover:border-astro-highlight hover:text-white text-astro-text'
            : state === 'loading'
            ? 'border-astro-highlight/50 bg-astro-highlight/10 text-astro-highlight cursor-wait'
            : state === 'success'
            ? 'border-green-400/50 bg-green-400/10 text-green-400'
            : state === 'error'
            ? 'border-red-400/50 bg-red-400/10 text-red-400'
            : 'border-astro-border/30 bg-astro-card/50 text-astro-subtext cursor-not-allowed'
        }`}
        whileHover={!isDisabled ? { scale: 1.02 } : {}}
        whileTap={!isDisabled ? { scale: 0.98 } : {}}
        onMouseEnter={() => !isDisabled && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Icon */}
        <motion.span
          className="text-lg"
          animate={state === 'loading' ? { rotate: 360 } : {}}
          transition={{ duration: 1.5, repeat: state === 'loading' ? Infinity : 0, ease: 'linear' }}
        >
          {state === 'idle' && '🔄'}
          {state === 'loading' && '⏳'}
          {state === 'success' && '✨'}
          {state === 'error' && '⚠️'}
          {state === 'limit_reached' && '🌗'}
        </motion.span>

        {/* Text */}
        <span className="text-xs uppercase tracking-widest font-bold">
          {state === 'idle' && texts.idle}
          {state === 'loading' && texts.loading}
          {state === 'success' && texts.success}
          {state === 'error' && (errorMessage || texts.error)}
          {state === 'limit_reached' && texts.limitReached}
        </span>

        {/* Background animation */}
        {state === 'success' && (
          <motion.div
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 bg-green-400/20 rounded-lg"
          />
        )}
      </motion.button>

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && state === 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-4 py-2 bg-astro-card border border-astro-border text-astro-text text-xs rounded-lg max-w-xs text-center shadow-lg z-50"
          >
            {isFirstTime ? texts.tooltipFree : texts.tooltipPaid}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Limit reached message */}
      <AnimatePresence>
        {state === 'limit_reached' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 px-3 py-2 bg-astro-bg border border-astro-border rounded-lg text-xs text-astro-subtext text-center"
          >
            {texts.tooltipLimit}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
