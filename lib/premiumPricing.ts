function readPremiumWeekStars() {
  const raw =
    process.env.PREMIUM_WEEK_STARS ||
    process.env.NEXT_PUBLIC_PREMIUM_WEEK_STARS;
  const parsed = Number.parseInt(String(raw || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 250;
}

/** Telegram Stars price for one week of Lumia Premium. */
export const PREMIUM_WEEK_STARS = readPremiumWeekStars();

export const PREMIUM_WEEK_DAYS = 7;
