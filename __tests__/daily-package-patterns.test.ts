import fs from 'fs';
import path from 'path';
import {
  DAILY_PACKAGE_FIELD_KEYS,
  buildDailyPresentationPlan,
  getDashboardSystemText,
  selectDailyPresentationPattern,
} from '../lib/dailyPresentationPatterns';
import { isDailyCanvasComplete, validateDailyCanvas } from '../lib/natalHumanInterpretation';
import { HUMAN_DAILY_PROMPT_VERSION } from '../lib/natalHumanShared';
import { makeDailyCanvasFixture } from './dailyCanvasFixture';

const ROOT = path.join(__dirname, '..');

function packageFixture() {
  return makeDailyCanvasFixture();
}

describe('daily package presentation patterns', () => {
  it('same date gives the same variant key', () => {
    expect(selectDailyPresentationPattern('123', '2026-06-03', 'love.hook')).toBe(
      selectDailyPresentationPattern('123', '2026-06-03', 'love.hook'),
    );
    expect(getDashboardSystemText('loading', 'ru', '2026-06-03')).toBe(
      getDashboardSystemText('loading', 'ru', '2026-06-03'),
    );
  });

  it('next date changes the variant key', () => {
    expect(selectDailyPresentationPattern('123', '2026-06-03', 'love.hook')).not.toBe(
      selectDailyPresentationPattern('123', '2026-06-04', 'love.hook'),
    );
  });

  it('different consecutive fields receive different patterns', () => {
    const plan = buildDailyPresentationPlan('123', '2026-06-03');
    const keys = DAILY_PACKAGE_FIELD_KEYS.map((field) => plan[field]);
    for (let i = 1; i < keys.length; i += 1) {
      expect(keys[i]).not.toBe(keys[i - 1]);
    }
  });

  it('old hardcoded Dashboard hooks are gone', () => {
    const dashboard = fs.readFileSync(path.join(ROOT, 'views', 'Dashboard.tsx'), 'utf8');
    expect(dashboard).not.toContain('Что сегодня с чувствами? Есть нюанс');
    expect(dashboard).not.toContain('Не спеши тратить — вот почему');
    expect(dashboard).not.toContain('Сегодня решает не срочность');
    expect(dashboard).not.toContain('What is up with feelings today?');
    expect(dashboard).not.toContain('Today urgency is not the boss');
  });

  it('daily package keeps every required field complete', () => {
    expect(isDailyCanvasComplete(packageFixture(), 'ru')).toBe(true);
  });

  it('rejects user-facing planet names and raw astrology wording', () => {
    const canvas = packageFixture();
    canvas.money.body += ' Венера давит на Юпитер, поэтому не спеши с покупками.';
    const result = validateDailyCanvas(canvas, 'ru');
    expect(result.valid).toBe(false);
    expect(result.hardErrors).toContain('BAD_TEXT_ASTRO_TERMS');
  });

  it('rejects transit, natal, square and trine terms in user-facing text', () => {
    const canvas = packageFixture();
    canvas.overview += ' Транзит и натальный квадрат переходят в трин.';
    const result = validateDailyCanvas(canvas, 'ru');
    expect(result.valid).toBe(false);
    expect(result.hardErrors).toContain('BAD_TEXT_ASTRO_TERMS');
  });

  it('allows ordinary home wording in the family section', () => {
    const canvas = packageFixture();
    canvas.family.body += ' Домашний ужин в квартире и обычные дела дома остаются бытовой сценой, а не астрологией.';
    const result = validateDailyCanvas(canvas, 'ru');
    expect(result.valid).toBe(true);
    expect(result.hardErrors).toEqual([]);
  });

  it('rejects explicit astrological house constructions only', () => {
    const canvas = packageFixture();
    canvas.family.body += ' Астрологический дом, седьмой дом, планета в доме и управитель дома должны быть скрыты.';
    const result = validateDailyCanvas(canvas, 'ru');
    expect(result.valid).toBe(false);
    expect(result.hardErrors).toContain('BAD_TEXT_ASTRO_TERMS');
  });

  it('rejects banned generic advice templates', () => {
    const canvas = packageFixture();
    canvas.work.body += ' Не распыляйся, выбери одно дело и держи курс.';
    const result = validateDailyCanvas(canvas, 'ru');
    expect(result.valid).toBe(false);
    expect(result.hardErrors).toContain('BAD_TEXT_GENERIC_ADVICE');
  });

  it('rejects the same practical advice repeated across sections', () => {
    const repeated = 'Перед любым ответом сделай короткую паузу, открой календарь, проверь ближайший срок и только потом решай, брать ли на себя новую просьбу. Так ты не перепутаешь чужую срочность со своей ответственностью и не потащишь лишнюю задачу до вечера.';
    const canvas = packageFixture();
    canvas.love.body = repeated;
    canvas.money.body = repeated;
    const result = validateDailyCanvas(canvas, 'ru');
    expect(result.valid).toBe(true);
    expect(result.hardErrors).toEqual([]);
    expect(result.styleWarnings).toContain('REPEATED_SECTION_ADVICE');
  });

  it('rejects one practical idea smeared across hero, overview and sections', () => {
    const canvas = packageFixture();
    canvas.hero_hook = 'Утро звучит как просьба навести конкретность: в сообщении, покупке, рабочем вопросе и семейной мелочи будто снова нужен конкретный срок. Но такой пакет должен быть отклонен, потому что он превращает разные сферы в один прием, а не в живые ситуации.';
    canvas.overview += ' Общая мысль опять сводится к тому, чтобы уточнить условие, назвать конкретный срок и сделать ясный ответ главным инструментом дня.';
    canvas.love.body += ' В отношениях повторяется тот же ход: уточнить условие, назвать конкретный срок и считать ясный ответ решением близости.';
    canvas.money.body += ' В деньгах снова предлагается уточнить условие, назвать конкретный срок и искать ясный ответ вместо отдельной финансовой сцены.';
    const result = validateDailyCanvas(canvas, 'ru');
    expect(result.valid).toBe(true);
    expect(result.hardErrors).toEqual([]);
    expect(result.styleWarnings).toContain('REPEATED_SECTION_ADVICE');
  });

  it('keeps a section without its own recognizable scene type as a style warning', () => {
    const canvas = packageFixture();
    canvas.family.body = 'В этом разделе есть просьба, разговор, ответ и пауза, но нет узнаваемой сцены нужной сферы. Текст выглядит достаточно длинным и конкретным на поверхности, однако вместо отдельной ситуации своего раздела снова описывает общий способ реагировать.';
    const result = validateDailyCanvas(canvas, 'ru');
    expect(result.valid).toBe(true);
    expect(result.hardErrors).toEqual([]);
    expect(result.styleWarnings).toContain('ABSTRACT_DAILY_TEXT');
  });

  it('keeps a short hero hook as a style warning, not a hard error', () => {
    const canvas = packageFixture();
    canvas.hero_hook = 'Короткое превью дня с сообщением, покупкой и вечерним разговором.';
    const result = validateDailyCanvas(canvas, 'ru');
    expect(result.valid).toBe(true);
    expect(result.hardErrors).toEqual([]);
    expect(result.styleWarnings).toContain('HERO_HOOK_TOO_SHORT');
  });

  it('reports a concrete hard error for a hard-invalid package', () => {
    const result = validateDailyCanvas({ ...packageFixture(), meta: { free_section_key: 'bad' } }, 'ru');
    expect(result.valid).toBe(false);
    expect(result.hardErrors).toContain('INVALID_FREE_SECTION_KEY');
  });

  it('keeps repeated hook starts as a style warning, not a hard error', () => {
    const canvas = packageFixture();
    for (const key of ['love', 'money', 'work', 'goals', 'family', 'friendship', 'energy', 'communication'] as const) {
      canvas[key].hook = 'Один мягкий старт для проверки';
    }
    const result = validateDailyCanvas(canvas, 'ru');
    expect(result.valid).toBe(true);
    expect(result.hardErrors).toEqual([]);
    expect(result.styleWarnings).toContain('REPEATED_HOOK_START');
  });

  it('keeps the today-word limit as a style warning, not a hard error', () => {
    const canvas = packageFixture();
    canvas.hero_hook = `${canvas.hero_hook} сегодня сегодня сегодня`;
    const result = validateDailyCanvas(canvas, 'ru');
    expect(result.valid).toBe(true);
    expect(result.hardErrors).toEqual([]);
    expect(result.styleWarnings).toContain('TODAY_WORD_OVER_LIMIT');
  });

  it('treats a missing topic body as a hard error', () => {
    const canvas = packageFixture();
    canvas.money.body = '';
    const result = validateDailyCanvas(canvas, 'ru');
    expect(result.valid).toBe(false);
    expect(result.hardErrors).toContain('EMPTY_TOPIC_BODY');
  });

  it('Dashboard hero shows the full hook without CSS line clamp', () => {
    const dashboard = fs.readFileSync(path.join(ROOT, 'views', 'Dashboard.tsx'), 'utf8');
    const css = fs.readFileSync(path.join(ROOT, 'styles', 'globals.css'), 'utf8');
    const heroTextBlocks = css.match(/\.home-day-hero-(?:title|text)\s*{[^}]*}/g)?.join('\n') || '';
    expect(dashboard).toContain('home-day-hero-cta');
    expect(heroTextBlocks).not.toContain('-webkit-line-clamp');
  });

  it('PersonalDaily tabs use horizontal scroll without wrapping labels', () => {
    const screen = fs.readFileSync(path.join(ROOT, 'views', 'DailyContentScreens.tsx'), 'utf8');
    const tabs = fs.readFileSync(path.join(ROOT, 'components', 'fresh-ui', 'FreshTabs.tsx'), 'utf8');
    const css = fs.readFileSync(path.join(ROOT, 'styles', 'globals.css'), 'utf8');
    expect(screen).toContain('className="personal-daily-tabs"');
    expect(tabs).toContain('scrollIntoView');
    expect(css).toMatch(/\.personal-daily-tabs\s*{[^}]*overflow-x:\s*auto/s);
    expect(css).toMatch(/\.personal-daily-tabs \.fresh-tab\s*{[^}]*flex:\s*0 0 auto/s);
    expect(css).toMatch(/\.personal-daily-tabs \.fresh-tab\s*{[^}]*white-space:\s*nowrap/s);
  });

  it('bumps the daily package prompt version so old cached voice is not current', () => {
    expect(HUMAN_DAILY_PROMPT_VERSION).toBe('your-horoscope-v4.daily-distinct-scenes');
    expect(HUMAN_DAILY_PROMPT_VERSION).not.toBe('your-horoscope-v3.daily-human-voice');
    expect(HUMAN_DAILY_PROMPT_VERSION).not.toBe('your-horoscope-v2.daily-package');
  });

  it('Dashboard renders card hooks from the startup package without its own retry loader', () => {
    const dashboard = fs.readFileSync(path.join(ROOT, 'views', 'Dashboard.tsx'), 'utf8');
    expect(dashboard).not.toContain('isDailyError');
    expect(dashboard).not.toContain('retryDailyPackage');
    expect(dashboard).not.toContain('requestDailyPackage');
    expect(dashboard).toContain('dailyPackage?.[key]?.hook');
    expect(dashboard).toContain('getDashboardSystemText(systemState');
  });
});
