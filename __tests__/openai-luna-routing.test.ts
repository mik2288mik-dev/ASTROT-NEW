jest.mock('../lib/db', () => ({
  db: {
    app_settings: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
}));

import {
  getOpenAIModelForContent,
  getUnifiedContentModel,
  OPENAI_LUNA_MODEL,
} from '../lib/appSettings';
import { normalizeInterpretationModelId } from '../lib/openai-models';
import { SIGN_HOROSCOPE_MODEL } from '../lib/horoscope/signContract';

describe('Luna content routing', () => {
  it('uses OpenAI Luna for every non-Zodiac content surface', async () => {
    await expect(getUnifiedContentModel()).resolves.toBe(OPENAI_LUNA_MODEL);
    await expect(getOpenAIModelForContent({
      accessTier: 'premium',
      contentSurface: 'forecast',
      contentVariant: 'weekly',
    })).resolves.toMatchObject({ model: OPENAI_LUNA_MODEL });
  });

  it('does not allow the removed universal DeepSeek model setting', () => {
    expect(normalizeInterpretationModelId('deepseek-v4-flash')).toBeNull();
    expect(normalizeInterpretationModelId(OPENAI_LUNA_MODEL)).toBe(OPENAI_LUNA_MODEL);
  });

  it('keeps sign horoscopes on their dedicated DeepSeek route', () => {
    expect(SIGN_HOROSCOPE_MODEL).toMatch(/^deepseek-/);
  });
});
