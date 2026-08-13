import fs from 'fs';
import path from 'path';
import {
  TODAY_EDITORIAL_LAYOUT_VARIANTS,
  isRenderableTodaySection,
  resolveTodayEditorialLayoutFromVisualPlan,
  resolveTodayEditorialVisualSize,
  resolveTodayVisualAnchorId,
  resolveEditorialPaperTreatment,
  resolveForecastEditorialLayout,
  resolveLongForecastParagraphs,
  resolveVisibleForecastTitle,
} from '../components/PersonalForecastFeed/editorialLayout';
import { clampDiaryVisualSize } from '../lib/personalForecastVisuals';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Today editorial layout system', () => {
  it('publishes five deterministic day compositions and keeps long periods as prose', () => {
    expect(TODAY_EDITORIAL_LAYOUT_VARIANTS).toEqual([
      'visual-right-note',
      'visual-left-quote',
      'text-quote-visual-note',
      'hero-visual-note',
      'typography-first',
    ]);

    const stableInput = {
      userId: 'person-42',
      period: 'day' as const,
      periodKey: '2026-08-11',
    };
    expect(new Set(Array.from(
      { length: 8 },
      () => resolveForecastEditorialLayout(stableInput),
    )).size).toBe(1);

    const sampled = new Set(Array.from({ length: 320 }, (_, index) => (
      resolveForecastEditorialLayout({
        userId: `person-${index % 17}`,
        period: 'day',
        periodKey: `2026-09-${String((index % 28) + 1).padStart(2, '0')}-${index}`,
      })
    )));
    expect(sampled).toEqual(new Set(TODAY_EDITORIAL_LAYOUT_VARIANTS));
    expect(resolveForecastEditorialLayout({
      userId: 'person-42',
      period: 'week',
      periodKey: '2026-W33',
    })).toBe('prose');

    expect([
      resolveTodayEditorialLayoutFromVisualPlan('editorial_right'),
      resolveTodayEditorialLayoutFromVisualPlan('editorial_left'),
      resolveTodayEditorialLayoutFromVisualPlan('quote_first'),
      resolveTodayEditorialLayoutFromVisualPlan('visual_overlap'),
      resolveTodayEditorialLayoutFromVisualPlan('editorial_clean'),
    ]).toEqual(TODAY_EDITORIAL_LAYOUT_VARIANTS);
    expect(resolveForecastEditorialLayout({
      userId: 'person-42',
      period: 'month',
      periodKey: '2026-08',
    })).toBe('prose');

    expect(read('components/PersonalForecastFeed/editorialLayout.ts'))
      .not.toContain('Math.random');
  });

  it('anchors a visual to presentation metadata without using locked content', () => {
    const sections = [
      { id: 'overview', kind: 'overview' as const, status: 'ready' as const, presentationStyle: 'prose' as const },
      { id: 'story', kind: 'dynamic' as const, status: 'ready' as const, presentationStyle: 'prose' as const },
      { id: 'quote', kind: 'dynamic' as const, status: 'ready' as const, presentationStyle: 'pull_quote' as const },
      { id: 'before-note', kind: 'dynamic' as const, status: 'ready' as const, presentationStyle: 'prose' as const },
      { id: 'note', kind: 'dynamic' as const, status: 'ready' as const, presentationStyle: 'paper_note' as const },
    ];
    expect(resolveTodayVisualAnchorId({
      layout: 'visual-left-quote',
      sections,
    })).toBe('quote');
    expect(resolveTodayVisualAnchorId({
      layout: 'visual-right-note',
      sections,
    })).toBe('before-note');
    expect(resolveTodayVisualAnchorId({
      layout: 'hero-visual-note',
      sections,
    })).toBe('note');

    const feed = read('components/PersonalForecastFeed/TodayEditorialFeed.tsx');
    const dashboard = read('views/Dashboard.tsx');
    expect(feed).toContain('section.presentationStyle');
    expect(feed).toContain('renderableSections.filter((section) => !lockedSectionIds.has(section.id))');
    expect(feed).toContain('isRenderableTodaySection(section, lockedSectionIds)');
    expect(feed).toContain('{renderableSections.map((section, index) => {');
    expect(feed).toContain('resolveTodayEditorialLayoutFromVisualPlan(visualPlan.layout)');
    expect(feed).toContain('visualPlan?.asset && section.id === visualAnchorId');
    expect(feed).toContain('specialOverviewStyle');
    expect(dashboard).toContain('resolveDiaryTodayVisualPlan({');
    expect(dashboard).toContain('contractVersion: forecast?.meta.contractVersion');
    expect(dashboard).toContain('visualPlan={todayVisualPlan}');
  });

  it('keeps readable and locked previews while dropping empty or unavailable beats', () => {
    const lockedIds = new Set(['locked']);
    expect(isRenderableTodaySection({
      id: 'ready',
      status: 'ready',
      contentBlocks: [{ text: 'Живой фрагмент' }],
    }, lockedIds)).toBe(true);
    expect(isRenderableTodaySection({
      id: 'empty',
      status: 'ready',
      contentBlocks: [{ text: '   ' }],
    }, lockedIds)).toBe(false);
    expect(isRenderableTodaySection({
      id: 'locked',
      status: 'ready',
      contentBlocks: [],
    }, lockedIds)).toBe(true);
    expect(isRenderableTodaySection({
      id: 'unavailable',
      status: 'unavailable',
      contentBlocks: [{ text: 'Не должно появиться' }],
    }, lockedIds)).toBe(false);
  });

  it('maps each composition to its intended visual scale', () => {
    const feed = read('components/PersonalForecastFeed/TodayEditorialFeed.tsx');
    expect(resolveTodayEditorialVisualSize('hero-visual-note')).toBe('hero');
    expect(resolveTodayEditorialVisualSize('typography-first')).toBe('small');
    expect(resolveTodayEditorialVisualSize('visual-right-note')).toBe('medium');
    expect(resolveTodayEditorialVisualSize('visual-left-quote')).toBe('medium');
    expect(resolveTodayEditorialVisualSize('text-quote-visual-note')).toBe('medium');
    expect(clampDiaryVisualSize('hero', 'light')).toBe('small');
    expect(clampDiaryVisualSize('hero', 'medium')).toBe('medium');
    expect(clampDiaryVisualSize('hero', 'hero')).toBe('hero');
    expect(feed).toContain('pause.asset.collection === \'editorial-v2\'');
    expect(feed).toContain('pause.asset.displayWeight');
  });

  it('hides internal Today titles without hiding the real headline or long-period titles', () => {
    expect(resolveVisibleForecastTitle({
      period: 'day',
      kind: 'dynamic',
      title: 'Любовь',
    })).toBe('');
    expect(resolveVisibleForecastTitle({
      period: 'day',
      kind: 'overview',
      title: 'Сегодня ты не проходишь мимо главного',
    })).toBe('Сегодня ты не проходишь мимо главного');
    expect(resolveVisibleForecastTitle({
      period: 'week',
      kind: 'overview',
      title: 'Неделя без лишней суеты',
    })).toBe('Неделя без лишней суеты');
    expect(resolveVisibleForecastTitle({
      period: 'day',
      kind: 'overview',
      title: 'Личный гороскоп на сегодня',
    })).toBe('');
  });

  it('turns a long Week or Month story into balanced visual paragraphs without changing its words', () => {
    const story = [
      'The week begins with a useful pause before the next important decision arrives.',
      'You can hear what matters when the surrounding noise is allowed to settle.',
      'A practical conversation then becomes easier because your position is already clear.',
      'Keep the promise small enough to complete it with care and without haste.',
      'That steady rhythm leaves room for warmth instead of another round of explanations.',
      'By staying with one direction, you finish the story with more confidence.',
    ].join(' ');

    const paragraphs = resolveLongForecastParagraphs([story]);

    expect(paragraphs).toHaveLength(3);
    expect(paragraphs.join(' ')).toBe(story);
    expect(paragraphs.every((paragraph) => paragraph.trim().length > 0)).toBe(true);
  });

  it('keeps fallback paper stable while template-backed note text stays live', () => {
    const treatments = Array.from({ length: 200 }, (_, index) => (
      resolveEditorialPaperTreatment(`note-${index}`)
    ));
    expect(resolveEditorialPaperTreatment('note-42'))
      .toEqual(resolveEditorialPaperTreatment('note-42'));
    expect(new Set(treatments.map((item) => item.shape)).size).toBe(4);
    expect(treatments.every((item) => (
      Math.abs(item.rotationDeg) >= 2 && Math.abs(item.rotationDeg) <= 4
    ))).toBe(true);

    const note = read('components/PersonalForecastFeed/EditorialPaperNote.tsx');
    expect(note).toContain('<aside');
    expect(note).toContain('<p>{text}</p>');
    expect(note).toContain('data-paper-shape={template ? undefined : treatment.shape}');
    expect(note).toContain('src={template.path}');
    expect(note).toContain('safeTextArea[0] * 100');
    expect(note).not.toContain('dangerouslySetInnerHTML');
    expect(note).toContain('<img');
  });

  it('renders quotes as text and supports natural-ratio visual sizes', () => {
    const quote = read('components/PersonalForecastFeed/EditorialQuote.tsx');
    const visual = read('components/PersonalForecastFeed/EditorialForecastVisual.tsx');
    const sticker = read('components/EditorialSticker.tsx');
    const styles = read('styles/personalForecastFeed.css');

    expect(quote).toContain('<blockquote');
    expect(quote).toContain('{text}');
    expect(quote).not.toContain('<img');
    expect(visual).toContain("type EditorialVisualSize = 'small' | 'medium' | 'hero'");
    expect(visual).toContain('data-editorial-size={size}');
    expect(visual).toContain('<EditorialSticker');
    expect(sticker).toContain('width={asset.width}');
    expect(sticker).toContain('height={asset.height}');
    expect(sticker).toContain("'--editorial-sticker-ratio'");
    expect(styles).toContain("[data-editorial-size='small']");
    expect(styles).toContain("[data-editorial-size='medium']");
    expect(styles).toContain("[data-editorial-size='hero']");
    const visualImageRule = styles.match(
      /\.forecast-editorial-visual \.forecast-editorial-visual-image img \{([\s\S]*?)\}/,
    )?.[1] || '';
    expect(visualImageRule).toContain('object-fit: contain;');
    expect(visualImageRule).toContain('height: auto;');
  });

  it('defines a CSS composition for every stable layout id', () => {
    const styles = read('styles/personalForecastFeed.css');
    for (const variant of TODAY_EDITORIAL_LAYOUT_VARIANTS) {
      expect(styles).toContain(`[data-today-layout='${variant}']`);
    }
  });

  it('keeps narrow screens in one column with safe-area and long-copy guards', () => {
    const styles = read('styles/personalForecastFeed.css');
    expect(styles).toContain('@container today-editorial-feed (max-width: 20.75rem)');
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(styles).toContain('min-inline-size: 0;');
    expect(styles).toContain('overflow-x: clip;');
    expect(styles).toContain('env(safe-area-inset-left, 0px)');
    expect(styles).toContain('env(safe-area-inset-right, 0px)');
    expect(styles).toContain('var(--tg-content-safe-area-inset-left, 0px)');
    expect(styles).toContain('var(--tg-safe-area-inset-right, 0px)');
    expect(styles).toContain('hyphens: auto;');
    expect(styles).toContain('overflow-wrap: break-word;');
  });
});
