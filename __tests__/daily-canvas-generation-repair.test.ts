import { makeDailyCanvasFixture } from './dailyCanvasFixture';

export {};

function validCanvas() {
  return makeDailyCanvasFixture();
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
    expect(llmJson.mock.calls[0][0].system).toContain('В итоговом пользовательском JSON нельзя называть планеты');
    expect(llmJson.mock.calls[0][0].system).toContain('Обычные слова «дом», «дома», «домашний», «квартира» разрешены');
    expect(llmJson.mock.calls[0][0].user).toContain('hero_hook должен быть содержательной выжимкой');
    expect(llmJson.mock.calls[0][0].user).toContain('не спеши, не распыляйся, выбери одно дело');
    expect(llmJson.mock.calls[0][0].user).toContain('Не размазывай один совет про шаг, ясность, конкретность или одно сообщение');
    expect(llmJson.mock.calls[1][0].user).toContain('EMPTY_HERO_TITLE');
    expect(llmJson.mock.calls[1][0].user).toContain('EMPTY_TOPIC_BODY');
  });
});
