type StoredContentRow = {
  id: number;
  user_id: string | null;
  chart_id: number | null;
  access_tier: string;
  content_surface: string;
  content_variant: string;
  model_tier: string;
  cache_key: string;
  input_hash: string | null;
  content: unknown;
  prompt_version: string | null;
  calculation_version: string | null;
  valid_from: string | Date | null;
  valid_to: string | Date | null;
  is_persistent: boolean;
  legacy_source: string | null;
  created_at: Date;
  updated_at: Date;
};

export {};

function assertPlaceholderContract(sql: string, params: unknown[] = []) {
  const refs = Array.from(sql.matchAll(/\$(\d+)/g)).map((match) => Number(match[1]));
  if (!refs.length) return;
  const unique = Array.from(new Set(refs)).sort((a, b) => a - b);
  const max = unique[unique.length - 1];
  expect(max).toBe(params.length);
  expect(unique).toEqual(Array.from({ length: max }, (_unused, index) => index + 1));
}

function makeKey(parts: Array<string | number | null>) {
  return parts.map((part) => String(part ?? 'null')).join('|');
}

function setEnv(name: string, value: string | undefined) {
  if (value == null) {
    Reflect.deleteProperty(process.env, name);
    return;
  }
  Object.assign(process.env, { [name]: value });
}

function makePool() {
  let nextId = 1;
  const rows = new Map<string, StoredContentRow>();
  const calls: Array<{ sql: string; params: unknown[] }> = [];

  const chartKey = (chartId: number, accessTier: string, surface: string, variant: string, cacheKey: string) =>
    makeKey(['chart', chartId, accessTier, surface, variant, cacheKey]);
  const userKey = (userId: string, accessTier: string, surface: string, variant: string, cacheKey: string) =>
    makeKey(['user', userId, accessTier, surface, variant, cacheKey]);

  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    assertPlaceholderContract(sql, params);

    if (/UPDATE content_interpretations/i.test(sql) && /WHERE chart_id = \$1/i.test(sql)) {
      const [
        chartId,
        accessTier,
        surface,
        variant,
        cacheKey,
        inputHash,
        contentJson,
        modelTier,
        ownerId,
        promptVersion,
        calculationVersion,
        validFrom,
        validTo,
        isPersistent,
        legacySource,
      ] = params;
      const key = chartKey(Number(chartId), String(accessTier), String(surface), String(variant), String(cacheKey));
      const existing = rows.get(key);
      if (!existing) return { rowCount: 0, rows: [] };
      rows.set(key, {
        ...existing,
        user_id: existing.user_id ?? (ownerId == null ? null : String(ownerId)),
        input_hash: inputHash == null ? null : String(inputHash),
        content: JSON.parse(String(contentJson)),
        model_tier: String(modelTier),
        prompt_version: promptVersion == null ? null : String(promptVersion),
        calculation_version: calculationVersion == null ? null : String(calculationVersion),
        valid_from: validFrom as string | Date | null,
        valid_to: validTo as string | Date | null,
        is_persistent: Boolean(isPersistent),
        legacy_source: legacySource == null ? null : String(legacySource),
        updated_at: new Date('2026-07-12T02:00:00.000Z'),
      });
      return { rowCount: 1, rows: [] };
    }

    if (/INSERT INTO content_interpretations/i.test(sql) && /\(user_id, chart_id,/i.test(sql)) {
      const [
        ownerId,
        chartId,
        accessTier,
        surface,
        variant,
        modelTier,
        cacheKey,
        inputHash,
        contentJson,
        promptVersion,
        calculationVersion,
        validFrom,
        validTo,
        isPersistent,
        legacySource,
      ] = params;
      rows.set(chartKey(Number(chartId), String(accessTier), String(surface), String(variant), String(cacheKey)), {
        id: nextId++,
        user_id: ownerId == null ? null : String(ownerId),
        chart_id: Number(chartId),
        access_tier: String(accessTier),
        content_surface: String(surface),
        content_variant: String(variant),
        model_tier: String(modelTier),
        cache_key: String(cacheKey),
        input_hash: inputHash == null ? null : String(inputHash),
        content: JSON.parse(String(contentJson)),
        prompt_version: promptVersion == null ? null : String(promptVersion),
        calculation_version: calculationVersion == null ? null : String(calculationVersion),
        valid_from: validFrom as string | Date | null,
        valid_to: validTo as string | Date | null,
        is_persistent: Boolean(isPersistent),
        legacy_source: legacySource == null ? null : String(legacySource),
        created_at: new Date('2026-07-12T01:00:00.000Z'),
        updated_at: new Date('2026-07-12T01:00:00.000Z'),
      });
      return { rowCount: 1, rows: [] };
    }

    if (/UPDATE content_interpretations/i.test(sql) && /WHERE user_id = \$1/i.test(sql)) {
      const [
        userId,
        accessTier,
        surface,
        variant,
        cacheKey,
        inputHash,
        contentJson,
        modelTier,
        promptVersion,
        calculationVersion,
        validFrom,
        validTo,
        isPersistent,
        legacySource,
      ] = params;
      const key = userKey(String(userId), String(accessTier), String(surface), String(variant), String(cacheKey));
      const existing = rows.get(key);
      if (!existing) return { rowCount: 0, rows: [] };
      rows.set(key, {
        ...existing,
        input_hash: inputHash == null ? null : String(inputHash),
        content: JSON.parse(String(contentJson)),
        model_tier: String(modelTier),
        prompt_version: promptVersion == null ? null : String(promptVersion),
        calculation_version: calculationVersion == null ? null : String(calculationVersion),
        valid_from: validFrom as string | Date | null,
        valid_to: validTo as string | Date | null,
        is_persistent: Boolean(isPersistent),
        legacy_source: legacySource == null ? null : String(legacySource),
        updated_at: new Date('2026-07-12T02:00:00.000Z'),
      });
      return { rowCount: 1, rows: [] };
    }

    if (/INSERT INTO content_interpretations/i.test(sql) && /\(user_id, access_tier,/i.test(sql)) {
      const [
        userId,
        accessTier,
        surface,
        variant,
        modelTier,
        cacheKey,
        inputHash,
        contentJson,
        promptVersion,
        calculationVersion,
        validFrom,
        validTo,
        isPersistent,
        legacySource,
      ] = params;
      rows.set(userKey(String(userId), String(accessTier), String(surface), String(variant), String(cacheKey)), {
        id: nextId++,
        user_id: String(userId),
        chart_id: null,
        access_tier: String(accessTier),
        content_surface: String(surface),
        content_variant: String(variant),
        model_tier: String(modelTier),
        cache_key: String(cacheKey),
        input_hash: inputHash == null ? null : String(inputHash),
        content: JSON.parse(String(contentJson)),
        prompt_version: promptVersion == null ? null : String(promptVersion),
        calculation_version: calculationVersion == null ? null : String(calculationVersion),
        valid_from: validFrom as string | Date | null,
        valid_to: validTo as string | Date | null,
        is_persistent: Boolean(isPersistent),
        legacy_source: legacySource == null ? null : String(legacySource),
        created_at: new Date('2026-07-12T01:00:00.000Z'),
        updated_at: new Date('2026-07-12T01:00:00.000Z'),
      });
      return { rowCount: 1, rows: [] };
    }

    if (/FROM content_interpretations/i.test(sql) && /WHERE chart_id = \$1/i.test(sql)) {
      const [chartId, accessTier, surface, variant, cacheKey] = params;
      const row = rows.get(chartKey(Number(chartId), String(accessTier), String(surface), String(variant), String(cacheKey)));
      return { rowCount: row ? 1 : 0, rows: row ? [row] : [] };
    }

    if (/FROM content_interpretations/i.test(sql) && /WHERE user_id = \$1/i.test(sql)) {
      const [userId, accessTier, surface, variant, cacheKey] = params;
      const row = rows.get(userKey(String(userId), String(accessTier), String(surface), String(variant), String(cacheKey)));
      return { rowCount: row ? 1 : 0, rows: row ? [row] : [] };
    }

    throw new Error(`Unexpected SQL in content_interpretations contract test: ${sql}`);
  });

  return { query, on: jest.fn(), calls };
}

