import React, { memo, useRef } from 'react';
import type { AdminScheduledNotificationAsset } from '../../../types';

interface NotificationAssetPickerProps {
  assets: AdminScheduledNotificationAsset[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onUpload: (file: File) => Promise<void>;
  onDeleteAsset?: (id: number) => Promise<void>;
  uploading: boolean;
  lang: 'ru' | 'en';
}

const T = (lang: 'ru' | 'en', ru: string, en: string) => (lang === 'ru' ? ru : en);

export const NotificationAssetPicker = memo<NotificationAssetPickerProps>(
  ({ assets, selectedId, onSelect, onUpload, onDeleteAsset, uploading, lang }) => {
    const inputRef = useRef<HTMLInputElement>(null);

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
            {uploading ? T(lang, 'Загрузка…', 'Uploading…') : T(lang, 'Загрузить', 'Upload')}
          </button>
          {selectedId ? (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="rounded-lg border border-astro-border px-3 py-2 text-xs text-astro-text"
            >
              {T(lang, 'Снять выбор', 'Clear')}
            </button>
          ) : null}
        </div>
        <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {assets.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onSelect(a.id === selectedId ? null : a.id)}
              className={`relative overflow-hidden rounded-lg ring-2 transition-all ${
                selectedId === a.id ? 'ring-astro-highlight' : 'ring-transparent hover:ring-white/20'
              }`}
            >
              <img src={a.publicUrl} alt="" className="aspect-square w-full object-cover" />
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
            </button>
          ))}
        </div>
      </div>
    );
  }
);

NotificationAssetPicker.displayName = 'NotificationAssetPicker';
