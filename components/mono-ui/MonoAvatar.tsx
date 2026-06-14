import React from 'react';
import { cn } from '../../lib/cn';

type MonoAvatarProps = {
  src?: string | null;
  initial?: string;
  size?: number;
  className?: string;
};

export function MonoAvatar({ src, initial = '?', size = 48, className }: MonoAvatarProps) {
  const style = { width: size, height: size };
  if (src) {
    return (
      <img
        src={src}
        alt=""
        draggable={false}
        style={style}
        className={cn('flex-shrink-0 rounded-full object-cover bg-mono-plate', className)}
      />
    );
  }
  return (
    <div
      style={style}
      className={cn(
        'flex flex-shrink-0 items-center justify-center rounded-full bg-mono-plate text-[18px] font-bold text-mono-ink',
        className,
      )}
    >
      {initial}
    </div>
  );
}
