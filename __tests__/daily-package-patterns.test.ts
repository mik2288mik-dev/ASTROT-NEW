import fs from 'fs';
import path from 'path';
import {
  DAILY_PACKAGE_FIELD_KEYS,
  buildDailyPresentationPlan,
  getDashboardSystemText,
  selectDailyPresentationPattern,
} from '../lib/dailyPresentationPatterns';
import { isDailyCanvasComplete, validateDailyCanvas } from '../lib/natalHumanInterpretation';
import type { DailyCanvas } from '../lib/natalHumanShared';

const ROOT = path.join(__dirname, '..');

const body = (seed: string) =>
  `${seed} Это достаточно длинный текст раздела, который описывает практический фокус без обещаний событий, без выдуманных астрологических данных и без повторения hero.`;

function packageFixture(): DailyCanvas {
  return {
    hero_title: 'Тише к сути, без лишнего шума',
    hero_hook: 'Один честный выбор важнее набора случайных реакций.',
    overview: 'В карте и транзитах виден день, где лучше держать внимание на одном внятном действии. Не нужно разгонять каждую мысль до решения: полезнее отделить важное от чужой срочности, ответить там, где давно просится ясность, и оставить небольшой запас сил на вечер. Общий тон мягкий, но требовательный к точности.',
    love: { hook: 'Близость просит ясности', body: body('В отношениях лучше не проверять человека намеками.') },
    money: { hook: 'Расходы любят паузу', body: body('В деньгах полезно отделить желание быстро снять напряжение от необходимости.') },
    work: { hook: 'Задача выигрывает от порядка', body: body('В работе сильнее всего помогает простая последовательность действий.') },
    goals: { hook: 'Цель становится меньше', body: body('В целях лучше выбрать шаг, который можно завершить без внутреннего торга.') },
    family: { hook: 'Дому нужна договоренность', body: body('В семье и быту помогает не разговор обо всем, а одно понятное правило.') },
    friendship: { hook: 'Друзьям хватит точности', body: body('В дружеском контакте лучше написать коротко и по делу.') },
    energy: { hook: 'Сила держится на темпе', body: body('В нагрузке стоит смотреть не на героизм, а на устойчивый ритм.') },
    communication: { hook: 'Разговор веди короче', body: body('В общении работает прямота без давления: назвать суть и дать место ответить.') },
    meta: {
      free_section_key: 'love',
      locale: 'ru',
      voice_version: 'voice-test',
      date_key: '2026-06-03',
      pattern_keys: buildDailyPresentationPlan('123', '2026-06-03'),
    },
  };
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

  it('Dashboard does not repeat the same generation error through all cards', () => {
    const dashboard = fs.readFileSync(path.join(ROOT, 'views', 'Dashboard.tsx'), 'utf8');
    expect((dashboard.match(/Ничего мистического/g) || []).length).toBe(1);
    expect(dashboard).toContain('!isDailyError ? (');
    expect(dashboard).toContain('dailyPackage?.[key]?.hook');
  });
});
