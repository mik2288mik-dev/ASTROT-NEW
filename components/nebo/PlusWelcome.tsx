import React from 'react';
import { X } from 'lucide-react';
import { NeboPlusCard } from './NeboPlusCard';

/** «Добро пожаловать в Plus» right after the payment went through (canvas PaidPlus). */
export function PlusWelcome({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <div className="nebo-sheet-scrim" role="presentation" onClick={onClose}>
      <div className="nebo-plus-welcome" role="dialog" aria-modal="true" aria-label="Добро пожаловать в Plus" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="nebo-day-pop-close" onClick={onClose} aria-label="Закрыть"><X size={18} aria-hidden /></button>
        <div className="nebo-plus-welcome-card"><NeboPlusCard name={name} label="Участник" /></div>
        <h2>Добро пожаловать в Plus</h2>
        <p>Всё в NEBO открыто. Подписка в профиле, отменить можно в любой момент.</p>
        <ul>
          <li>Карта, матрица и числа целиком</li>
          <li>Все расклады и лунные календари</li>
          <li>Неделя, месяц и хорошие даты вперёд</li>
        </ul>
        <button type="button" className="nebo-period-cta" onClick={onClose}>Начать</button>
      </div>
    </div>
  );
}
