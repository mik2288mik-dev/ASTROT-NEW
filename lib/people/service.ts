import { randomInt } from 'crypto';
import type { Pool, PoolClient } from 'pg';
import { getPool } from '../db';
import { parseChartAvatarChoice, type ChartAvatarChoice } from '../chartAvatar';
import { avatarJoin, ensurePeopleSchema } from './schema';

/** Types of relationship two linked accounts can share. One type means one shared reading. */
export const LINK_CONTEXTS = ['relationship', 'friendship', 'family', 'work'] as const;
export type LinkContext = typeof LINK_CONTEXTS[number];

export const INVITE_TTL_DAYS = 7;
export const MAX_ACTIVE_INVITES = 20;
export const MAX_LINKS = 100;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export class PeopleError extends Error {
  constructor(public readonly status: number, public readonly code: string, message?: string) {
    super(message || code);
    this.name = 'PeopleError';
  }
}

export function normalizeLinkContext(value: unknown): LinkContext | null {
  return LINK_CONTEXTS.includes(value as LinkContext) ? value as LinkContext : null;
}

/** Codes are shown to people («K7M2-PQ4X»), so ambiguous letters and digits are left out. */
export function generateInviteCode(): string {
  let code = '';
  for (let index = 0; index < CODE_LENGTH; index += 1) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

export function normalizeInviteCode(value: unknown): string | null {
  const code = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== CODE_LENGTH) return null;
  for (const char of code) if (!CODE_ALPHABET.includes(char)) return null;
  return code;
}

export function formatInviteCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function firstName(value: unknown): string {
  return String(value ?? '').trim().split(/\s+/u)[0]?.slice(0, 40) || '';
}

type Queryable = Pick<Pool, 'query'> | PoolClient;

async function withTransaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------- invites

export type InviteSummary = {
  code: string;
  displayCode: string;
  relationshipContext: LinkContext;
  createdAt: string;
  expiresAt: string;
};

function toInviteSummary(row: any): InviteSummary {
  return {
    code: row.code,
    displayCode: formatInviteCode(row.code),
    relationshipContext: normalizeLinkContext(row.relationship_context) || 'friendship',
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
  };
}

export async function createInvite(userId: string, context: LinkContext, pool: Pool = getPool()): Promise<InviteSummary> {
  await ensurePeopleSchema(pool);
  const active = await pool.query(
    `SELECT COUNT(*)::int AS count FROM people_invites
     WHERE inviter_user_id = $1 AND status = 'active' AND expires_at > NOW()`,
    [userId],
  );
  if (Number(active.rows[0]?.count || 0) >= MAX_ACTIVE_INVITES) {
    throw new PeopleError(429, 'INVITE_LIMIT', 'Too many active invites');
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await pool.query(
      `INSERT INTO people_invites (code, inviter_user_id, relationship_context, expires_at)
       VALUES ($1, $2, $3, NOW() + make_interval(days => $4))
       ON CONFLICT (code) DO NOTHING
       RETURNING code, relationship_context, created_at, expires_at`,
      [generateInviteCode(), userId, context, INVITE_TTL_DAYS],
    );
    if (result.rows[0]) return toInviteSummary(result.rows[0]);
  }
  throw new PeopleError(503, 'INVITE_CODE_UNAVAILABLE');
}

export async function revokeInvite(userId: string, code: string, pool: Pool = getPool()): Promise<void> {
  await ensurePeopleSchema(pool);
  const result = await pool.query(
    `UPDATE people_invites SET status = 'revoked', responded_at = NOW()
     WHERE code = $1 AND inviter_user_id = $2 AND status = 'active'`,
    [code, userId],
  );
  if (!result.rowCount) throw new PeopleError(404, 'INVITE_NOT_FOUND');
}

export type InvitePreviewStatus = 'active' | 'expired' | 'used' | 'declined' | 'revoked' | 'own' | 'already_linked';

