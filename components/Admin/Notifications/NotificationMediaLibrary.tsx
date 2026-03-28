import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { AdminScheduledNotificationAsset } from '../../../types';

interface NotificationMediaLibraryProps {
  assets: AdminScheduledNotificationAsset[];
  uploading: boolean;
  onUpload: (file: File) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onRefresh: () => void;
}

export const NotificationMediaLibrary = memo<NotificationMediaLibraryProps>(
  ({ assets, uploading, onUpload, onDelete, onRefresh }) => {
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
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-serif text-lg text-astro-text">Медиатека</h3>
            <p className="mt-1 text-xs text-astro-subtext">
              Файлы в папке проекта <code className="rounded bg-astro-bg/80 px-1 text-[10px]">public/uploads/notifications/</code>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
              className="rounded-lg bg-astro-highlight px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {uploading ? 'Загрузка…' : 'Загрузить изображение'}
            </button>
            <button
              type="button"
              onClick={() => onRefresh()}
              className="rounded-lg border border-astro-border px-3 py-2 text-xs text-astro-text"
            >
              Обновить список
            </button>
          </div>
        </div>

        {assets.length === 0 ? (
          <p className="text-sm text-astro-subtext">Пока нет загруженных файлов. Добавьте картинку для уведомлений с фото.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {assets.map((a) => (
              <div
                key={a.id}
                className="group relative overflow-hidden rounded-xl border border-astro-border/60 bg-astro-bg/30 shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setLightbox(a)}
                  className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-astro-highlight"
                >
                  <img src={a.publicUrl} alt="" className="aspect-square w-full object-cover transition group-hover:opacity-95" />
                </button>
                <div className="border-t border-astro-border/40 p-1.5">
                  <p className="truncate text-[10px] text-astro-subtext" title={a.fileName}>
                    {a.fileName}
                  </p>
                  <p className="text-[9px] text-astro-subtext/70">
                    {a.refCount > 0 ? `В шаблонах: ${a.refCount}` : 'Не используется'}
                  </p>
                  {a.refCount === 0 ? (
                    <button
                      type="button"
                      onClick={() => void onDelete(a.id)}
                      className="mt-1 text-[10px] font-medium text-red-300/90 hover:text-red-200"
                    >
                      Удалить
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {lightbox ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Просмотр изображения"
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            onClick={() => setLightbox(null)}
          >
            <div
              className="relative max-h-[90vh] max-w-[min(92vw,640px)] overflow-hidden rounded-2xl border border-white/10 bg-astro-card shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="absolute right-2 top-2 z-10 rounded-full bg-black/50 px-3 py-1 text-xs text-white hover:bg-black/70"
              >
                Закрыть
              </button>
              <img src={lightbox.publicUrl} alt="" className="max-h-[min(78vh,560px)] w-full object-contain" />
              <div className="border-t border-astro-border/50 p-3 text-xs text-astro-subtext">
                <p className="font-medium text-astro-text">{lightbox.fileName}</p>
                <p className="mt-1">
                  {lightbox.mimeType} · {(lightbox.fileSize / 1024).toFixed(1)} КБ · ID {lightbox.id}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
);

NotificationMediaLibrary.displayName = 'NotificationMediaLibrary';
