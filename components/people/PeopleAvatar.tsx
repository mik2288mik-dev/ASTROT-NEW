import React from 'react';
import type { ChartAvatarChoice } from '../../lib/chartAvatar';

const TONES = [['#fde6d9', '#c4512e'], ['#e7effb', '#2d6fd6'], ['#e7f6ee', '#2a7a45'], ['#f1edff', '#6b4fc8'], ['#fff1cc', '#a3620b']] as const;

function tone(seed: string): readonly [string, string] {
  let hash = 0;
  for (const char of seed) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  return TONES[Math.abs(hash) % TONES.length];
}

/** The photo the person chose for their own chart, or their initial on a stable colour. */
export function PeopleAvatar({ name, avatar, seed, size = 48, className = '' }: {
  name: string;
  avatar: ChartAvatarChoice | null;
  seed: string;
  size?: number;
  className?: string;
}) {
  if (avatar?.kind === 'photo') {
    return (
      <span className={`people-avatar ${className}`} style={{ width: size, height: size }} aria-hidden="true">
        <img src={avatar.dataUrl} alt="" width={size} height={size} decoding="async" draggable={false} />
      </span>
    );
  }
  const [background, color] = tone(seed || name);
  return (
    <span
      className={`people-avatar is-initial ${className}`}
      style={{ width: size, height: size, background, color, fontSize: Math.round(size * 0.4) }}
      aria-hidden="true"
    >
      {(name.trim().charAt(0) || '?').toUpperCase()}
    </span>
  );
}

export { birthdayLabel, daysUntilBirthday } from '../../lib/people/birthdays';
