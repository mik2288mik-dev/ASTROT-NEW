import React, { useRef, useState } from 'react';
import { CosmicSheet } from './lumia-ui/CosmicSheet';
import { startAndroidUpdate } from '../services/androidUpdates';

export function AndroidUpdatePrompt({ open, required, versionName, onClose }: {
  open: boolean;
  required: boolean;
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
    try { if (await startAndroidUpdate() === 'cancelled' || !required) onClose(); }
    catch { setError(true); }
    finally { running.current = false; setBusy(false); }
  };
  return (
    <CosmicSheet open={open} title={required ? 'Нужно обновить приложение' : 'Доступна новая версия NEBO'}
      closeLabel={required ? 'Отмена' : 'Позже'} closeButtonText={required ? 'Отмена' : 'Позже'} onClose={onClose}
      footer={<button type="button" className="forecast-bottom-sheet-primary" disabled={busy} onClick={() => void update()}>
        {busy ? 'Открываем обновление…' : 'Обновить'}
      </button>}>
      {required ? (
        <p>Доступна новая версия NEBO{versionName ? ` ${versionName}` : ''}. Обнови приложение, чтобы пользоваться всеми разделами. Пока можно остаться на главной.</p>
      ) : (
        <p>В RuStore доступно обновление. Скачай новую версию NEBO.</p>
      )}
      {error ? <p role="alert">Не удалось открыть обновление. Попробуй ещё раз или открой NEBO в RuStore.</p> : null}
    </CosmicSheet>
  );
}
