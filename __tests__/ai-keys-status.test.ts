import { getAiKeysStatus } from '../lib/aiKeysStatus';

const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as unknown as Response;

describe('AI keys status', () => {
  const env = { ...process.env };
  const realFetch = global.fetch;
  afterEach(() => {
    process.env = { ...env };
    global.fetch = realFetch;
  });

  it('reports missing keys without calling anyone', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.OPENAI_API_KEY;
    global.fetch = jest.fn();
    const status = await getAiKeysStatus({ fresh: true });
    expect(status.keys.map((k) => [k.provider, k.configured, k.ok])).toEqual([['anthropic', false, false], ['deepseek', false, false], ['openai', false, false]]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows the DeepSeek balance, flags a dropped model and a rejected key', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.DEEPSEEK_API_KEY = 'ds-test';
    process.env.OPENAI_API_KEY = 'sk-test';
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('anthropic')) return json(200, { data: [] });
      if (url.includes('/user/balance')) return json(200, { is_available: true, balance_infos: [{ total_balance: '4.19', currency: 'USD' }] });
      if (url.includes('deepseek') && url.endsWith('/models')) return json(200, { data: [{ id: 'deepseek-v4-pro' }] });
      return json(401, { error: { message: 'Incorrect API key provided: sk-proj-abcdef123456' } });
    }) as unknown as typeof fetch;
    const status = await getAiKeysStatus({ fresh: true });
    const by = Object.fromEntries(status.keys.map((k) => [k.provider, k]));
    expect(by.anthropic).toMatchObject({ ok: true });
    expect(by.deepseek).toMatchObject({ ok: false, balance: '4.19 USD', modelAvailable: false });
    expect(by.openai).toMatchObject({ ok: false, httpStatus: 401 });
    expect(by.openai.error).not.toContain('abcdef123456');
  });
});
