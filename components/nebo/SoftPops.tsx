import React from 'react';
import { X } from 'lucide-react';

/** «Каждое утро в 7:00 присылать, какой у тебя будет день?» (canvas PopNotify). Android asks for permission only after «Да». */
export function NotifyOffer({ onAnswer }: { onAnswer: (accept: boolean) => void }) {
  return (
    <div className="nebo-sheet-scrim" role="presentation" onClick={() => onAnswer(false)}>
      <div className="nebo-soft-pop" role="dialog" aria-modal="true" aria-label="Уведомления" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="nebo-day-pop-close" onClick={() => onAnswer(false)} aria-label="Закрыть"><X size={18} aria-hidden /></button>
        <img src="/assets/nebo-icons/bell.svg" alt="" width={80} height={80} />
        <h2>Каждое утро в 7:00 присылать, какой у тебя будет день?</h2>
        <p>Одно уведомление утром. В особые дни, например в твой день рождения или в полнолуние, может прийти ещё одно.</p>
        <div className="nebo-notif-preview" aria-hidden="true">
          <img src="/assets/brand/nebo-app-icon-192.png" alt="" width={40} height={40} />
          <span><small>NEBO <i>7:00</i></small><strong>Сегодня легко договориться</strong><em>Что это значит для тебя, внутри.</em></span>
        </div>
        <button type="button" className="nebo-period-cta" onClick={() => onAnswer(true)}>Да, присылать</button>
        <button type="button" className="nebo-inbox-close" onClick={() => onAnswer(false)}>Не сейчас</button>
      </div>
    </div>
  );
}

/** «Нет соединения» (canvas PopOffline): the saved day stays, the new one comes by itself. */
export function OfflineNotice({ onClose }: { onClose: () => void }) {
  return (
    <div className="nebo-sheet-scrim" role="presentation" onClick={onClose}>
      <div className="nebo-soft-pop" role="dialog" aria-modal="true" aria-label="Нет соединения" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="nebo-day-pop-close" onClick={onClose} aria-label="Закрыть"><X size={18} aria-hidden /></button>
        <img src="/assets/nebo-icons/globe.svg" alt="" width={80} height={80} />
        <h2>Нет соединения</h2>
        <p>Показываем то, что уже сохранено. Новое подтянется само, когда появится сеть. Если включён VPN, попробуй выключить его: с ним NEBO иногда не загружается.</p>
        <button type="button" className="nebo-period-cta" onClick={onClose}>Понятно</button>
      </div>
    </div>
  );
}
