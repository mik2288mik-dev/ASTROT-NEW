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
    <div className="h-full overflow-y-auto scrollbar-hide px-4 pb-8">
      <div className="py-4">
        <h2 className="text-lg font-medium text-astro-text">
          {getText(lang, 'my_cards.greeting')} {displayName || getText(lang, 'my_cards.guest')}
        </h2>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-sm text-astro-text/80">
            {getText(lang, 'my_cards.balance')}: <strong className="text-astro-highlight">{balance}</strong> {getText(lang, 'my_cards.lumi')}
          </span>
          <button
            onClick={onOpenShop}
            className="text-sm font-medium text-astro-highlight hover:underline"
          >
            {getText(lang, 'my_cards.shop')}
          </button>
        </div>
      </div>

      <button
        onClick={onAddCard}
        className="w-full py-3 px-4 mb-4 rounded-xl border border-astro-highlight/50 text-astro-highlight font-medium text-sm flex items-center justify-center gap-2 hover:bg-astro-highlight/10 transition-colors"
      >
        <span className="text-lg">+</span>
        {getText(lang, 'my_cards.add_card')}
      </button>

      {loading ? (
        <div className="py-8 text-center text-astro-text/60 text-sm">
          {getText(lang, 'loading')}
        </div>
      ) : cards.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-astro-text/70 text-sm mb-4">
            {getText(lang, 'my_cards.empty')}
          </p>
          <button
            onClick={onAddCard}
            className="py-2 px-4 rounded-lg border border-astro-highlight/50 text-astro-highlight text-sm font-medium"
          >
            {getText(lang, 'my_cards.add_card')}
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {cards.map((card) => (
            <button
              key={card.id}
              onClick={() => onOpenCard(card.id)}
              className="w-full text-left p-4 rounded-xl bg-astro-bg/80 border border-astro-border/50 hover:border-astro-highlight/30 transition-colors"
            >
              <div className="font-medium text-astro-text">{card.name || 'Я'}</div>
              <div className="mt-1 text-xs text-astro-text/70">
                {formatDate(card.birth_date)} · {card.birth_place}
              </div>
              <div className="mt-2 flex gap-2">
                <span className={`text-xs px-2 py-0.5 rounded ${card.is_purchased_full ? 'bg-astro-highlight/20 text-astro-highlight' : 'bg-astro-border/30 text-astro-text/60'}`}>
                  Full {card.is_purchased_full ? '✓' : '—'}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded ${card.is_purchased_pro ? 'bg-astro-highlight/20 text-astro-highlight' : 'bg-astro-border/30 text-astro-text/60'}`}>
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
