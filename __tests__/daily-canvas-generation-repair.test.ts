export {};

const longBody = (seed: string) =>
  `${seed} Это достаточно длинный текст раздела, который сохраняет практический тон, не обещает событий и не добавляет выдуманных астрологических данных. Он описывает фокус дня через карту и транзиты, без фатализма и без лишней мистики.`;

function validCanvas() {
  return {
    hero_title: 'Тише к сути, без лишнего шума',
    hero_hook: 'Один честный выбор важнее набора случайных реакций.',
    overview: 'В карте и транзитах виден день, где лучше держать внимание на одном внятном действии. Не нужно разгонять каждую мысль до решения: полезнее отделить важное от чужой срочности, ответить там, где давно просится ясность, и оставить небольшой запас сил на вечер. Общий тон мягкий, но требовательный к точности.',
    love: { hook: 'Близость просит ясности', body: longBody('В отношениях лучше не проверять человека намеками.') },
    money: { hook: 'Расходы любят паузу', body: longBody('В деньгах полезно отделить желание быстро снять напряжение от необходимости.') },
    work: { hook: 'Задача выигрывает от порядка', body: longBody('В работе сильнее всего помогает простая последовательность действий.') },
    goals: { hook: 'Цель становится меньше', body: longBody('В целях лучше выбрать шаг, который можно завершить без внутреннего торга.') },
    family: { hook: 'Дому нужна договоренность', body: longBody('В семье и быту помогает один понятный разговор.') },
    friendship: { hook: 'Друзьям хватит точности', body: longBody('В дружеском контакте лучше написать коротко и по делу.') },
    energy: { hook: 'Сила держится на темпе', body: longBody('В нагрузке стоит смотреть не на героизм, а на устойчивый ритм.') },
    communication: { hook: 'Разговор веди короче', body: longBody('В общении работает прямота без давления.') },
    meta: { free_section_key: 'love' },
  };
}

describe('daily canvas generation repair prompt', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('passes first-attempt hard validation reasons into the corrective attempt', async () => {
    const llmJson = jest.fn()
      .mockResolvedValueOnce({ meta: { free_section_key: 'love' } })
      .mockResolvedValueOnce(validCanvas());

    jest.doMock('../lib/anthropic', () => ({ llmJson }));
    jest.doMock('../lib/appSettings', () => ({
      getDailyCanvasModelResolved: jest.fn().mockResolvedValue('daily-model-test'),
    }));
    jest.doMock('../lib/appVoice', () => ({
      APP_VOICE_BLOCK_RU: '',
      APP_SYSTEM_VOICE_RU: 'SYSTEM VOICE RU',
      APP_SYSTEM_VOICE_EN: 'SYSTEM VOICE EN',
      getAppSystemVoice: jest.fn().mockReturnValue('SYSTEM VOICE'),
    }));
    jest.doMock('../lib/transits-calculator', () => ({
      getCurrentTransits: jest.fn().mockResolvedValue(null),
    }));

    const { generateDailyCanvas } = await import('../lib/natalHumanInterpretation');
    await expect(generateDailyCanvas(
      {
        id: '123',
        name: 'Test',
        birthDate: '1990-01-01',
        birthTime: '12:00',
        birthPlace: 'Moscow',
        language: 'ru',
      } as any,
      {
        sun: { sign: 'Pisces', degree: 15 },
        moon: { sign: 'Cancer', degree: 10 },
        rising: { sign: 'Libra', degree: 7 },
      } as any,
      '2026-06-03',
    )).resolves.toMatchObject({ hero_title: validCanvas().hero_title });

    expect(llmJson).toHaveBeenCalledTimes(2);
    expect(llmJson.mock.calls[1][0].user).toContain('EMPTY_HERO_TITLE');
    expect(llmJson.mock.calls[1][0].user).toContain('EMPTY_TOPIC_BODY');
  });
});
