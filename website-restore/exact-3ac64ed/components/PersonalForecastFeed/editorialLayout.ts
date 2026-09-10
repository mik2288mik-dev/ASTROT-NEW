import type {
  ForecastSection,
  PersonalForecastPeriod,
} from '../../lib/personalForecastContract';
import type { DiaryLayout } from '../../lib/personalForecastVisuals';

export const TODAY_EDITORIAL_LAYOUT_VARIANTS = [
  'visual-right-note',
  'visual-left-quote',
  'text-quote-visual-note',
  'hero-visual-note',
  'typography-first',
] as const;

export type TodayEditorialLayout = typeof TODAY_EDITORIAL_LAYOUT_VARIANTS[number];
export type ForecastEditorialLayout = TodayEditorialLayout | 'prose';
export type EditorialPaperShape = 'torn' | 'memo' | 'ticket' | 'folded';

const TECHNICAL_OVERVIEW_TITLES = new Set([
  'Личный гороскоп на сегодня',
  'Личный гороскоп на неделю',
  'Личный гороскоп на месяц',
  'Your horoscope for today',
  'Your horoscope for the week',
  'Your horoscope for the month',
]);

export const TODAY_EDITORIAL_LAYOUT_BY_VISUAL_PLAN: Record<
  DiaryLayout,
  TodayEditorialLayout
> = {
  editorial_right: 'visual-right-note',
  editorial_left: 'visual-left-quote',
  quote_first: 'text-quote-visual-note',
  visual_overlap: 'hero-visual-note',
  editorial_clean: 'typography-first',
};

type ForecastEditorialLayoutInput = {
  userId: string;
  period: PersonalForecastPeriod;
  periodKey: string;
};

type VisibleForecastTitleInput = Pick<ForecastSection, 'kind' | 'title'> & {
  period: PersonalForecastPeriod;
};

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function resolveForecastEditorialLayout({
  userId,
  period,
  periodKey,
}: ForecastEditorialLayoutInput): ForecastEditorialLayout {
  if (period !== 'day') return 'prose';
  const index = stableHash(`${userId}|${periodKey}`)
    % TODAY_EDITORIAL_LAYOUT_VARIANTS.length;
  return TODAY_EDITORIAL_LAYOUT_VARIANTS[index];
}

export function resolveTodayEditorialLayoutFromVisualPlan(
  layout: DiaryLayout,
): TodayEditorialLayout {
  return TODAY_EDITORIAL_LAYOUT_BY_VISUAL_PLAN[layout];
}

export function resolveTodayEditorialVisualSize(
  layout: TodayEditorialLayout,
): 'small' | 'medium' | 'hero' {
  if (layout === 'hero-visual-note') return 'hero';
  if (layout === 'typography-first') return 'small';
  return 'medium';
}

export function resolveTodayVisualAnchorId(input: {
  layout: TodayEditorialLayout;
  sections: readonly Pick<
    ForecastSection,
    'id' | 'kind' | 'presentationStyle' | 'status'
  >[];
}): string | null {
  const sections = input.sections.filter((section) => section.status === 'ready');
  if (!sections.length) return null;
  const readingSections = sections.filter((section) => section.kind !== 'overview');
  const candidates = readingSections.length ? readingSections : sections;
  const quoteIndex = candidates.findIndex(
    (section) => section.presentationStyle === 'pull_quote',
  );
  const noteIndex = candidates.findIndex(
    (section) => section.presentationStyle === 'paper_note',
  );
  const middleIndex = Math.min(candidates.length - 1, Math.floor(candidates.length / 2));

  if (input.layout === 'visual-left-quote' && quoteIndex >= 0) {
    return candidates[quoteIndex].id;
  }
  if (input.layout === 'hero-visual-note' && noteIndex >= 0) {
    return candidates[noteIndex].id;
  }
  if (
    (input.layout === 'visual-right-note'
      || input.layout === 'text-quote-visual-note')
    && noteIndex > 0
  ) {
    return candidates[noteIndex - 1].id;
  }
  if (input.layout === 'text-quote-visual-note' && quoteIndex >= 0) {
    return candidates[quoteIndex].id;
  }
  return candidates[middleIndex].id;
}

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

function wordCount(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

/**
 * Creates presentation-only paragraphs for a cohesive Week or Month story.
 * Sentence order and copy stay untouched; only visual reading pauses are added.
 */
export function resolveLongForecastParagraphs(
  blocks: readonly string[],
): string[] {
  const source = blocks.map((block) => block.trim()).filter(Boolean).join(' ');
  if (!source) return [];
  const sentences = source.split(/(?<=[.!?…])\s+/u).filter(Boolean);
  const totalWords = wordCount(source);
  const desiredGroups = totalWords >= 72 ? 3 : totalWords >= 38 ? 2 : 1;
  const groupCount = Math.min(desiredGroups, sentences.length);
  if (groupCount <= 1) return [source];

  const paragraphs: string[] = [];
  let sentenceIndex = 0;
  let remainingWords = totalWords;

  for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
    const remainingGroups = groupCount - groupIndex;
    if (remainingGroups === 1) {
      paragraphs.push(sentences.slice(sentenceIndex).join(' '));
      break;
    }

    const targetWords = remainingWords / remainingGroups;
    const lastAllowedEnd = sentences.length - (remainingGroups - 1);
    let chosenEnd = sentenceIndex + 1;
    let chosenWords = wordCount(sentences[sentenceIndex]);
    let candidateWords = 0;
    let smallestDistance = Number.POSITIVE_INFINITY;

    for (let end = sentenceIndex + 1; end <= lastAllowedEnd; end += 1) {
      candidateWords += wordCount(sentences[end - 1]);
      const distance = Math.abs(candidateWords - targetWords);
      if (distance < smallestDistance) {
        smallestDistance = distance;
        chosenEnd = end;
        chosenWords = candidateWords;
      }
      if (candidateWords >= targetWords) break;
    }

    paragraphs.push(sentences.slice(sentenceIndex, chosenEnd).join(' '));
    sentenceIndex = chosenEnd;
    remainingWords -= chosenWords;
  }

  return paragraphs;
}

export function resolveEditorialPaperTreatment(seed: string): {
  shape: EditorialPaperShape;
  rotationDeg: number;
} {
  const hash = stableHash(seed);
  const shapes: readonly EditorialPaperShape[] = ['torn', 'memo', 'ticket', 'folded'];
  const rotations = [-4, -3, -2, 2, 3, 4] as const;
  return {
    shape: shapes[hash % shapes.length],
    rotationDeg: rotations[Math.floor(hash / shapes.length) % rotations.length],
  };
}

export function resolveVisibleForecastTitle({
  period,
  kind,
  title,
}: VisibleForecastTitleInput): string {
  const normalized = title?.trim() || '';
  if (period === 'day' && kind !== 'overview') return '';
  if (kind === 'overview' && TECHNICAL_OVERVIEW_TITLES.has(normalized)) return '';
  return normalized;
}
