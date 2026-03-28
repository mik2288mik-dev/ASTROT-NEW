import React, { memo } from 'react';

export type PreviewModel = {
  visualMode: 'none' | 'uploaded' | 'generated';
  messageType: 'text' | 'photo';
  text: string;
  imageUrl: string | null;
  generatedCardUrl: string | null;
  buttonText: string | null;
  buttonUrl: string | null;
  hasInlineButton: boolean;
};

interface NotificationPreviewProps {
  preview: PreviewModel;
}

export const NotificationPreview = memo<NotificationPreviewProps>(({ preview }) => {
  const showImage =
    (preview.visualMode === 'uploaded' && preview.imageUrl) ||
    (preview.visualMode === 'generated' && preview.generatedCardUrl);

  return (
    <div className="rounded-2xl border border-astro-border/60 bg-astro-bg/40 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-astro-subtext">
        Предпросмотр в Telegram
      </p>
      <div className="mt-3 flex justify-center">
        <div className="w-full max-w-[280px] rounded-2xl bg-[#0e1621] p-3 shadow-lg ring-1 ring-white/10">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <div className="h-8 w-8 rounded-full bg-astro-highlight/30" />
            <div>
              <p className="text-xs font-medium text-white/90">Lumia</p>
              <p className="text-[10px] text-white/45">бот</p>
            </div>
          </div>
          <div className="pt-2">
            {showImage ? (
              <div className="overflow-hidden rounded-xl">
                <img
                  src={preview.visualMode === 'generated' ? preview.generatedCardUrl! : preview.imageUrl!}
                  alt=""
                  className="max-h-52 w-full object-cover object-top"
                />
              </div>
            ) : null}
            {preview.visualMode !== 'none' && preview.text ? (
              <p className="mt-2 whitespace-pre-wrap text-[12px] leading-snug text-white/75">{preview.text}</p>
            ) : null}
            {preview.visualMode === 'none' ? (
              preview.text ? (
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-snug text-white/92">{preview.text}</p>
              ) : (
                <p className="mt-2 text-[13px] text-white/45">Нет текста</p>
              )
            ) : null}
            {preview.hasInlineButton && preview.buttonText ? (
              <div className="mt-3">
                <span className="inline-block rounded-lg bg-white/12 px-3 py-2 text-xs font-medium text-sky-300">
                  {preview.buttonText}
                </span>
                {preview.buttonUrl ? (
                  <p className="mt-1 truncate text-[10px] text-white/35" title={preview.buttonUrl}>
                    {preview.buttonUrl}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
});

NotificationPreview.displayName = 'NotificationPreview';