async function loadDbWithPool(pool: ReturnType<typeof makePool>) {
  jest.resetModules();
  process.env.DATABASE_URL = 'postgresql://postgres:secret@localhost:5432/railway';
  setEnv('NODE_ENV', 'test');
  jest.doMock('pg', () => ({
    Pool: jest.fn(() => pool),
    Client: jest.fn(),
  }));
  return import('../lib/db');
}

describe('content_interpretations SQL contract', () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    jest.resetModules();
    jest.dontMock('pg');
    if (previousDatabaseUrl == null) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    setEnv('NODE_ENV', previousNodeEnv);
  });

  it.each([
    {
      label: 'human_v2.base',
      contentVariant: 'anchor' as const,
      cacheKey: 'human_v2.base',
      content: { userName: 'Lina', freeSections: [] },
    },
    {
      label: 'personal_daily.package',
      contentVariant: 'living' as const,
      cacheKey: 'personal_daily.package.user.123.date.2026-07-12.locale.ru.voice.test',
      content: {
        hero_title: 'Daily hero',
        hero_hook: 'Daily hook',
        overview: 'Daily overview',
        meta: { free_section_key: 'love' },
      },
    },
  ])('creates, updates and reads chart-scoped $label content with aligned placeholders', async ({ contentVariant, cacheKey, content }) => {
    const pool = makePool();
    const { db } = await loadDbWithPool(pool);
    const validFrom = new Date('2026-07-12T00:00:00.000Z');
    const validTo = new Date('2026-07-13T00:00:00.000Z');

    const created = await db.content_interpretations.upsertByChart(7, {
      accessTier: 'premium',
      contentSurface: 'natal',
      contentVariant,
      cacheKey,
      inputHash: 'input-v1',
      content,
      modelTier: 'premium',
      promptVersion: 'prompt-v1',
      calculationVersion: 'calc-v1',
      validFrom,
      validTo,
      isPersistent: true,
      legacySource: 'legacy-v1',
    }, '123');

    expect(created).toMatchObject({
      userId: '123',
      chartId: 7,
      cacheKey,
      inputHash: 'input-v1',
      content,
      promptVersion: 'prompt-v1',
      calculationVersion: 'calc-v1',
      isPersistent: true,
      legacySource: 'legacy-v1',
    });
    expect(created?.validFrom).toBe(validFrom.toISOString());
    expect(created?.validTo).toBe(validTo.toISOString());

    const updatedContent = { ...content, updated: true };
    const updated = await db.content_interpretations.upsertByChart(7, {
      accessTier: 'premium',
      contentSurface: 'natal',
      contentVariant,
      cacheKey,
      inputHash: 'input-v2',
      content: updatedContent,
      modelTier: 'base',
      promptVersion: 'prompt-v2',
      calculationVersion: 'calc-v2',
      validFrom: null,
      validTo: null,
      isPersistent: false,
      legacySource: null,
    }, '456');

    expect(updated).toMatchObject({
      userId: '123',
      chartId: 7,
      cacheKey,
      inputHash: 'input-v2',
      content: updatedContent,
      modelTier: 'base',
      promptVersion: 'prompt-v2',
      calculationVersion: 'calc-v2',
      validFrom: null,
      validTo: null,
      isPersistent: false,
      legacySource: null,
    });

    const cached = await db.content_interpretations.getByChart(7, 'premium', 'natal', contentVariant, cacheKey);
    expect(cached?.content).toEqual(updatedContent);

    const updateCalls = pool.calls.filter((call) => /UPDATE content_interpretations/i.test(call.sql));
    expect(updateCalls).toHaveLength(2);
    for (const call of updateCalls) {
      expect(call.sql).toContain('user_id = COALESCE(user_id, $9)');
      expect(call.sql).not.toContain('$16');
      expect(call.params).toHaveLength(15);
      expect(call.params[8]).toBeDefined();
    }
  });

  it('allows chart-scoped ownerId null without breaking the UPDATE or read path', async () => {
    const pool = makePool();
    const { db } = await loadDbWithPool(pool);

    const saved = await db.content_interpretations.upsertByChart(8, {
      accessTier: 'premium',
      contentSurface: 'natal',
      contentVariant: 'living',
      cacheKey: 'personal_daily.package.user.anon.date.2026-07-12.locale.ru.voice.test',
      inputHash: 'daily-hash',
      content: { hero_title: 'No owner', meta: { free_section_key: 'love' } },
      modelTier: 'premium',
      promptVersion: 'daily-prompt',
      calculationVersion: 'calc',
      validFrom: '2026-07-12T00:00:00.000Z',
      validTo: '2026-07-13T00:00:00.000Z',
      isPersistent: false,
      legacySource: null,
    }, null);

    expect(saved).toMatchObject({
      userId: null,
      chartId: 8,
      promptVersion: 'daily-prompt',
      calculationVersion: 'calc',
      isPersistent: false,
    });
  });

  it('keeps user-scoped upsert placeholders aligned too', async () => {
    const pool = makePool();
    const { db } = await loadDbWithPool(pool);

    const created = await db.content_interpretations.upsertByUser('123', {
      accessTier: 'free',
      contentSurface: 'forecast',
      contentVariant: 'daily',
      cacheKey: '2026-07-12',
      inputHash: 'forecast-hash',
      content: { title: 'Forecast' },
      modelTier: 'base',
      promptVersion: 'forecast-prompt',
      calculationVersion: 'forecast-calc',
      validFrom: '2026-07-12T00:00:00.000Z',
      validTo: '2026-07-13T00:00:00.000Z',
      isPersistent: true,
      legacySource: 'legacy-forecast',
    });

    expect(created).toMatchObject({
      userId: '123',
      chartId: null,
      content: { title: 'Forecast' },
      promptVersion: 'forecast-prompt',
      calculationVersion: 'forecast-calc',
      isPersistent: true,
      legacySource: 'legacy-forecast',
    });

    const updateCall = pool.calls.find((call) => /UPDATE content_interpretations/i.test(call.sql));
    const insertCall = pool.calls.find((call) => /INSERT INTO content_interpretations/i.test(call.sql));
    expect(updateCall?.params).toHaveLength(14);
    expect(insertCall?.params).toHaveLength(14);
    expect(updateCall?.sql).not.toContain('$15');
  });
});
