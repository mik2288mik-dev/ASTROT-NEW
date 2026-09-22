import React, { useEffect, useRef, useState } from 'react';
import styles from './ActionFeedback.module.css';

export const ACTION_FEEDBACK = {
  done: 'Супер. Готово.',
  dataExact: 'Отлично. Теперь точнее.',
  dataUpdated: 'Готово. Данные обновлены.',
  readyToCompare: 'Есть. Теперь можно сравнивать.',
  readyForReading: 'Отлично. Всё готово для разбора.',
  chartSaved: 'Готово. Карта на месте.',
  saved: 'Готово. Не потеряется.',
  settingsSaved: 'Готово. Сохранили.',
  settingsUpdated: 'Есть. Настройки обновлены.',
  premiumActive: 'Готово. Premium активен.',
  premiumRestored: 'Отлично. Доступ восстановлен.',
  accountSaved: 'Готово. Аккаунт на месте.',
  onboardingReady: 'Всё. Можно смотреть, что получилось.',
  removedFromSaved: 'Убрали из сохранённых.',
} as const;

export type ActionFeedbackMessage = typeof ACTION_FEEDBACK[keyof typeof ACTION_FEEDBACK];
type ActionFeedbackTone = 'success' | 'neutral';
type ActionFeedbackDetail = { message: ActionFeedbackMessage; tone: ActionFeedbackTone };

const ACTION_FEEDBACK_EVENT = 'nebo:action-feedback';
let pendingFeedback: ActionFeedbackDetail | null = null;

export function showActionFeedback(message: ActionFeedbackMessage, tone: ActionFeedbackTone = 'success'): void {
  const detail = { message, tone };
  pendingFeedback = detail;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<ActionFeedbackDetail>(ACTION_FEEDBACK_EVENT, { detail }));
}

export function ActionFeedbackHost() {
  const [feedback, setFeedback] = useState<ActionFeedbackDetail | null>(null);
  const lastFeedbackRef = useRef<ActionFeedbackDetail | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const dismissLater = () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        lastFeedbackRef.current = null;
        setFeedback(null);
      }, 2600);
    };
    const show = (next: ActionFeedbackDetail) => {
      pendingFeedback = null;
      if (lastFeedbackRef.current?.message === next.message && lastFeedbackRef.current?.tone === next.tone) {
        dismissLater();
        return;
      }
      lastFeedbackRef.current = next;
      setFeedback(next);
      dismissLater();
    };
    const onFeedback = (event: Event) => show((event as CustomEvent<ActionFeedbackDetail>).detail);
    window.addEventListener(ACTION_FEEDBACK_EVENT, onFeedback);
    if (pendingFeedback) show(pendingFeedback);
    return () => {
      window.removeEventListener(ACTION_FEEDBACK_EVENT, onFeedback);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  return <div className={styles.region} aria-live="polite" aria-atomic="true">
    {feedback ? <div key={feedback.message} className={`${styles.tag} ${feedback.tone === 'neutral' ? styles.neutral : ''}`} role="status">
      {feedback.tone === 'success' ? <span className={styles.check} aria-hidden="true">✓</span> : null}
      <span>{feedback.message}</span>
    </div> : null}
  </div>;
}
