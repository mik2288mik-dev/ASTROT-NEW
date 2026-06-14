import React from 'react';
import { cn } from '../../lib/cn';
import { MonoAvatar } from './MonoAvatar';

type MonoHeaderProps = {
  greeting: string;
  subtitle?: string;
  avatarSrc?: string | null;
  avatarInitial?: string;
  onAvatarClick?: () => void;
  className?: string;
};

export function MonoHeader({
  greeting,
  subtitle,
  avatarSrc,
  avatarInitial,
  onAvatarClick,
  className,
}: MonoHeaderProps) {
  const avatar = (
    <MonoAvatar src={avatarSrc} initial={avatarInitial} size={52} />
  );

  return (
    <header className={cn('flex items-center gap-3', className)}>
      {onAvatarClick ? (
        <button type="button" onClick={onAvatarClick} className="flex-shrink-0" aria-label="Profile">
          {avatar}
        </button>
      ) : (
        avatar
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[26px] font-bold leading-tight tracking-[-0.02em] text-mono-ink">
          {greeting}
        </h1>
        {subtitle ? (
          <p className="mt-0.5 truncate text-[14px] font-medium text-mono-muted">{subtitle}</p>
        ) : null}
      </div>
    </header>
  );
}
