import React from 'react';
import { MonoAvatar } from '../../mono-ui/MonoAvatar';
import { cn } from '../../../lib/cn';

type LzFeedHeaderProps = {
  greeting: string;
  name: string;
  motivation: string;
  avatarSrc?: string | null;
  avatarInitial?: string;
  onAvatarClick?: () => void;
  className?: string;
};

export function LzFeedHeader({
  greeting,
  name,
  motivation,
  avatarSrc,
  avatarInitial,
  onAvatarClick,
  className,
}: LzFeedHeaderProps) {
  const avatar = <MonoAvatar src={avatarSrc} initial={avatarInitial} size={52} />;

  return (
    <header className={cn('flex items-start gap-3', className)}>
      {onAvatarClick ? (
        <button type="button" onClick={onAvatarClick} className="flex-shrink-0" aria-label="Profile">
          {avatar}
        </button>
      ) : (
        avatar
      )}
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-[14px] font-medium text-mono-muted">{greeting}</p>
        <h1 className="truncate text-[26px] font-bold leading-tight tracking-[-0.02em] text-mono-ink">{name}</h1>
        <p className="mt-1 line-clamp-2 text-[14px] font-medium italic leading-snug text-mono-muted">{motivation}</p>
      </div>
    </header>
  );
}
