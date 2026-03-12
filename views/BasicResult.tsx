import React, { useEffect, useState } from 'react';
import { getText } from '../constants';
import { getCardById } from '../services/cardsService';

interface BasicResultProps {
  userId: string;
  cardId: number;
  language: string;
  onBack: () => void;
  onOpenFullReport: () => void;
  onOpenProReport: () => void;
}

export const BasicResult: React.FC<BasicResultProps> = ({
  userId,
  cardId,
  language,
  onBack,
  onOpenFullReport,
  onOpenProReport,
}) => {
  const [card, setCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const lang = (language || 'ru') as 'ru' | 'en';

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getCardById(userId, cardId);
        if (res.success && res.card) {
          setCard(res.card);
        } else {
          setNotFound(true);
        }
      } catch (e) {
        console.error('[BasicResult] Load error:', e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId, cardId]);

  const formatDate = (d: string) => {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return lang === 'ru' ? `${day}.${m}.${y}` : `${m}/${day}/${y}`;
  };

  const data = card?.data_json;
  const chartData = data?.success && data?.data ? data.data : null;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-astro-text/60 text-sm">
        {getText(lang, 'loading')}
      </div>
    );
  }

  if (notFound || !card) {
    return (
      <div className="h-full overflow-y-auto px-4 py-8">
        <p className="text-astro-text/70 text-center mb-6">
          {getText(lang, 'basic_result.not_found')}
        </p>
        <button
          onClick={onBack}
          className="w-full py-3 rounded-xl border border-astro-border text-astro-text text-sm font-medium"
        >
          {getText(lang, 'basic_result.back')}
        </button>
      </div>
    );
  }

  const renderBlock = (title: string, item: any) => {
    if (!item || !item.sign) return null;
    const deg = item.degree != null ? ` ${item.degree}°` : '';
    const desc = item.description_short ? (
      <p className="text-xs text-astro-text/70 mt-1">{item.description_short}</p>
    ) : null;
    return (
      <div key={title} className="p-4 rounded-xl bg-astro-bg/80 border border-astro-border/50">
        <div className="font-medium text-astro-text">{title}</div>
        <div className="text-sm text-astro-highlight mt-1">
          {item.sign}{deg}
        </div>
        {desc}
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-hide px-4 pb-8">
      <div className="py-4">
        <h2 className="text-lg font-medium text-astro-text">{card.name || 'Я'}</h2>
        <div className="mt-1 text-sm text-astro-text/70">
          {formatDate(card.birth_date)} · {card.birth_place}
        </div>
      </div>

      {chartData && (
        <div className="space-y-3 mb-6">
          {renderBlock(getText(lang, 'basic_result.sun'), chartData.sun)}
          {renderBlock(getText(lang, 'basic_result.moon'), chartData.moon)}
          {chartData.ascendant && renderBlock(getText(lang, 'basic_result.ascendant'), chartData.ascendant)}
        </div>
      )}

      <div className="space-y-3">
        {card.is_purchased_full ? (
          <div className="py-3 px-4 rounded-xl bg-astro-highlight/10 border border-astro-highlight/30 text-astro-highlight text-sm text-center">
            {getText(lang, 'basic_result.full_opened')}
          </div>
        ) : (
          <button
            onClick={onOpenFullReport}
            className="w-full py-3 px-4 rounded-xl border border-astro-highlight/50 text-astro-highlight text-sm font-medium"
          >
            {getText(lang, 'basic_result.full_btn')}
          </button>
        )}
        {card.is_purchased_pro ? (
          <div className="py-3 px-4 rounded-xl bg-astro-highlight/10 border border-astro-highlight/30 text-astro-highlight text-sm text-center">
            {getText(lang, 'basic_result.pro_opened')}
          </div>
        ) : (
          <button
            onClick={onOpenProReport}
            className="w-full py-3 px-4 rounded-xl border border-astro-highlight/50 text-astro-highlight text-sm font-medium"
          >
            {getText(lang, 'basic_result.pro_btn')}
          </button>
        )}
      </div>

      <button
        onClick={onBack}
        className="w-full mt-6 py-3 rounded-xl border border-astro-border text-astro-text text-sm font-medium"
      >
        {getText(lang, 'basic_result.back')}
      </button>
    </div>
  );
};
