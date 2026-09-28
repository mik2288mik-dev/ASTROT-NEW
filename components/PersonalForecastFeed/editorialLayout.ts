import type {
  ForecastSection,
  PersonalForecastPeriod,
} from '../../lib/personalForecastContract';

const TECHNICAL_OVERVIEW_TITLES = new Set([
  'Личный гороскоп на сегодня',
  'Личный гороскоп на неделю',
  'Личный гороскоп на месяц',
  'Your horoscope for today',
  'Your horoscope for the week',
  'Your horoscope for the month',
]);

type VisibleForecastTitleInput = Pick<ForecastSection, 'kind' | 'title'> & {
  period: PersonalForecastPeriod;
};

export function isRenderableTodaySection(
  section: {
    id: string;
    status: ForecastSection['status'];
    contentBlocks: readonly { text: string }[];
  },
  lockedSectionIds: ReadonlySet<string>,
): boolean {
  return section.status === 'ready'
    && (
      lockedSectionIds.has(section.id)
      || section.contentBlocks.some((block) => block.text.trim())
    );
}

export function resolveVisibleForecastTitle({
  kind,
  title,
}: VisibleForecastTitleInput): string {
  const normalized = title?.trim() || '';
  if (kind !== 'overview') return '';
  if (TECHNICAL_OVERVIEW_TITLES.has(normalized)) return '';
  return normalized;
}
