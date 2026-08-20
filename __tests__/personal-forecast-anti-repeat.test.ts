import {
  buildPersonalForecastRepeatFingerprint,
  findPersonalForecastRepeatViolations,
  normalizePersonalForecastText,
  type PersonalForecastRepeatFragment,
} from '../lib/personalForecastGeneration';

function fragment(
  text: string,
  overrides: Partial<PersonalForecastRepeatFragment> = {},
): PersonalForecastRepeatFragment {
  return {
    text,
    mainIdeaKey: '',
    lifePlotKey: '',
    adviceKey: '',
    comparisonKey: '',
    semanticFingerprint: null,
    ...overrides,
  };
}

describe('personal forecast anti-repeat guard', () => {
  test('normalizes case, ё, punctuation, and dashes deterministically', () => {
    expect(normalizePersonalForecastText('  Всё — ТО ЖЕ, самое!  ')).toBe('все то же самое');
  });

  test('rejects identical openings', () => {
    const errors = findPersonalForecastRepeatViolations([
      fragment('Сегодня тебе особенно легко заметить чужую неточность и спокойно ответить.'),
      fragment('Сегодня тебе особенно легко заметить чужую спешку и не подхватить её.'),
    ]);
    expect(errors.join(' ')).toContain('repeated opening');
  });

  test('rejects a repeated short headline from recent history', () => {
    const errors = findPersonalForecastRepeatViolations([
      fragment('Точность без лишнего шума', { kind: 'headline' }),
    ], [
      fragment('Точность — без лишнего шума', { kind: 'headline' }),
    ]);
    expect(errors.join(' ')).toContain('repeated headline');
  });

  test('rejects a close paraphrase of a 2–5-word headline', () => {
    const errors = findPersonalForecastRepeatViolations([
      fragment('Сегодня можно наглеть', { kind: 'headline' }),
    ], [
      fragment('Сегодня пора наглеть', { kind: 'headline' }),
    ]);
    expect(errors.join(' ')).toContain('repeated headline');
  });

  test('rejects near-identical wording against recent generated copy', () => {
    const current = fragment(
      'Тебе будет проще закончить разговор без лишних объяснений и оставить решение за собой.',
    );
    const recent = fragment(
      'Тебе проще закончить разговор без лишних объяснений и оставить это решение за собой.',
    );
    expect(findPersonalForecastRepeatViolations([current], [recent]).join(' '))
      .toContain('near-duplicate');
  });

  test.each([
    ['main idea', { mainIdeaKey: 'не объяснять лишнее' }],
    ['life plot', { lifePlotKey: 'разговор с неудобной просьбой' }],
    ['advice', { adviceKey: 'проверить детали до ответа' }],
    ['comparison', { comparisonKey: 'как чек без итоговой суммы' }],
  ] as const)('rejects a repeated hidden %s key', (_label, repeatedKey) => {
    const errors = findPersonalForecastRepeatViolations([
      fragment('Первый совершенно самостоятельный текст.', repeatedKey),
      fragment('Второй заметно отличается по формулировке.', repeatedKey),
    ]);
    expect(errors.join(' ')).toContain('repeated');
  });

  test('rejects the same advice and signature comparison phrased almost alike', () => {
    const recent = fragment(
      'Лучше проверь цифры до ответа: сейчас письмо без деталей — как чек без итоговой суммы.',
    );
    const current = fragment(
      'Тебе лучше проверить цифры перед ответом. Иначе письмо выглядит как чек без итоговой суммы.',
    );
    const errors = findPersonalForecastRepeatViolations([current], [recent]).join(' ');
    expect(errors).toContain('repeated advice');
    expect(errors).toContain('repeated comparison');
  });

  test('rejects a copied wish or motivational ending with changed framing', () => {
    const errors = findPersonalForecastRepeatViolations([
      fragment('Желаю закончить неделю легко: нужное сделано, приятное случилось, силы остались.'),
    ], [
      fragment('Пусть неделя закончится легко: нужное сделано, приятное случилось, силы остались.'),
    ]).join(' ');

    expect(errors).toContain('repeated advice');
  });

  test('rejects a paraphrased life plot recovered from a persisted fingerprint', () => {
    const persisted = buildPersonalForecastRepeatFingerprint(fragment(
      'Старый текст был сформулирован совсем иначе и не совпадает словами.',
      { lifePlotKey: 'границы в рабочем разговоре' },
    ));
    const errors = findPersonalForecastRepeatViolations([
      fragment(
        'Новый текст говорит об иной детали и сам по себе не похож на прошлый.',
        { lifePlotKey: 'рабочий разговор о личных границах' },
      ),
    ], [
      fragment('Старый текст был сформулирован совсем иначе и не совпадает словами.', {
        semanticFingerprint: persisted,
      }),
    ]);
    expect(errors.join(' ')).toContain('repeated life plot');
  });

  test('does not treat shared advice scaffolding as the same advice', () => {
    const errors = findPersonalForecastRepeatViolations([
      fragment('Тебе лучше проверить детали перед ответом.'),
    ], [
      fragment('Тебе лучше выбрать спокойный тон перед разговором.'),
    ]);
    expect(errors).not.toContain('repeated advice');
  });

  test('accepts five genuinely different fragments with ordinary shared words', () => {
    const errors = findPersonalForecastRepeatViolations([
      fragment('Ты быстрее обычного отделяешь полезную просьбу от чужой суеты.', { mainIdeaKey: 'отбор просьб' }),
      fragment('Короткий разговор может вернуть делу ясные границы без громких заявлений.', { mainIdeaKey: 'ясный разговор' }),
      fragment('В знакомой задаче найдётся деталь, которая раньше казалась неважной.', { mainIdeaKey: 'заметная деталь' }),
      fragment('Чужая уверенность сегодня не обязана становиться твоим решением.', { mainIdeaKey: 'чужая уверенность' }),
      fragment('Хорошая пауза сработает не как бегство, а как монтаж без лишнего кадра.', { mainIdeaKey: 'уместная пауза' }),
    ]);
    expect(errors).toEqual([]);
  });
});
