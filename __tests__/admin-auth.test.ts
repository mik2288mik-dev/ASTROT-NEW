import crypto from 'crypto';

const BOT_TOKEN = 'test-bot-token';

function buildInitData(userId: string, authDateSeconds = Math.floor(Date.now() / 1000)) {
  const params = new URLSearchParams({
    auth_date: String(authDateSeconds),
    query_id: 'test-query',
    user: JSON.stringify({ id: Number(userId), first_name: 'Test' }),
  });
  const dataCheckString = Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

describe('adminAuth Telegram initData validation', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.BOT_TOKEN = BOT_TOKEN;
    delete process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS;
  });

  it('accepts signed initData when Telegram user id matches', async () => {
    const { requireTelegramUserId } = await import('../lib/adminAuth');
    const user = requireTelegramUserId({
      headers: { 'x-telegram-init-data': buildInitData('123') },
    } as any, '123');

    expect(user.id).toBe('123');
  });

  it('rejects signed initData for a different user id', async () => {
    const { requireTelegramUserId } = await import('../lib/adminAuth');
    let thrown: any;

    try {
      requireTelegramUserId({
        headers: { 'x-telegram-init-data': buildInitData('123') },
      } as any, '999');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      status: 403,
      code: 'USER_ID_MISMATCH',
    });
  });

  it('rejects expired initData', async () => {
    process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS = '10';
    const { requireTelegramUserId } = await import('../lib/adminAuth');
    const expiredAuthDate = Math.floor(Date.now() / 1000) - 60;
    let thrown: any;

    try {
      requireTelegramUserId({
        headers: { 'x-telegram-init-data': buildInitData('123', expiredAuthDate) },
      } as any, '123');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      status: 401,
      code: 'INIT_DATA_EXPIRED',
    });
  });
});
