import React from 'react';
import { cn } from '../../../lib/cn';

type LzArtPlateProps = {
  imageSrc?: string | null;
  fallback?: React.ReactNode;
  aspect?: 'hero' | 'wide' | 'square' | 'tall';
  className?: string;
  innerClassName?: string;
};

const aspectClass = {
  hero: 'aspect-[5/3]',
  wide: 'aspect-[2/1]',
  square: 'aspect-square',
  tall: 'aspect-[4/5]',
};

export function LzArtPlate({
  imageSrc,
  fallback,
  aspect = 'hero',
  className,
  innerClassName,
}: LzArtPlateProps) {
  return (
    <div
      className={cn(
        'lz-art-plate relative overflow-hidden rounded-[18px] bg-mono-plate',
        aspectClass[aspect],
        className,
      )}
    >
      {imageSrc ? (
        <img src={imageSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className={cn('absolute inset-0 flex items-center justify-center p-4', innerClassName)}>
          {fallback}
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/[0.04]" />
    </div>
  );
}
