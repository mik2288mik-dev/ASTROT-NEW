import React, { useState } from 'react';

type AssetSlotProps = {
  /** Path inside `public/`, e.g. `/assets/future/week.webp`. */
  src?: string | null;
  className?: string;
  /** Rounded tile (default) or circle. */
  shape?: 'tile' | 'circle';
};

/**
 * A place for a designer image. Until the file exists (or when it fails to
 * load) it shows a calm neutral shape of the same size, so layouts never jump
 * and nothing looks broken. Decorative: meaning always lives in the text next to it.
 */
export function AssetSlot({ src, className, shape = 'tile' }: AssetSlotProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;
  return (
    <span
      className={['asset-slot', `is-${shape}`, showImage ? 'has-image' : 'is-empty', className].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      {showImage ? (
        <img src={src!} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setFailedSrc(src!)} />
      ) : (
        <span className="asset-slot-placeholder" />
      )}
    </span>
  );
}