export type InvitePreview = {
  status: InvitePreviewStatus;
  inviterName: string;
  inviterAvatar: ChartAvatarChoice | null;
  relationshipContext: LinkContext;
  linkId: string | null;
};

/** Only a first name and the type of relationship: the invite page is reachable without an account. */
export async function previewInvite(code: string, viewerUserId: string | null, pool: Pool = getPool()): Promise<InvitePreview> {
  await ensurePeopleSchema(pool);
  const result = await pool.query(
    `SELECT i.*, u.name AS inviter_name, a.avatar AS inviter_avatar
     FROM people_invites i
     JOIN users u ON u.id = i.inviter_user_id
     ${avatarJoin('i.inviter_user_id', 'a')}
     WHERE i.code = $1`,
    [code],
  );
  const row = result.rows[0];
  if (!row) throw new PeopleError(404, 'INVITE_NOT_FOUND');
  const avatar = parseChartAvatarChoice(row.inviter_avatar);
  const base = {
    inviterName: firstName(row.inviter_name),
    inviterAvatar: avatar?.kind === 'cat' ? avatar : null,
    relationshipContext: normalizeLinkContext(row.relationship_context) || 'friendship' as LinkContext,
  };
  let linkId: string | null = null;
  if (viewerUserId) {
    if (String(row.inviter_user_id) === String(viewerUserId)) return { ...base, status: 'own', linkId: null };
    const link = await findLinkBetween(pool, String(row.inviter_user_id), viewerUserId);
    if (link) linkId = String(link.id);
  }
  const status: InvitePreviewStatus = row.status === 'accepted'
    ? (linkId ? 'already_linked' : 'used')
    : row.status === 'declined' ? 'declined'
      : row.status === 'revoked' ? 'revoked'
        : new Date(row.expires_at).getTime() <= Date.now() ? 'expired'
          : linkId ? 'already_linked' : 'active';
  return { ...base, status, linkId };
}

async function findLinkBetween(db: Queryable, first: string, second: string): Promise<{ id: string } | null> {
  const result = await db.query(
    `SELECT id FROM people_links
     WHERE user_low_id = LEAST($1::bigint, $2::bigint) AND user_high_id = GREATEST($1::bigint, $2::bigint)`,
    [first, second],
  );
  return result.rows[0] ? { id: String(result.rows[0].id) } : null;
}

/**
 * Accepting creates (or reuses) the one link between the two accounts. The invited
 * person confirms the proposed type or picks another one; both then read one reading.
 * Two people inviting each other at the same time end up with the same single link.
 */
