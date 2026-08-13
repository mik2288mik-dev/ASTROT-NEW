import React, { type CSSProperties } from 'react';

type EditorialStickerAsset = {
  id: string;
  path: string;
  width: number;
  height: number;
  orientation: 'landscape' | 'portrait' | 'square';
  collection: string;
};

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
  const stickerStyle = {
    '--editorial-sticker-ratio': `${asset.width} / ${asset.height}`,
  } as CSSProperties;

  return (
    <figure
      className={['editorial-sticker', `editorial-sticker--${asset.orientation}`, className]
        .filter(Boolean)
        .join(' ')}
      data-editorial-sticker={asset.id}
      data-editorial-collection={asset.collection}
      data-editorial-orientation={asset.orientation}
      style={stickerStyle}
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
