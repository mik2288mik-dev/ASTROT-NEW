import React, { useEffect, useState } from 'react';
import { getText, getZodiacSign } from '../constants';
import { getCardById } from '../services/cardsService';
import { spendLumi } from '../services/lumiService';
import type { Language, Card } from '../types';

interface BasicResultProps {
  userId: string;
  cardId: number;
  language: string;
  onBack: () => void;
  onOpenFullReport: () => void;
  onOpenProReport: () => void;
}

function parseDataJson(raw: any): any {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return null; }
  }
  if (raw?.data?.sun) return raw.data;
  if (raw?.sun) return raw;
  return null;
}

export const BasicResult: React.FC<BasicResultProps> = ({
  userId,
  cardId,
  language,
  onBack,
  onOpenFullReport,
  onOpenProReport,
}) => {
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [purchaseLoadingFull, setPurchaseLoadingFull] = useState(false);
  const [purchaseLoadingPro, setPurchaseLoadingPro] = useState(false);
  const lang = (language || 'ru') as Language;

  const loadCard = async () => {
    try {
      const res = await getCardById(userId, cardId);
      if (res.success && res.card) {
        setCard(res.card as Card);
      } else {
        setNotFound(true);
      }
    } catch (e: any) {
      console.error('[BasicResult] Load error:', e);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCard();
  }, [userId, cardId]);

  const formatDate = (d: string) => {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return lang === 'ru' ? `${day}.${m}.${y}` : `${m}/${day}/${y}`;
  };

  const handleBuyFull = async () => {
    if (purchaseLoadingFull || !card) return;
    setPurchaseLoadingFull(true);
    try {
      const res = await spendLumi(userId, cardId, 'full_report', 300);
      if (res.success) {
        await loadCard();
        onOpenFullReport();
      }
    } catch (e: any) {
      console.error('[BasicResult] Full report purchase error:', e);
      const msg = e?.message || getText(lang, 'basic_result.error_generic');
      alert(msg);
    } finally {
      setPurchaseLoadingFull(false);
    }
  };

  const handleBuyPro = async () => {
    if (purchaseLoadingPro || !card) return;
    setPurchaseLoadingPro(true);
    try {
      const res = await spendLumi(userId, cardId, 'pro_report', 200);
      if (res.success) {
        await loadCard();
        onOpenProReport();
      }
    } catch (e: any) {
      console.error('[BasicResult] Pro report purchase error:', e);
      const msg = e?.message || getText(lang, 'basic_result.error_generic');
      alert(msg);
    } finally {
      setPurchaseLoadingPro(false);
    }
  };

  const chartData = parseDataJson(card?.data_json);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-astro-text/60 text-sm">
        {getText(lang, 'loading')}
      </div>
    );
  }

  if (notFound || !card) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6">
        <p className="text-astro-text/60 text-sm mb-6">
          {getText(lang, 'basic_result.not_found')}
        </p>
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl border border-astro-border text-astro-text/80 text-sm"
        >
          {getText(lang, 'basic_result.back')}
        </button>
      </div>
    );
  }

  const renderPlanetBlock = (titleKey: string, item: any) => {
    if (!item || !item.sign) return null;
    const signLocalized = getZodiacSign(lang, item.sign);
    const deg = item.degree != null ? `${Number(item.degree).toFixed(1)}°` : null;
    return (
      <div className="p-4 rounded-2xl bg-astro-card/60 border border-astro-border">
        <div className="text-xs font-medium text-astro-text/50 uppercase tracking-wider mb-1">
          {getText(lang, titleKey)}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold text-astro-text">{signLocalized}</span>
          {deg && <span className="text-sm text-astro-text/50">{deg}</span>}
        </div>
        {item.description_short && (
          <p className="text-xs text-astro-text/60 mt-1.5 leading-relaxed">{item.description_short}</p>
        )}
      </div>
    );
  };

  const hasAscendant = chartData?.ascendant && chartData.ascendant.sign;

  return (
    <div className="h-full overflow-y-auto scrollbar-hide px-4 pb-10">
      {/* Card header */}
      <div className="pt-4 pb-5">
        <h2 className="text-lg font-semibold text-astro-text">{card.name || 'Я'}</h2>
        <p className="text-sm text-astro-text/50 mt-0.5">
          {formatDate(card.birth_date)} · {card.birth_place}
        </p>
      </div>

      {/* Planet blocks */}
      {chartData && (
        <div className="space-y-3 mb-6">
          {renderPlanetBlock('basic_result.sun', chartData.sun)}
          {renderPlanetBlock('basic_result.moon', chartData.moon)}
          {hasAscendant
            ? renderPlanetBlock('basic_result.ascendant', chartData.ascendant)
            : (
              <div className="p-4 rounded-2xl border border-astro-border/50 border-dashed">
                <div className="text-xs font-medium text-astro-text/50 uppercase tracking-wider mb-1">
                  {getText(lang, 'basic_result.ascendant')}
                </div>
                <p className="text-sm text-astro-text/40">
                  {getText(lang, 'basic_result.ascendant_unavailable')}
                </p>
              </div>
            )
          }
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-3">
        {/* Full Report button */}
        {card.is_purchased_full ? (
          <button
            onClick={onOpenFullReport}
            className="w-full py-3.5 rounded-2xl bg-astro-highlight/10 border border-astro-highlight/25 text-astro-highlight text-sm font-medium transition-colors active:bg-astro-highlight/20"
          >
            {getText(lang, 'basic_result.full_opened')}
          </button>
        ) : (
          <button
            onClick={handleBuyFull}
            disabled={purchaseLoadingFull}
            className="w-full py-3.5 rounded-2xl bg-astro-highlight text-white text-sm font-semibold transition-opacity disabled:opacity-60"
          >
            {purchaseLoadingFull
              ? getText(lang, 'basic_result.full_loading')
              : getText(lang, 'basic_result.full_btn')
            }
          </button>
        )}

        {/* Pro Report button */}
        {card.is_purchased_pro ? (
          <button
            onClick={onOpenProReport}
            className="w-full py-3.5 rounded-2xl bg-astro-highlight/10 border border-astro-highlight/25 text-astro-highlight text-sm font-medium transition-colors active:bg-astro-highlight/20"
          >
            {getText(lang, 'basic_result.pro_opened')}
          </button>
        ) : card.is_purchased_full ? (
          <button
            onClick={handleBuyPro}
            disabled={purchaseLoadingPro}
            className="w-full py-3.5 rounded-2xl border border-astro-highlight/40 text-astro-highlight text-sm font-medium transition-opacity disabled:opacity-60"
          >
            {purchaseLoadingPro
              ? getText(lang, 'basic_result.pro_loading')
              : getText(lang, 'basic_result.pro_btn')
            }
          </button>
        ) : (
          <div className="w-full py-3.5 rounded-2xl border border-astro-border/50 text-center">
            <span className="text-sm text-astro-text/30">
              {getText(lang, 'basic_result.pro_btn')}
            </span>
            <p className="text-xs text-astro-text/25 mt-0.5">
              {getText(lang, 'basic_result.pro_locked')}
            </p>
          </div>
        )}
      </div>

      {/* Back button */}
      <button
        onClick={onBack}
        className="w-full mt-6 py-3 rounded-2xl border border-astro-border text-astro-text/60 text-sm transition-colors active:bg-astro-card/40"
      >
        {getText(lang, 'basic_result.back')}
      </button>
    </div>
  );
};
