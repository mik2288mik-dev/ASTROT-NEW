import React, { useState } from 'react';

type AssetSlotProps = {
  /** Path inside `public/`, e.g. `/assets/future/week.webp`. */
  src?: string | null;
  className?: string;
  /** Rounded tile (default) or circle. */
  shape?: 'tile' | 'circle';
  /** `contain` for a cut-out object on a coloured pad, `cover` for a photo. */
  fit?: 'cover' | 'contain';
};

/**
 * A place for a designer image. Until the file exists (or when it fails to
 * load) nothing is drawn at all — no grey stand-in — and the text next to it
 * carries the meaning on its own.
 */
export function AssetSlot({ src, className, shape = 'tile', fit = 'cover' }: AssetSlotProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return null;
  return (
    <span
      className={['asset-slot', `is-${shape}`, `is-${fit}`, 'has-image', className].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <img src={src} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setFailedSrc(src)} />
    </span>
  );
}
