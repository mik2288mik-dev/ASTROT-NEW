function readForecastFullDayStarsCost() {
  const raw =
    process.env.FORECAST_FULL_DAY_STARS_COST ||
    process.env.NEXT_PUBLIC_FORECAST_FULL_DAY_STARS_COST ||
    process.env.FORECAST_FULL_DAY_LUMI_COST ||
    process.env.NEXT_PUBLIC_FORECAST_FULL_DAY_LUMI_COST;
  const parsed = Number.parseInt(String(raw || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 80;
}

function readAskLumiaStarsCost() {
  const raw =
    process.env.ASK_LUMIA_STARS_COST ||
    process.env.NEXT_PUBLIC_ASK_LUMIA_STARS_COST ||
    process.env.ASK_LUMIA_LUMI_COST ||
    process.env.NEXT_PUBLIC_ASK_LUMIA_LUMI_COST;
  const parsed = Number.parseInt(String(raw || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 120;
}

function readSynastryExtendedStarsCost() {
  const raw =
    process.env.SYNASTRY_EXTENDED_STARS_COST ||
    process.env.NEXT_PUBLIC_SYNASTRY_EXTENDED_STARS_COST ||
    process.env.SYNASTRY_EXTENDED_LUMI_COST ||
    process.env.NEXT_PUBLIC_SYNASTRY_EXTENDED_LUMI_COST;
  const parsed = Number.parseInt(String(raw || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 180;
}

/** One-off Telegram Stars unlock for the full forecast day layer. */
export const FORECAST_FULL_DAY_STARS_COST = readForecastFullDayStarsCost();

/** One-off Telegram Stars unlock for Ask Lumia after the free starter question. */
export const ASK_LUMIA_STARS_COST = readAskLumiaStarsCost();

/** One-off Telegram Stars unlock for extended/full synastry. */
export const SYNASTRY_EXTENDED_STARS_COST = readSynastryExtendedStarsCost();

/** @deprecated Legacy alias — same numeric value as Stars cost. */
export const FORECAST_FULL_DAY_LUMI_COST = FORECAST_FULL_DAY_STARS_COST;

/** @deprecated Legacy alias — same numeric value as Stars cost. */
export const ASK_LUMIA_LUMI_COST = ASK_LUMIA_STARS_COST;

/** @deprecated Legacy alias — same numeric value as Stars cost. */
export const SYNASTRY_EXTENDED_LUMI_COST = SYNASTRY_EXTENDED_STARS_COST;
