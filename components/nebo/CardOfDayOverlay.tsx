import React, { useState } from 'react';
import { X } from 'lucide-react';
import { TAROT_BACK, cardImage, type TarotCard } from '../../lib/tarot';

/**
 * «Карта дня» as on the canvas: three cards face down, the person picks one and it turns over.
 * The card itself is fixed for the person and the day, the pick is the ritual.
 */
export function CardOfDayOverlay({ card, onClose, onOpenTarot }: { card: TarotCard; onClose: (opened: boolean) => void; onOpenTarot?: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [turned, setTurned] = useState(false);
  const pick = (index: number) => {
    if (picked !== null) return;
    setPicked(index);
    window.setTimeout(() => setTurned(true), 420);
  };
  const share = async () => {
    const text = `Моя карта дня в NEBO: ${card.roman} · ${card.name}. ${card.day}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
    } catch { /* the person closed the share sheet */ }
  };

  return (
    <div className="nebo-cod" role="dialog" aria-modal="true" aria-label="Карта дня">
      <button type="button" className="nebo-cod-close" onClick={() => onClose(turned)} aria-label="Закрыть"><X size={20} aria-hidden /></button>
      <p className="nebo-cod-kicker">Карта дня</p>
      <h2>{turned ? `${card.roman} · ${card.name}` : 'Выбери свою карту'}</h2>
      {!turned ? (
        <div className="nebo-cod-fan">
          {[0, 1, 2].map((index) => (
            <button
              key={index}
              type="button"
              className={`nebo-cod-card is-${index}${picked === index ? ' is-picked' : picked !== null ? ' is-away' : ''}`}
              onClick={() => pick(index)}
              aria-label={`Карта ${index + 1}`}
            >
              <img src={TAROT_BACK} alt="" draggable={false} />
            </button>
          ))}
        </div>
      ) : (
        <div className="nebo-cod-open">
          <img className="nebo-cod-face" src={cardImage(card) || TAROT_BACK} alt={card.name} />
          <p className="nebo-cod-text">{card.day}</p>
          <p className="nebo-cod-advice"><b>Совет на день.</b> {card.advice}</p>
          <div className="nebo-cod-actions">
            <button type="button" onClick={() => onClose(true)}>Сохранить</button>
            <button type="button" className="is-light" onClick={() => { void share(); }}>Поделиться</button>
          </div>
          {onOpenTarot ? <button type="button" className="nebo-cod-more" onClick={onOpenTarot}>Сделать расклад на вопрос</button> : null}
        </div>
      )}
    </div>
  );
}
