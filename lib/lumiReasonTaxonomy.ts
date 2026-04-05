/**
 * Lumi reason taxonomy (Phase 7): earn vs spend vs purchase vs system.
 * Single source for human-readable labels in Wallet, Admin, and future surfaces.
 * Reason strings in DB/API should stay stable snake_case; labels live here.
 */

export type LumiReasonFlow = 'earn' | 'spend' | 'purchase' | 'system';

export type LumiReasonLabels = {
  flow: LumiReasonFlow;
  ru: string;
  en: string;
};

/** Canonical map: key = transaction `reason` string */
export const LUMI_REASON_TAXONOMY: Record<string, LumiReasonLabels> = {
  daily_login: {
    flow: 'earn',
    ru: 'Ежедневный вход',
    en: 'Daily login',
  },
  streak_bonus: {
    flow: 'earn',
    ru: 'Бонус за серию входов',
    en: 'Streak bonus',
  },
  referral_bonus: {
    flow: 'earn',
    ru: 'Бонус за приглашение или вход по ссылке друга',
    en: 'Invite bonus or friend-referral reward',
  },
  roulette_win: {
    flow: 'earn',
    ru: 'Выигрыш в рулетке',
    en: 'Roulette win',
  },
  daily_task_horoscope: {
    flow: 'earn',
    ru: 'Ежедневное задание: гороскоп',
    en: 'Daily task: horoscope',
  },
  daily_task_chart: {
    flow: 'earn',
    ru: 'Ежедневное задание: карта',
    en: 'Daily task: chart',
  },
  premium_bonus: {
    flow: 'earn',
    ru: 'Бонус Premium',
    en: 'Premium bonus',
  },

  deep_dive: {
    flow: 'spend',
    ru: 'Глубокий разбор',
    en: 'Deep dive',
  },
  synastry: {
    flow: 'spend',
    ru: 'Синастрия',
    en: 'Synastry',
  },
  synastry_one_off: {
    flow: 'spend',
    ru: 'Полный разбор совместимости',
    en: 'Full compatibility reading',
  },
  question: {
    flow: 'spend',
    ru: 'Вопрос к Lumia',
    en: 'Question to Lumia',
  },
  question_one_off: {
    flow: 'spend',
    ru: 'Полный ответ на вопрос',
    en: 'Full question answer',
  },
  daily_card: {
    flow: 'spend',
    ru: 'Ежедневная карта',
    en: 'Daily card',
  },
  chart_slot: {
    flow: 'spend',
    ru: 'Слот для сохранённой карты',
    en: 'Saved chart slot',
  },
  natal_recalculation: {
    flow: 'spend',
    ru: 'Пересчёт / натальный слой (Lumi)',
    en: 'Natal layer unlock (Lumi)',
  },
  forecast_extra: {
    flow: 'spend',
    ru: 'Полный слой дня',
    en: 'Full day layer',
  },
  regenerate_natal: {
    flow: 'spend',
    ru: 'Повторная генерация натальной карты',
    en: 'Natal regeneration',
  },
  regenerate_deep_dive: {
    flow: 'spend',
    ru: 'Повторная генерация Deep Dive',
    en: 'Deep dive regeneration',
  },
  regenerate_synastry: {
    flow: 'spend',
    ru: 'Повторная генерация синастрии',
    en: 'Synastry regeneration',
  },
  refresh_natal_intro: {
    flow: 'spend',
    ru: 'Обновление вступления к карте',
    en: 'Chart intro refresh',
  },

  lumi_pack_starter: {
    flow: 'purchase',
    ru: 'Пакет Lumi: Стартовый',
    en: 'Lumi pack: Starter',
  },
  lumi_pack_plus: {
    flow: 'purchase',
    ru: 'Пакет Lumi: Plus',
    en: 'Lumi pack: Plus',
  },
  lumi_pack_max: {
    flow: 'purchase',
    ru: 'Пакет Lumi: Max',
    en: 'Lumi pack: Max',
  },

  admin_lumi_add: {
    flow: 'system',
    ru: 'Начисление от администратора',
    en: 'Admin credit',
  },
  admin_lumi_subtract: {
    flow: 'system',
    ru: 'Списание администратором',
    en: 'Admin deduction',
  },
  refund: {
    flow: 'system',
    ru: 'Возврат',
    en: 'Refund',
  },
};

export function getLumiReasonFlow(reason: string): LumiReasonFlow | 'unknown' {
  return LUMI_REASON_TAXONOMY[reason]?.flow ?? 'unknown';
}

export function formatLumiReasonLabel(lang: 'ru' | 'en', reason: string): string {
  const entry = LUMI_REASON_TAXONOMY[reason];
  if (entry) return lang === 'ru' ? entry.ru : entry.en;
  return reason.replace(/_/g, ' ');
}

/** Stable keys for a flow (for Wallet glossary and admin tooling). */
export function listLumiReasonKeysByFlow(flow: LumiReasonFlow): string[] {
  return (Object.keys(LUMI_REASON_TAXONOMY) as string[])
    .filter((k) => LUMI_REASON_TAXONOMY[k]?.flow === flow)
    .sort((a, b) => a.localeCompare(b));
}
