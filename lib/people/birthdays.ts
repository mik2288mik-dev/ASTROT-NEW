/** Birthdays of close people come as «MM-DD» only: the year is never shared. */

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
