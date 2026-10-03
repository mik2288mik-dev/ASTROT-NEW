export type Localized = { ru: string; en: string };
export type ChartElement = 'fire' | 'earth' | 'air' | 'water';
/** Which part of the natal chart the test is compared with. */
export type ChartFactor = 'elements' | 'mars' | 'venus' | 'moon';

export type SelfTestOption = {
  text: Localized;
  /** Result keys this answer adds a point to. */
  to: readonly string[];
};

export type SelfTestQuestion = {
  id: string;
  text: Localized;
  options: readonly SelfTestOption[];
};

export type SelfTestResult = {
  key: string;
  title: Localized;
  lead: Localized;
  strengths: readonly Localized[];
  watch: readonly Localized[];
  tip: Localized;
};

export type SelfTestDefinition = {
  id: string;
  title: Localized;
  subtitle: Localized;
  minutes: number;
  questions: readonly SelfTestQuestion[];
  results: readonly SelfTestResult[];
  chart: {
    factor: ChartFactor;
    /** What this part of the chart says per element and which result it points to. */
    byElement: Record<ChartElement, { key: string | null; text: Localized }>;
  };
};
