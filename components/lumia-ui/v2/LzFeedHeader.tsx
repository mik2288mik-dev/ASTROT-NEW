import React from 'react';
import { MonoAvatar } from '../../mono-ui/MonoAvatar';
import { cn } from '../../../lib/cn';

type LzFeedHeaderProps = {
  greeting: string;
  name: string;
  motivation: string;
  dateLabel?: string;
  avatarSrc?: string | null;
  avatarInitial?: string;
  onAvatarClick?: () => void;
  className?: string;
};

export function LzFeedHeader({
  greeting,
  name,
  motivation,
  dateLabel,
  avatarSrc,
  avatarInitial,
  onAvatarClick,
  className,
}: LzFeedHeaderProps) {
  const avatar = <MonoAvatar src={avatarSrc} initial={avatarInitial} size={56} />;

  return (
    <header className={cn('lz-feed-header', className)}>
      <div className="flex items-start gap-3.5">
        {onAvatarClick ? (
          <button type="button" onClick={onAvatarClick} className="flex-shrink-0 rounded-full ring-2 ring-mono-line/80" aria-label="Profile">
            {avatar}
          </button>
        ) : (
          avatar
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-mono-muted">{greeting}</p>
            {dateLabel ? (
              <p className="shrink-0 text-[12px] font-medium text-mono-muted">{dateLabel}</p>
            ) : null}
          </div>
          <h1 className="mt-1 truncate text-[clamp(1.65rem,6vw,2rem)] font-bold leading-[1.05] tracking-[-0.03em] text-mono-ink">
            {name}
          </h1>
        </div>
      </div>
      <blockquote className="lz-motivation-quote mt-4">{motivation}</blockquote>
    </header>
  );
}
