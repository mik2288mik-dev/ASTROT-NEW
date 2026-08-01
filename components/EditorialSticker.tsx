import React from 'react';
import type { EditorialStickerAsset } from '../lib/personalForecastVisuals/editorialTypes';

type Props = {
  asset: EditorialStickerAsset;
  className?: string;
  alt?: string;
  priority?: boolean;
  caption?: string;
};

export function EditorialSticker({
  asset,
  className = '',
  alt = '',
  priority = false,
  caption,
}: Props) {
  return (
    <figure
      className={['editorial-sticker', `editorial-sticker--${asset.orientation}`, className]
        .filter(Boolean)
        .join(' ')}
      data-editorial-sticker={asset.id}
    >
      <img
        src={asset.path}
        width={asset.width}
        height={asset.height}
        alt={alt}
        aria-hidden={alt ? undefined : true}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        draggable={false}
      />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
