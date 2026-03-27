import { db } from './db';
import {
  getInterpretationModelFromEnv,
  INTERPRETATION_MODEL_SETTING_KEY,
  normalizeInterpretationModelId,
} from './openai-models';

let cachedInterpretationModel: string | null = null;
let cacheLoaded = false;

export async function getOpenAIInterpretationModel(): Promise<string> {
  if (cacheLoaded && cachedInterpretationModel) {
    return cachedInterpretationModel;
  }

  try {
    const row = await db.app_settings.get(INTERPRETATION_MODEL_SETTING_KEY);
    const fromDb = normalizeInterpretationModelId(row?.value);
    if (fromDb) {
      cachedInterpretationModel = fromDb;
      cacheLoaded = true;
      return fromDb;
    }
  } catch {
    // DB unavailable — fall through to env
  }

  const fallback = getInterpretationModelFromEnv();
  cachedInterpretationModel = fallback;
  cacheLoaded = true;
  return fallback;
}

export function invalidateInterpretationModelCache(): void {
  cachedInterpretationModel = null;
  cacheLoaded = false;
}
