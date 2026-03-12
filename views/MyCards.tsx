import React, { useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { getText } from '../constants';
import { getCards } from '../services/cardsService';
import { getBalance } from '../services/lumiService';

interface MyCardsProps {
  userId: string;
  userProfile: UserProfile;
  onOpenShop: () => void;
  onAddCard: () => void;
  onOpenCard: (cardId: number) => void;
}

interface CardItem {
  id: number;
  user_id: string;
  name: string;
  birth_date: string;
  birth_time: string | null;
  birth_place: string;
  is_purchased_full: boolean;
  is_purchased_pro: boolean;
}

export const MyCards: React.FC<MyCardsProps> = ({
  userId,
  userProfile,
  onOpenShop,
  onAddCard,
  onOpenCard,
}) => {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const lang = userProfile.language || 'ru';
  const displayName = userProfile.name || '';

  useEffect(() => {
    const load = async () => {
      try {
        const [cardsRes, balanceRes] = await Promise.all([
          getCards(userId),
          getBalance(userId),
        ]);
        if (cardsRes.success && cardsRes.cards) setCards(cardsRes.cards);
        if (balanceRes?.balance !== undefined) setBalance(balanceRes.balance);
      } catch (e) {
        console.error('[MyCards] Load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  const formatDate = (d: string) => {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return lang === 'ru' ? `${day}.${m}.${y}` : `${m}/${day}/${y}`;
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-hide px-4 pb-12">
      <header className="pt-5 pb-4">
        <h1 className="text-xl font-semibold text-astro-text tracking-tight">
          {getText(lang, 'my_cards.title')}
        </h1>
        <p className="text-sm text-astro-text/70 mt-1">
          {getText(lang, 'my_cards.greeting')} {displayName || getText(lang, 'my_cards.guest')}
        </p>
      </header>

      <section className="mb-5 p-4 rounded-xl bg-white/5 dark:bg-white/[0.03] border border-astro-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-astro-text tabular-nums">{balance}</span>
            <span className="text-sm text-astro-text/60">{getText(lang, 'my_cards.lumi')}</span>
          </div>
          <button
            onClick={onOpenShop}
            className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors"
          >
            {getText(lang, 'my_cards.shop')}
          </button>
        </div>
      </section>

      <button
        onClick={onAddCard}
        className="w-full py-3.5 px-4 mb-6 rounded-xl bg-blue-600 text-white font-medium text-sm flex items-center justify-center gap-2 hover:bg-blue-700 active:bg-blue-800 transition-colors"
      >
        <span className="text-lg font-light leading-none">+</span>
        {getText(lang, 'my_cards.add_card')}
      </button>

      <h2 className="text-sm font-medium text-astro-text/60 mb-3">
        {getText(lang, 'my_cards.section_cards')}
      </h2>

      {loading ? (
        <div className="py-8 text-center">
          <span className="text-sm text-astro-text/50">{getText(lang, 'loading')}</span>
        </div>
      ) : cards.length === 0 ? (
        <div className="py-10 px-5 rounded-xl border border-astro-border/40 bg-white/5 dark:bg-white/[0.02] text-center">
          <p className="text-sm text-astro-text/70 mb-4">
            {getText(lang, 'my_cards.empty')}
          </p>
          <button
            onClick={onAddCard}
            className="inline-flex py-2.5 px-5 rounded-xl border border-astro-border/60 text-astro-text/80 text-sm font-medium hover:bg-white/5 transition-colors"
          >
            {getText(lang, 'my_cards.add_card')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => (
            <button
              key={card.id}
              onClick={() => onOpenCard(card.id)}
              className="w-full text-left p-4 rounded-xl bg-white/5 dark:bg-white/[0.03] border border-astro-border/40 hover:border-astro-border/60 active:bg-white/10 transition-colors"
            >
              <div className="font-medium text-astro-text text-[15px]">{card.name || 'Я'}</div>
              <div className="mt-1 text-[13px] text-astro-text/60">
                {formatDate(card.birth_date)} · {card.birth_place}
              </div>
              <div className="mt-3 flex gap-2">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium ${
                    card.is_purchased_full
                      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                      : 'bg-astro-bg/80 text-astro-text/50 border border-astro-border/40'
                  }`}
                >
                  Full {card.is_purchased_full ? '✓' : '—'}
                </span>
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium ${
                    card.is_purchased_pro
                      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                      : 'bg-astro-bg/80 text-astro-text/50 border border-astro-border/40'
                  }`}
                >
                  Pro {card.is_purchased_pro ? '✓' : '—'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