export async function acceptInvite(
  userId: string,
  code: string,
  chosenContext: LinkContext | null,
  pool: Pool = getPool(),
): Promise<{ linkId: string; created: boolean }> {
  await ensurePeopleSchema(pool);
  return withTransaction(pool, async (client) => {
    const inviteResult = await client.query('SELECT * FROM people_invites WHERE code = $1 FOR UPDATE', [code]);
    const invite = inviteResult.rows[0];
    if (!invite) throw new PeopleError(404, 'INVITE_NOT_FOUND');
    const inviterId = String(invite.inviter_user_id);
    if (inviterId === String(userId)) throw new PeopleError(409, 'INVITE_OWN');
    if (invite.status === 'accepted') {
      const existing = await findLinkBetween(client, inviterId, userId);
      if (existing && String(invite.responded_by_user_id) === String(userId)) return { linkId: existing.id, created: false };
      throw new PeopleError(410, 'INVITE_USED');
    }
    if (invite.status !== 'active') throw new PeopleError(410, invite.status === 'revoked' ? 'INVITE_REVOKED' : 'INVITE_DECLINED');
    if (new Date(invite.expires_at).getTime() <= Date.now()) throw new PeopleError(410, 'INVITE_EXPIRED');

    const existing = await findLinkBetween(client, inviterId, userId);
    const context = chosenContext || normalizeLinkContext(invite.relationship_context) || 'friendship';
    let linkId: string;
    let created = false;
    if (existing) {
      linkId = existing.id;
    } else {
      const counts = await client.query(
        `SELECT
           (SELECT COUNT(*) FROM people_links WHERE $1::bigint IN (user_low_id, user_high_id))::int AS inviter,
           (SELECT COUNT(*) FROM people_links WHERE $2::bigint IN (user_low_id, user_high_id))::int AS invited`,
        [inviterId, userId],
      );
      if (Math.max(Number(counts.rows[0]?.inviter || 0), Number(counts.rows[0]?.invited || 0)) >= MAX_LINKS) {
        throw new PeopleError(409, 'LINK_LIMIT');
      }
      const inserted = await client.query(
        `INSERT INTO people_links (user_low_id, user_high_id, relationship_context, created_by_user_id)
         VALUES (LEAST($1::bigint, $2::bigint), GREATEST($1::bigint, $2::bigint), $3, $1::bigint)
         ON CONFLICT (user_low_id, user_high_id) DO UPDATE SET updated_at = people_links.updated_at
         RETURNING id, (xmax = 0) AS inserted`,
        [inviterId, userId, context],
      );
      linkId = String(inserted.rows[0].id);
      created = inserted.rows[0].inserted === true;
    }
    await client.query(
      `INSERT INTO people_link_members (link_id, user_id) VALUES ($1, $2), ($1, $3)
       ON CONFLICT (link_id, user_id) DO NOTHING`,
      [linkId, inviterId, userId],
    );
    await client.query(
      `UPDATE people_invites SET status = 'accepted', responded_by_user_id = $2, responded_at = NOW(), link_id = $3
       WHERE id = $1`,
      [invite.id, userId, linkId],
    );
    return { linkId, created };
  });
}

export async function declineInvite(userId: string, code: string, pool: Pool = getPool()): Promise<void> {
  await ensurePeopleSchema(pool);
  const result = await pool.query(
    `UPDATE people_invites SET status = 'declined', responded_by_user_id = $2, responded_at = NOW()
     WHERE code = $1 AND status = 'active' AND inviter_user_id <> $2::bigint`,
    [code, userId],
  );
  if (!result.rowCount) throw new PeopleError(404, 'INVITE_NOT_FOUND');
}

// ---------------------------------------------------------------- links

export type LinkedPerson = {
  linkId: string;
  name: string;
  gender: 'male' | 'female' | 'unspecified';
  avatar: ChartAvatarChoice | null;
  sunSign: string | null;
  /** «MM-DD» only when that person shares the birthday; the year is never shown. */
  birthday: string | null;
  hasChart: boolean;
  relationshipContext: LinkContext;
  proposedContext: LinkContext | null;
  proposedByMe: boolean;
  shareMyBirthday: boolean;
  manualChartId: string | null;
  /** My saved card with the same birth date, offered as «это тот же человек?». */
  suggestedManualChartId: string | null;
  linkedAt: string;
  createdByMe: boolean;
};

