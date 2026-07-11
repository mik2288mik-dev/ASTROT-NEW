-- =============================================================================
-- Multi-Chart Support Migration
-- =============================================================================
-- Run after the initial full-schema migration.
-- Enables multiple natal charts per user, chart-level AI cache, synastry cache.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. USERS: add chart_slots
-- -----------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS chart_slots INTEGER DEFAULT 1;

-- -----------------------------------------------------------------------------
-- 2. NATAL_CHARTS: multi-chart support
-- -----------------------------------------------------------------------------
-- Drop UNIQUE constraint on user_id (allow multiple charts per user)
ALTER TABLE natal_charts DROP CONSTRAINT IF EXISTS natal_charts_user_id_key;

-- Add new columns (is_primary may already exist from the initial schema)
ALTER TABLE natal_charts ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE natal_charts ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT TRUE;

-- Backfill: existing single chart gets name and is_primary
UPDATE natal_charts SET name = COALESCE(name, 'Моя карта'), is_primary = TRUE WHERE is_primary IS NULL OR is_primary = FALSE;

-- Make name NOT NULL after backfill (for new rows)
ALTER TABLE natal_charts ALTER COLUMN name SET DEFAULT 'Моя карта';

-- UNIQUE: one chart per (user_id, input_hash) - prevents duplicate birth data
-- Drop if exists from previous run
DROP INDEX IF EXISTS idx_natal_charts_user_input_hash;
CREATE UNIQUE INDEX idx_natal_charts_user_input_hash ON natal_charts(user_id, input_hash) WHERE input_hash IS NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_natal_charts_user ON natal_charts(user_id);
CREATE INDEX IF NOT EXISTS idx_natal_charts_user_primary ON natal_charts(user_id) WHERE is_primary = TRUE;
CREATE INDEX IF NOT EXISTS idx_natal_charts_input_hash ON natal_charts(input_hash) WHERE input_hash IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. INTERPRETATIONS: add chart_id, migrate to chart-level cache
-- -----------------------------------------------------------------------------
-- Add chart_id (nullable during migration)
ALTER TABLE interpretations ADD COLUMN IF NOT EXISTS chart_id BIGINT REFERENCES natal_charts(id) ON DELETE CASCADE;

-- Migrate: link existing interpretations to primary chart of user
UPDATE interpretations i
SET chart_id = (
  SELECT nc.id FROM natal_charts nc
  WHERE nc.user_id = i.user_id AND (nc.is_primary = TRUE OR nc.id = (SELECT MIN(id) FROM natal_charts WHERE user_id = i.user_id))
  LIMIT 1
)
WHERE i.chart_id IS NULL AND i.user_id IS NOT NULL;

-- Drop old unique index
DROP INDEX IF EXISTS idx_interpretations_lookup;

-- Create new unique indexes (chart-level and user-level)
-- Chart-level: for natal_*, daily_natal_card, deep_dive_*
CREATE UNIQUE INDEX idx_interpretations_chart_lookup
  ON interpretations(chart_id, type, input_hash)
  WHERE chart_id IS NOT NULL;

-- User-level rows are not part of the current MVP content matrix.
CREATE UNIQUE INDEX idx_interpretations_user_lookup
  ON interpretations(user_id, type, input_hash)
  WHERE user_id IS NOT NULL AND chart_id IS NULL;

-- Chart-level: (chart_id, type, input_hash). User-level content should use explicit user-scoped cache keys.
-- Keep user_id for chart-level rows (owner audit). Lookup uses chart_id for chart-level.

-- Add CHECK: at least one of chart_id or user_id must be set
ALTER TABLE interpretations DROP CONSTRAINT IF EXISTS interpretations_chart_or_user;
ALTER TABLE interpretations ADD CONSTRAINT interpretations_chart_or_user CHECK (
  (chart_id IS NOT NULL) OR (user_id IS NOT NULL)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_interpretations_chart ON interpretations(chart_id) WHERE chart_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interpretations_user ON interpretations(user_id) WHERE user_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. DAILY_NATAL_CARDS: migrate user_id -> chart_id
-- -----------------------------------------------------------------------------
ALTER TABLE daily_natal_cards ADD COLUMN IF NOT EXISTS chart_id BIGINT REFERENCES natal_charts(id) ON DELETE CASCADE;

-- Migrate: link to primary chart
UPDATE daily_natal_cards dnc
SET chart_id = (
  SELECT nc.id FROM natal_charts nc
  WHERE nc.user_id = dnc.user_id AND (nc.is_primary = TRUE OR nc.id = (SELECT MIN(id) FROM natal_charts WHERE user_id = dnc.user_id))
  LIMIT 1
)
WHERE dnc.chart_id IS NULL AND dnc.user_id IS NOT NULL;

-- Delete orphaned rows (user had daily but no natal_chart)
DELETE FROM daily_natal_cards WHERE chart_id IS NULL;

-- Drop old unique constraint (PostgreSQL default name)
ALTER TABLE daily_natal_cards DROP CONSTRAINT IF EXISTS daily_natal_cards_user_id_date_key;

-- Add new unique constraint
DROP INDEX IF EXISTS idx_daily_natal_cards_chart_date;
CREATE UNIQUE INDEX idx_daily_natal_cards_chart_date ON daily_natal_cards(chart_id, date) WHERE chart_id IS NOT NULL;

-- Keep user_id for backward compat during API transition. New code uses chart_id.

-- -----------------------------------------------------------------------------
-- 5. SYNASTRY_CACHE: new table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS synastry_cache (
  id BIGSERIAL PRIMARY KEY,
  chart1_id BIGINT NOT NULL REFERENCES natal_charts(id) ON DELETE CASCADE,
  chart2_id BIGINT NOT NULL REFERENCES natal_charts(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT synastry_chart_order CHECK (chart1_id < chart2_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_synastry_cache_lookup
  ON synastry_cache(chart1_id, chart2_id, mode, input_hash);

CREATE INDEX IF NOT EXISTS idx_synastry_cache_chart1 ON synastry_cache(chart1_id);
CREATE INDEX IF NOT EXISTS idx_synastry_cache_chart2 ON synastry_cache(chart2_id);

-- -----------------------------------------------------------------------------
-- 6. Mark migration
-- -----------------------------------------------------------------------------
INSERT INTO migrations (name) VALUES ('lumia_002_multi_chart') ON CONFLICT (name) DO NOTHING;

COMMIT;
