import { weeklyDiarySummary } from '../lib/antistressDiary';


describe('weekly tension diary reading', () => {
  it('waits for two marks', () => {
    expect(weeklyDiarySummary([{ day: '2026-10-07', level: 3, causes: [] }])[0]).toContain('две отметки');
  });

  it('gives the average, the hardest and the calmest day', () => {
    const lines = weeklyDiarySummary([
      { day: '2026-10-05', level: 2, causes: [] },
      { day: '2026-10-06', level: 5, causes: ['Работа'] },
      { day: '2026-10-07', level: 3, causes: ['Работа'] },
    ]);
    expect(lines[0]).toBe('В среднем 3,3 из 5 по 3 отметкам.');
    expect(lines[1]).toContain('Тяжелее всего было во вторник (5)');
    expect(lines[1]).toContain('спокойнее всего в понедельник (2)');
  });

  it('links a frequent trigger to higher tension and warns when it is high', () => {
    const lines = weeklyDiarySummary([
      { day: '2026-10-03', level: 2, causes: [] },
      { day: '2026-10-04', level: 5, causes: ['Работа'] },
      { day: '2026-10-05', level: 5, causes: ['Работа'] },
      { day: '2026-10-06', level: 4, causes: ['Работа'] },
    ]);
    expect(lines.join(' ')).toContain('Когда выбивало «работа», напряжение выше');
    expect(lines.join(' ')).toContain('начни с двухминутного дыхания');
  });
});
