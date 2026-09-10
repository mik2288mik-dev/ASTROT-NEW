import type { Pool, PoolClient } from 'pg';
import { getPool } from './db';
import { isCanonicalNatalChartDataComplete, normalizeBirthDateInput, normalizeBirthPlaceInput } from './natalChartCanonical';
import type { BirthTimeInput } from './birthTime';

function parseJson(value: any): any {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
}

function mapRow(row: any) {
  if (!row) return null;
  const data = parseJson(row.chart_data);
  return { ...row, user_id: String(row.user_id), chart_data: data,
    sun: data?.sun || null, moon: data?.moon || null, ascendant: data?.rising || null,
    houses: data?.houses || [], aspects: data?.aspects || [],
    sun_sign: data?.sun?.sign || null, moon_sign: data?.moon?.sign || null,
    ascendant_sign: data?.rising?.sign || null,
    calculation_version: data?.calculationVersion || row.calculation_version || null };
}

function payload(data: any) {
  const chart = data.chartData?.chart_data || data.chartData;
  if (!isCanonicalNatalChartDataComplete(chart) || !data.inputHash) throw new Error('Canonical natal chart data is incomplete.');
  return { name: String(data.name || 'Моя карта').trim(), chart,
    inputHash: data.inputHash, birthDate: normalizeBirthDateInput(data.birthDate),
    birthTime: data.birthTime || null, birthTimeMode: data.birthTimeMode || chart.birth.time.mode,
    uncertainty: data.birthTimeUncertaintyMinutes ?? chart.birth.time.uncertaintyMinutes ?? null,
    rangeStart: data.birthTimeRangeStart || chart.birth.time.rangeStart || null,
    rangeEnd: data.birthTimeRangeEnd || chart.birth.time.rangeEnd || null,
    birthPlace: normalizeBirthPlaceInput(data.birthPlace), relationLabel: data.relationLabel ?? null };
}