function isoDate(value: unknown): string | null {
  if (!value) return null;
  const iso = value instanceof Date
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
    : String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

function monthDay(value: unknown): string | null {
  return isoDate(value)?.slice(5) ?? null;
}

function normalizeGender(value: unknown): LinkedPerson['gender'] {
  return value === 'male' || value === 'female' ? value : 'unspecified';
}

const linkedPeopleSql = () => `
  SELECT
    l.id, l.relationship_context, l.proposed_context, l.proposed_by_user_id, l.created_by_user_id, l.created_at,
    m.share_birthday AS my_share_birthday, m.manual_chart_id,
    pm.share_birthday AS partner_share_birthday,
    u.id AS partner_id, u.name AS partner_name, u.gender AS partner_gender,
    c.sun_sign AS partner_sun_sign, c.birth_date AS partner_birth_date, c.id AS partner_chart_id,
    a.avatar AS partner_avatar
  FROM people_links l
  JOIN people_link_members m ON m.link_id = l.id AND m.user_id = $1::bigint
  JOIN users u ON u.id = CASE WHEN l.user_low_id = $1::bigint THEN l.user_high_id ELSE l.user_low_id END
  LEFT JOIN people_link_members pm ON pm.link_id = l.id AND pm.user_id = u.id
  LEFT JOIN LATERAL (
    SELECT id, sun_sign, birth_date FROM natal_charts
    WHERE user_id = u.id AND subject_type = 'self' AND archived_at IS NULL
    ORDER BY is_primary DESC NULLS LAST, id ASC LIMIT 1
  ) c ON TRUE
  ${avatarJoin('u.id', 'a')}
  WHERE $1::bigint IN (l.user_low_id, l.user_high_id)
`;

function toLinkedPerson(row: any, userId: string): LinkedPerson {
  const avatar = parseChartAvatarChoice(row.partner_avatar);
  return {
    linkId: String(row.id),
    name: firstName(row.partner_name),
    gender: normalizeGender(row.partner_gender),
    avatar: avatar && avatar.kind !== 'telegram' ? avatar : null,
    sunSign: row.partner_sun_sign ? String(row.partner_sun_sign).toLowerCase() : null,
    birthday: row.partner_share_birthday === false ? null : monthDay(row.partner_birth_date),
    hasChart: row.partner_chart_id != null,
    relationshipContext: normalizeLinkContext(row.relationship_context) || 'friendship',
    proposedContext: normalizeLinkContext(row.proposed_context),
    proposedByMe: row.proposed_by_user_id != null && String(row.proposed_by_user_id) === String(userId),
    shareMyBirthday: row.my_share_birthday !== false,
    manualChartId: row.manual_chart_id != null ? String(row.manual_chart_id) : null,
    suggestedManualChartId: null,
    linkedAt: new Date(row.created_at).toISOString(),
    createdByMe: String(row.created_by_user_id) === String(userId),
  };
}

export async function listPeople(userId: string, pool: Pool = getPool()): Promise<{ people: LinkedPerson[]; invites: InviteSummary[] }> {
  await ensurePeopleSchema(pool);
  const [links, invites] = await Promise.all([
    pool.query(`${linkedPeopleSql()} ORDER BY l.created_at DESC`, [userId]),
    pool.query(
      `SELECT code, relationship_context, created_at, expires_at FROM people_invites
       WHERE inviter_user_id = $1 AND status = 'active' AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [userId],
    ),
  ]);
  const people = links.rows.map((row) => toLinkedPerson(row, userId));
  const waiting = links.rows.filter((row) => row.manual_chart_id == null && row.partner_share_birthday !== false && row.partner_birth_date);
  if (waiting.length) {
    const cards = await pool.query(
      `SELECT id, birth_date FROM natal_charts
       WHERE user_id = $1::bigint AND subject_type = 'saved_person' AND archived_at IS NULL`,
      [userId],
    );
    const taken = new Set(people.map((person) => person.manualChartId).filter(Boolean));
    for (const row of waiting) {
      const date = isoDate(row.partner_birth_date);
      const match = cards.rows.find((card) => !taken.has(String(card.id)) && isoDate(card.birth_date) === date);
      const person = people.find((item) => item.linkId === String(row.id));
      if (match && person) {
        person.suggestedManualChartId = String(match.id);
        taken.add(String(match.id));
      }
    }
  }
  return { people, invites: invites.rows.map(toInviteSummary) };
}

export async function getLinkedPerson(userId: string, linkId: string, pool: Pool = getPool()): Promise<LinkedPerson> {
  await ensurePeopleSchema(pool);
  const result = await pool.query(`${linkedPeopleSql()} AND l.id = $2::bigint`, [userId, linkId]);
  if (!result.rows[0]) throw new PeopleError(404, 'LINK_NOT_FOUND');
  return toLinkedPerson(result.rows[0], userId);
}

/** Removing a link removes the shared reading for both (cascade); each keeps their own manual cards. */
export async function unlink(userId: string, linkId: string, pool: Pool = getPool()): Promise<void> {
  await ensurePeopleSchema(pool);
  const result = await pool.query(
    'DELETE FROM people_links WHERE id = $1::bigint AND $2::bigint IN (user_low_id, user_high_id)',
    [linkId, userId],
  );
  if (!result.rowCount) throw new PeopleError(404, 'LINK_NOT_FOUND');
}

export async function updateMemberSettings(
  userId: string,
  linkId: string,
  settings: { shareBirthday?: boolean; manualChartId?: string | null },
  pool: Pool = getPool(),
): Promise<void> {
  await ensurePeopleSchema(pool);
  await getLinkedPerson(userId, linkId, pool);
  if (settings.manualChartId != null) {
    const chart = await pool.query(
      `SELECT 1 FROM natal_charts
       WHERE id = $1::bigint AND user_id = $2::bigint AND subject_type = 'saved_person' AND archived_at IS NULL`,
      [settings.manualChartId, userId],
    );
    if (!chart.rowCount) throw new PeopleError(404, 'CHART_NOT_FOUND');
  }
  const assignments: string[] = [];
  const params: unknown[] = [linkId, userId];
  if (typeof settings.shareBirthday === 'boolean') {
    params.push(settings.shareBirthday);
    assignments.push(`share_birthday = $${params.length}`);
  }
  if (settings.manualChartId !== undefined) {
    params.push(settings.manualChartId);
    assignments.push(`manual_chart_id = $${params.length}::bigint`);
  }
  if (!assignments.length) return;
  await pool.query(
    `UPDATE people_link_members SET ${assignments.join(', ')} WHERE link_id = $1::bigint AND user_id = $2::bigint`,
    params,
  );
}

/** Either person proposes another type; it applies only after the other one agrees. */
export async function proposeContext(userId: string, linkId: string, context: LinkContext, pool: Pool = getPool()): Promise<void> {
  const person = await getLinkedPerson(userId, linkId, pool);
  if (person.relationshipContext === context) {
    await pool.query(
      'UPDATE people_links SET proposed_context = NULL, proposed_by_user_id = NULL, updated_at = NOW() WHERE id = $1::bigint',
      [linkId],
    );
    return;
  }
  await pool.query(
    'UPDATE people_links SET proposed_context = $2, proposed_by_user_id = $3::bigint, updated_at = NOW() WHERE id = $1::bigint',
    [linkId, context, userId],
  );
}

export async function respondToContextProposal(userId: string, linkId: string, accept: boolean, pool: Pool = getPool()): Promise<void> {
  const person = await getLinkedPerson(userId, linkId, pool);
  if (!person.proposedContext || person.proposedByMe) throw new PeopleError(409, 'NO_PROPOSAL');
  await pool.query(
    accept
      ? `UPDATE people_links SET relationship_context = proposed_context, proposed_context = NULL,
           proposed_by_user_id = NULL, updated_at = NOW() WHERE id = $1::bigint`
      : 'UPDATE people_links SET proposed_context = NULL, proposed_by_user_id = NULL, updated_at = NOW() WHERE id = $1::bigint',
    [linkId],
  );
}

/** The two account ids of a link the requester belongs to, subject first (lower id). */
export async function getLinkMembers(userId: string, linkId: string, pool: Pool = getPool()): Promise<{
  lowId: string; highId: string; relationshipContext: LinkContext;
}> {
  await ensurePeopleSchema(pool);
  const result = await pool.query(
    `SELECT user_low_id, user_high_id, relationship_context FROM people_links
     WHERE id = $1::bigint AND $2::bigint IN (user_low_id, user_high_id)`,
    [linkId, userId],
  );
  const row = result.rows[0];
  if (!row) throw new PeopleError(404, 'LINK_NOT_FOUND');
  return {
    lowId: String(row.user_low_id),
    highId: String(row.user_high_id),
    relationshipContext: normalizeLinkContext(row.relationship_context) || 'friendship',
  };
}
