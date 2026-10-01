import React, { useRef, useState } from 'react';
import { CosmicSheet } from './lumia-ui/CosmicSheet';
import { startAndroidUpdate } from '../services/androidUpdates';

export function AndroidUpdatePrompt({ open, versionName, onClose }: {
  open: boolean;
  versionName?: string | null;
  onClose(): void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const running = useRef(false);
  const update = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(false);
    try { if (await startAndroidUpdate() === 'cancelled') onClose(); }
    catch { setError(true); }
    finally { running.current = false; setBusy(false); }
  };
  return (
    <CosmicSheet open={open} title="Нужно обновить приложение" closeLabel="Отмена" closeButtonText="Отмена" onClose={onClose}
      footer={<button type="button" className="forecast-bottom-sheet-primary" disabled={busy} onClick={() => void update()}>
        {busy ? 'Открываем обновление…' : 'Обновить'}
      </button>}>
      <p>Доступна новая версия NEBO{versionName ? ` ${versionName}` : ''}. Обнови приложение, чтобы пользоваться всеми разделами. Пока можно остаться на главной.</p>
      {error ? <p role="alert">Не удалось открыть обновление. Попробуй ещё раз или открой NEBO в RuStore.</p> : null}
    </CosmicSheet>
  );
}
