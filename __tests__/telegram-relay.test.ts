import { useTelegramRelay } from '../lib/telegramRelay';

describe('Telegram relay selection', () => {
  it('uses Railway only for the Timeweb runtime with an explicit relay URL', () => {
    expect(useTelegramRelay({
      OPENAI_API_KEY: 'test-key',
      OPENAI_RELAY_DIRECT: '0',
      NEBO_TELEGRAM_RELAY_URL: 'https://relay.example.test/api/internal/telegram',
    })).toBe(true);
  });

  it('keeps Railway direct and never routes it back to itself', () => {
    expect(useTelegramRelay({
      OPENAI_API_KEY: 'test-key',
      OPENAI_RELAY_DIRECT: '1',
      NEBO_TELEGRAM_RELAY_URL: 'https://relay.example.test/api/internal/telegram',
    })).toBe(false);
  });

  it('does not enable a relay without both its URL and shared server key', () => {
    expect(useTelegramRelay({ OPENAI_RELAY_DIRECT: '0' })).toBe(false);
  });
});
