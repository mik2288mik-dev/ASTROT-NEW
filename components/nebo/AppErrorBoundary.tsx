import React from 'react';
import { reportClientError } from '../../services/clientErrorReport';
import { DEVICE_PREFERENCE_KEYS } from '../../lib/theme';

type State = { error: Error | null };

/** Saved screen state (hints, avatar, daily cache) that is safe to drop; sign-in keys stay. */
function clearScreenCache() {
  try {
    Object.keys(window.localStorage)
      .filter((key) => (key.startsWith('nebo.') && !(DEVICE_PREFERENCE_KEYS as readonly string[]).includes(key)) || key.startsWith('lumia.today'))
      .forEach((key) => window.localStorage.removeItem(key));
    window.sessionStorage.clear();
  } catch { /* storage may be unavailable */ }
}

/**
 * Any error while drawing a screen used to leave a blank white page.
 * Now the person sees what happened and can reload, and the error goes to the server log.
 */
export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const where = (info.componentStack || '').split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 3).join(' < ');
    reportClientError('app-crash', error, `${error?.message || ''} @ ${where}`);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="nebo-crash" role="alert">
        <img src="/assets/nebo-icons/globe.svg" alt="" width={80} height={80} />
        <h1>Что-то пошло не так</h1>
        <p>Экран не открылся из-за ошибки. Мы уже получили отчёт. Попробуй перезагрузить приложение.</p>
        <button type="button" className="nebo-crash-cta" onClick={() => window.location.reload()}>Перезагрузить</button>
        <button type="button" className="nebo-crash-link" onClick={() => { clearScreenCache(); window.location.reload(); }}>Сбросить сохранённое и перезагрузить</button>
        <small>{String(error.message || error.name || 'Ошибка').slice(0, 160)}</small>
      </div>
    );
  }
}
