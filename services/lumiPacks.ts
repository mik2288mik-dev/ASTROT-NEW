export type LumiPackId = 'starter' | 'plus' | 'max';

export interface LumiPack {
  id: LumiPackId;
  lumiAmount: number;
  starsAmount: number;
  title: {
    ru: string;
    en: string;
  };
  description: {
    ru: string;
    en: string;
  };
}

export const LUMI_PACKS: Record<LumiPackId, LumiPack> = {
  starter: {
    id: 'starter',
    lumiAmount: 50,
    starsAmount: 99,
    title: {
      ru: 'Стартовый Lumi',
      en: 'Starter Lumi',
    },
    description: {
      ru: 'Хватит на один новый слот или одно платное действие.',
      en: 'Enough for one new slot or one paid action.',
    },
  },
  plus: {
    id: 'plus',
    lumiAmount: 120,
    starsAmount: 199,
    title: {
      ru: 'Lumi Plus',
      en: 'Lumi Plus',
    },
    description: {
      ru: 'Удобный запас для слотов и следующих действий в приложении.',
      en: 'A comfortable reserve for slots and next in-app actions.',
    },
  },
  max: {
    id: 'max',
    lumiAmount: 280,
    starsAmount: 399,
    title: {
      ru: 'Lumi Max',
      en: 'Lumi Max',
    },
    description: {
      ru: 'Лучший запас, если вы активно пользуетесь слотами и Lumi-действиями.',
      en: 'Best value if you actively use slots and Lumi actions.',
    },
  },
};

export const getLumiPack = (packId?: string | null): LumiPack | null => {
  if (!packId) return null;
  return LUMI_PACKS[packId as LumiPackId] || null;
};

export const getAllLumiPacks = (): LumiPack[] => Object.values(LUMI_PACKS);
