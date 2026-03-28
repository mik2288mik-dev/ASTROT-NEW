import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { AdminScheduledNotificationAsset } from '../../../types';

interface NotificationAssetPickerProps {
  assets: AdminScheduledNotificationAsset[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onUpload: (file: File) => Promise<void>;
  onDeleteAsset?: (id: number) => Promise<void>;
  uploading: boolean;
}

export const NotificationAssetPicker = memo<NotificationAssetPickerProps>(
  ({ assets, selectedId, onSelect, onUpload, onDeleteAsset, uploading }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [lightbox, setLightbox] = useState<AdminScheduledNotificationAsset | null>(null);

    const onKeyDown = useCallback((e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
    }, []);

    useEffect(() => {
      if (!lightbox) return;
      document.addEventListener('keydown', onKeyDown);
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', onKeyDown);
        document.body.style.overflow = prev;
      };
    }, [lightbox, onKeyDown]);

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) await onUpload(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="rounded-lg bg-astro-highlight px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {uploading ? 'Загрузка…' : 'Загрузить'}
          </button>
          {selectedId ? (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="rounded-lg border border-astro-border px-3 py-2 text-xs text-astro-text"
            >
              Снять выбор
            </button>
          ) : null}
        </div>
        <p className="text-[11px] text-astro-subtext">
          Нажмите на миниатюру — выбрать для шаблона. «Лупа» — открыть крупно.
        </p>
        <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {assets.map((a) => (
            <div
              key={a.id}
              className={`relative overflow-hidden rounded-lg ring-2 transition-all ${
                selectedId === a.id ? 'ring-astro-highlight' : 'ring-transparent hover:ring-white/20'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(a.id === selectedId ? null : a.id)}
                className="block w-full"
              >
                <img src={a.publicUrl} alt="" className="aspect-square w-full object-cover" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox(a);
                }}
                className="absolute bottom-1 left-1 rounded-md bg-black/55 px-1.5 py-0.5 text-white backdrop-blur-sm hover:bg-black/70"
                title="Увеличить"
                aria-label="Увеличить"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                </svg>
              </button>
              {a.refCount === 0 && onDeleteAsset ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    void onDeleteAsset(a.id);
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.stopPropagation();
                      void onDeleteAsset(a.id);
                    }
                  }}
                  className="absolute right-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white"
                >
                  ×
                </span>
              ) : null}
            </div>
          ))}
        </div>

        {lightbox ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Просмотр"
            className="fixed inset-0 z-[85] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            onClick={() => setLightbox(null)}
          >
            <div
              className="relative max-h-[90vh] max-w-[min(92vw,520px)] overflow-hidden rounded-2xl border border-white/10 bg-astro-card shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="absolute right-2 top-2 z-10 rounded-full bg-black/50 px-3 py-1 text-xs text-white"
              >
                Закрыть
              </button>
              <img src={lightbox.publicUrl} alt="" className="max-h-[min(72vh,480px)] w-full object-contain" />
              <div className="border-t border-astro-border/50 p-2 text-[11px] text-astro-subtext">
                <p className="truncate text-astro-text">{lightbox.fileName}</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
);

NotificationAssetPicker.displayName = 'NotificationAssetPicker';