function repository(connection: Pool | PoolClient) {
  async function getById(chartId: number) {
    const result = await connection.query('SELECT * FROM natal_charts WHERE id=$1 AND archived_at IS NULL', [chartId]);
    return mapRow(result.rows[0]);
  }
  async function snapshot(chart: any) {
    if (!chart?.input_hash || !isCanonicalNatalChartDataComplete(chart.chart_data)) return;
    await connection.query(`INSERT INTO natal_chart_revisions(chart_id,input_hash,chart_data,calculated_at,calculation_hash)
      VALUES($1,$2,$3,$4,md5($3::jsonb::text)) ON CONFLICT(chart_id,input_hash,calculation_hash) DO NOTHING`,
    [chart.id, chart.input_hash, JSON.stringify(chart.chart_data), chart.chart_data.calculationMetadata.calculatedAt || null]);
  }
  async function save(userId: string, data: any, subjectType: 'self' | 'saved_person', existing: any) {
    const p = payload(data);
    if (existing) await snapshot(existing);
    const values = [p.name, JSON.stringify(p.chart), p.chart.latitude, p.chart.longitude, p.chart.timezone,
      p.inputHash, p.chart.calculationVersion, p.birthDate, p.birthTime, p.birthTimeMode,
      p.uncertainty, p.rangeStart, p.rangeEnd, p.birthPlace];
    const result = existing
      ? await connection.query(`UPDATE natal_charts SET name=$1,chart_data=$2,latitude=$3,longitude=$4,timezone=$5,
          input_hash=$6,calculation_version=$7,birth_date=$8,birth_time=$9,birth_time_mode=$10,
          birth_time_uncertainty_minutes=$11,birth_time_range_start=$12,birth_time_range_end=$13,birth_place=$14,
          sun=NULL,moon=NULL,ascendant=NULL,mercury=NULL,venus=NULL,mars=NULL,jupiter=NULL,saturn=NULL,
          houses=NULL,aspects=NULL,sun_sign=NULL,moon_sign=NULL,ascendant_sign=NULL,relation_label=$17,updated_at=CURRENT_TIMESTAMP
          WHERE id=$15 AND user_id=$16 AND archived_at IS NULL RETURNING *`, [...values, existing.id, userId, subjectType === 'self' ? null : p.relationLabel])
      : await connection.query(`INSERT INTO natal_charts(user_id,name,chart_data,latitude,longitude,timezone,
          input_hash,calculation_version,birth_date,birth_time,birth_time_mode,birth_time_uncertainty_minutes,
          birth_time_range_start,birth_time_range_end,birth_place,is_primary,subject_type,relation_label)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
        [userId, ...values, subjectType === 'self', subjectType, p.relationLabel]);
    const saved = mapRow(result.rows[0]);
    if (!saved) throw new Error('CHART_NOT_FOUND');
    await snapshot(saved);
    return saved;
  }
  return {
    getById,
    async getBirthProfile(userId: string) {
      const result = await connection.query('SELECT * FROM users WHERE id=$1', [userId]);
      return result.rows[0];
    },
    async isPremium(userId: string) {
      const result = await connection.query(`SELECT u.is_guest,u.is_admin,u.premium_until>CURRENT_TIMESTAMP AS premium,
        EXISTS(SELECT 1 FROM premium_entitlements pe WHERE pe.user_id=u.id
          AND pe.status IN ('active','cancelled') AND pe.ends_at>CURRENT_TIMESTAMP
          AND pe.entitlement_state IN ('gift','store_trial','paid','grace','cancelled_active')) AS entitlement
        FROM users u WHERE u.id=$1`, [userId]);
      const user = result.rows[0];
      if (!user || (userId.startsWith('-') && user.is_guest !== false)) return false;
      const ownerId = process.env.OWNER_ID || (process.env.NODE_ENV !== 'production' ? process.env.NEXT_PUBLIC_OWNER_ID : '');
      return userId === ownerId || user.is_admin === true || user.premium === true || user.entitlement === true;
    },
    async getPrimary(userId: string) {
      const result = await connection.query(`SELECT * FROM natal_charts WHERE user_id=$1 AND subject_type='self'
        AND archived_at IS NULL ORDER BY is_primary DESC,id ASC LIMIT 1`, [userId]);
      return mapRow(result.rows[0]);
    },
    async getAll(userId: string) {
      const result = await connection.query(`SELECT * FROM natal_charts WHERE user_id=$1 AND archived_at IS NULL
        ORDER BY is_primary DESC,created_at ASC,id ASC`, [userId]);
      return result.rows.map(mapRow);
    },
    async findByInputHash(userId: string, inputHash: string, identity?: { subjectType?: 'self' | 'saved_person'; name?: string }) {
      const result = await connection.query(`SELECT * FROM natal_charts WHERE user_id=$1 AND input_hash=$2
        AND archived_at IS NULL AND ($3::text IS NULL OR subject_type=$3)
        AND ($4::text IS NULL OR LOWER(REGEXP_REPLACE(BTRIM(name),'[[:space:]]+',' ','g'))=$4)
        ORDER BY is_primary DESC,id ASC LIMIT 1`,
      [userId, inputHash, identity?.subjectType || null, identity?.name?.trim().replace(/\s+/g, ' ').toLowerCase() ?? null]);
      return mapRow(result.rows[0]);
    },
    async getCalculations(userId: string) {
      // Reverting birth data or restoring an archived person reuses their calculation.
      const result = await connection.query(`SELECT r.input_hash,r.chart_data FROM natal_chart_revisions r
        JOIN natal_charts c ON c.id=r.chart_id WHERE c.user_id=$1 ORDER BY r.id DESC`, [userId]);
      return result.rows.map((row) => ({ ...row, chart_data: parseJson(row.chart_data) }));
    },
    async updateName(chartId: number, name: string) {
      const result = await connection.query('UPDATE natal_charts SET name=$2 WHERE id=$1 RETURNING *', [chartId, name]);
      return mapRow(result.rows[0]);
    },
    async setIdentityMetadata(chartId: number, subjectType: 'self' | 'saved_person', relationLabel: string | null) {
      const result = await connection.query(`UPDATE natal_charts SET relation_label=$3
        WHERE id=$1 AND subject_type=$2 AND archived_at IS NULL RETURNING *`, [chartId, subjectType, subjectType === 'self' ? null : relationLabel]);
      if (!result.rows[0]) throw new Error('Chart subject identity is immutable');
      return mapRow(result.rows[0]);
    },
    async syncPrimaryProfile(userId: string, data: { name: string; birthDate: string; birthPlace: string; time: BirthTimeInput }) {
      await connection.query(`UPDATE users SET name=$2,birth_date=$3,birth_place=$4,birth_time=$5,birth_time_mode=$6,
        birth_time_uncertainty_minutes=$7,birth_time_range_start=$8,birth_time_range_end=$9,updated_at=CURRENT_TIMESTAMP
        WHERE id=$1`, [userId, data.name, data.birthDate, data.birthPlace, data.time.localTime, data.time.mode,
        data.time.uncertaintyMinutes, data.time.rangeStart, data.time.rangeEnd]);
    },
    async persistPrimary(userId: string, data: any) {
      const result = await connection.query(`SELECT * FROM natal_charts WHERE user_id=$1 AND subject_type='self'
        AND archived_at IS NULL ORDER BY is_primary DESC,id ASC LIMIT 1`, [userId]);
      return save(userId, data, 'self', mapRow(result.rows[0]));
    },
    async create(userId: string, data: any) { return save(userId, data, 'saved_person', null); },
    async repairSaved(userId: string, chartId: number, data: any) {
      const existing = await getById(chartId);
      if (!existing || existing.user_id !== userId || existing.subject_type !== 'saved_person') throw new Error('CHART_NOT_FOUND');
      return save(userId, data, 'saved_person', existing);
    },
  };
}

export type LockedNatalChartRepository = ReturnType<typeof repository>;
export const natalChartV2Repository = {
  getById: (id: number) => repository(getPool()).getById(id),
  getPrimary: (userId: string) => repository(getPool()).getPrimary(userId),
  getAll: (userId: string) => repository(getPool()).getAll(userId),
  findByInputHash: (userId: string, hash: string, identity?: { subjectType?: 'self' | 'saved_person'; name?: string }) => repository(getPool()).findByInputHash(userId, hash, identity),
  setIdentityMetadata: (id: number, type: 'self' | 'saved_person', label: string | null) => repository(getPool()).setIdentityMetadata(id, type, label),
  async withUserLock<T>(userId: string, work: (repo: LockedNatalChartRepository) => Promise<T>): Promise<T> {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('natal-chart:' || $1::text))", [userId]);
      const user = await client.query('SELECT id FROM users WHERE id=$1 AND is_blocked IS NOT TRUE FOR UPDATE', [userId]);
      if (!user.rows[0]) throw new Error('ACCOUNT_NO_LONGER_EXISTS');
      const result = await work(repository(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  },
};
