import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('compact content-matrix home', () => {
  it('does not require chart setup and only fetches personal home for chart plus premium', () => {
    const source = read('views/Dashboard.tsx');
    expect(source).toContain('hasNatalChart');
    expect(source).toContain('hasChart && premium');
    expect(source).not.toContain('profile.isSetup');
    expect(source).not.toContain('getPremiumNatalFullLayer');
    expect(source).not.toContain('loadHumanPaidSection');
  });

  it('uses content matrix policies and non-empty fallbacks', () => {
    const source = read('views/Dashboard.tsx');
    expect(source).toContain("getContentPolicy('day_card')");
    expect(source).toContain("getContentPolicy('sign_daily_horoscope')");
    expect(source).toContain("getContentPolicy('push_daily')");
    expect(source).toContain("getContentPolicy('action_timing')");
    expect(source).toContain("getContentPolicy('personal_daily')");
    expect(source).toContain('FALLBACKS.dayCard');
    expect(source).toContain('FALLBACKS.background');
  });

  it('shows the requested chartless, personal, and teaser blocks', () => {
    const source = read('views/Dashboard.tsx');
    for (const title of ['Что сегодня важно', 'Мягкий совет дня', 'Луна сегодня', 'Выбрать знак', 'Создать натальную карту', 'Сегодня для тебя', 'Что может задеть', 'Лучшее время для разговора', 'Деньги и решения', 'Что с тобой сегодня']) {
      expect(source).toContain(title);
    }
    expect(source).toContain('locked');
    expect(source).toContain('<Skeleton');
  });

  it('sends Telegram initData headers for every human POST', () => {
    const source = read('services/natalReadingService.ts');
    const postHuman = source.slice(source.indexOf('async function postHuman'), source.indexOf('async function getHuman'));
    expect(postHuman).toContain("headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() }");
    const astrology = read('services/astrologyService.ts');
    const todayHome = astrology.slice(astrology.indexOf('export const getTodayAssistantHome'), astrology.indexOf('export const submitTodayCheckIn'));
    expect(todayHome).toContain("headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() }");
  });
});
