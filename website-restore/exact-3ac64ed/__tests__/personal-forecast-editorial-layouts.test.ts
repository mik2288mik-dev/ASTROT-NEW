import fs from 'fs';
import path from 'path';
import {
  TODAY_EDITORIAL_LAYOUT_VARIANTS,
  isRenderableTodaySection,
  resolveEditorialPaperTreatment,
  resolveForecastEditorialLayout,
  resolveLongForecastParagraphs,
  resolveTodayEditorialLayoutFromVisualPlan,
  resolveTodayEditorialVisualSize,
  resolveTodayVisualAnchorId,
  resolveVisibleForecastTitle,
} from '../components/PersonalForecastFeed/editorialLayout';
import { clampDiaryVisualSize } from '../lib/personalForecastVisuals';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Today editorial layout system', () => {
  it('keeps legacy layout helpers deterministic while long periods remain prose', () => {
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
    expect([
      resolveTodayEditorialLayoutFromVisualPlan('editorial_right'),
      resolveTodayEditorialLayoutFromVisualPlan('editorial_left'),
      resolveTodayEditorialLayoutFromVisualPlan('quote_first'),
      resolveTodayEditorialLayoutFromVisualPlan('visual_overlap'),
      resolveTodayEditorialLayoutFromVisualPlan('editorial_clean'),
    ]).toEqual(TODAY_EDITORIAL_LAYOUT_VARIANTS);
    expect(resolveForecastEditorialLayout({
      userId: 'person-42',
      period: 'week',
      periodKey: '2026-W33',
    })).toBe('prose');
    expect(resolveForecastEditorialLayout({
      userId: 'person-42',
      period: 'month',
      periodKey: '2026-08',
    })).toBe('prose');
    expect(read('components/PersonalForecastFeed/editorialLayout.ts')).not.toContain('Math.random');
  });

  it('keeps visual-anchor helpers deterministic while Today uses the calendar composition', () => {
    const sections = [
      { id: 'overview', kind: 'overview' as const, status: 'ready' as const, presentationStyle: 'prose' as const },
      { id: 'story', kind: 'dynamic' as const, status: 'ready' as const, presentationStyle: 'prose' as const },
      { id: 'quote', kind: 'dynamic' as const, status: 'ready' as const, presentationStyle: 'pull_quote' as const },
      { id: 'before-note', kind: 'dynamic' as const, status: 'ready' as const, presentationStyle: 'prose' as const },
      { id: 'note', kind: 'dynamic' as const, status: 'ready' as const, presentationStyle: 'paper_note' as const },
    ];
    expect(resolveTodayVisualAnchorId({ layout: 'visual-left-quote', sections })).toBe('quote');
    expect(resolveTodayVisualAnchorId({ layout: 'visual-right-note', sections })).toBe('before-note');
    expect(resolveTodayVisualAnchorId({ layout: 'hero-visual-note', sections })).toBe('note');

    const feed = read('components/PersonalForecastFeed/TodayEditorialFeed.tsx');
    const dashboard = read('views/Dashboard.tsx');
    expect(feed).toContain('isRenderableTodaySection(section, lockedSectionIds)');
    expect(feed).toContain("section.kind === 'overview'");
    expect(feed).toContain('<TodayCalendarClock');
    expect(feed).toContain('<TodayLineField');
    expect(feed).toContain('data-today-layout="calendar-editorial"');
    expect(feed).toContain('const title = resolveTitle(overview)');
    expect(feed).toContain('const punchline = resolvePunchline(overview)');
    expect(feed).toContain('className="today-minimal-story-title"');
    expect(feed).toContain('className="today-minimal-punchline"');
    expect(feed).toContain("block.role === 'lead'");
    expect(feed).toContain("language === 'ru' ? 'Совет дня'");
    expect(feed).not.toContain('emphasizeOpening');
    expect(feed).not.toContain('today-minimal-opening-phrase');
    expect(feed).not.toContain('EditorialForecastVisual');
    expect(feed).not.toContain('EditorialSticker');
    expect(feed).not.toContain('Вывод и совет');
    expect(dashboard).toContain('timezone={timezone}');
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

  it('keeps legacy visual scales available without placing stickers in Today', () => {
    expect(resolveTodayEditorialVisualSize('hero-visual-note')).toBe('hero');
    expect(resolveTodayEditorialVisualSize('typography-first')).toBe('small');
    expect(resolveTodayEditorialVisualSize('visual-right-note')).toBe('medium');
    expect(clampDiaryVisualSize('hero', 'light')).toBe('small');
    expect(clampDiaryVisualSize('hero', 'medium')).toBe('medium');
    expect(clampDiaryVisualSize('hero', 'hero')).toBe('hero');
  });

  it('hides internal Today titles without hiding the generated period title', () => {
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
    expect(note).not.toContain('dangerouslySetInnerHTML');
  });

  it('keeps narrow screens in one column with safe-area and long-copy guards', () => {
    const styles = read('styles/personalForecastFeed.css');
    expect(styles).toContain('@container today-editorial-feed (max-width: 20.75rem)');
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(styles).toContain('min-inline-size: 0;');
    expect(styles).toContain('overflow-x: clip;');
    expect(styles).toContain('env(safe-area-inset-left, 0px)');
    expect(styles).toContain('env(safe-area-inset-right, 0px)');
    expect(styles).toContain('hyphens: auto;');
    expect(styles).toContain('overflow-wrap: break-word;');
  });
});
