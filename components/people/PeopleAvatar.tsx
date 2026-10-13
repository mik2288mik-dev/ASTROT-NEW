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

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function pluralDays(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}

/** «MM-DD» → days until the next birthday, counted in local days. */
export function daysUntilBirthday(monthDay: string | null, now = new Date()): number | null {
  const match = /^(\d{2})-(\d{2})$/.exec(monthDay || '');
  if (!match) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), Number(match[1]) - 1, Number(match[2]));
  if (next < today) next = new Date(now.getFullYear() + 1, Number(match[1]) - 1, Number(match[2]));
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

export function birthdayLabel(monthDay: string | null, now = new Date()): string | null {
  const days = daysUntilBirthday(monthDay, now);
  if (days == null) return null;
  if (days === 0) return 'День рождения сегодня';
  if (days === 1) return 'День рождения завтра';
  if (days <= 30) return `День рождения через ${days} ${pluralDays(days)}`;
  const [, month, day] = /^(\d{2})-(\d{2})$/.exec(monthDay!)!;
  return `День рождения ${Number(day)} ${MONTHS[Number(month) - 1]}`;
}
