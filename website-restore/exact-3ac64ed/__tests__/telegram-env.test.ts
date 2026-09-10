import { getTelegramBotToken, getTelegramBotTokenEnvKey, hasTelegramBotToken } from '../lib/telegramEnv';

const KEYS = ['BOT_TOKEN', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_API_TOKEN', 'TELEGRAM_TOKEN'];

describe('telegram env resolver', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    for (const key of KEYS) delete process.env[key];
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses canonical BOT_TOKEN first', () => {
    process.env.BOT_TOKEN = ' canonical-token ';
    process.env.TELEGRAM_BOT_TOKEN = 'alias-token';

    expect(getTelegramBotToken()).toBe('canonical-token');
    expect(getTelegramBotTokenEnvKey()).toBe('BOT_TOKEN');
    expect(hasTelegramBotToken()).toBe(true);
  });

  it('accepts Telegram token aliases used by hosting dashboards', () => {
    process.env.TELEGRAM_BOT_TOKEN = ' alias-token ';

    expect(getTelegramBotToken()).toBe('alias-token');
    expect(getTelegramBotTokenEnvKey()).toBe('TELEGRAM_BOT_TOKEN');
    expect(hasTelegramBotToken()).toBe(true);
  });

  it('reports missing token when no supported variable is set', () => {
    expect(getTelegramBotToken()).toBe('');
    expect(getTelegramBotTokenEnvKey()).toBeNull();
    expect(hasTelegramBotToken()).toBe(false);
  });
});
