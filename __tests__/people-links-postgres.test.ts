/**
 * «Мои люди» on a real PostgreSQL (PGlite). Runs when NEBO_ACTIVITY_TEST_PGLITE_PATH
 * points at an installed @electric-sql/pglite, like the other database tests.
 */
const pglitePath = process.env.NEBO_ACTIVITY_TEST_PGLITE_PATH;
const postgres = pglitePath ? describe : describe.skip;
let database: any;

function adapt(result: any) {
  return { rows: result?.rows || [], rowCount: (result?.rows?.length || 0) || (result?.affectedRows ?? 0) };
}
async function run(sql: string, params?: unknown[]) {
  if (params === undefined && sql.trim().split(';').filter((part) => part.trim()).length > 1) {
    const results = await database.exec(sql);
    return adapt(results[results.length - 1]);
  }
  return adapt(await database.query(sql, params));
}
const mockPool: any = {
  query: run,
  connect: async () => ({ query: run, release: () => undefined }),
};

jest.mock('../lib/db', () => ({ getPool: () => mockPool, db: {} }));

import { PEOPLE_SCHEMA_SQL } from '../lib/people/schema';
import {
  acceptInvite,
  createInvite,
  declineInvite,
  formatInviteCode,
  getLinkedPerson,
  listPeople,
  normalizeInviteCode,
  previewInvite,
  proposeContext,
  respondToContextProposal,
  revokeInvite,
  unlink,
  updateMemberSettings,
} from '../lib/people/service';

const MASHA = '-6172818487510834433';
const SASHA = '10';
const OLGA = '11';

postgres('linked people on PostgreSQL', () => {
  beforeAll(async () => {
    const { PGlite } = require(pglitePath!);
    database = new PGlite();
    await database.exec(`
      CREATE TABLE users (id BIGINT PRIMARY KEY, name TEXT, gender TEXT);
      CREATE TABLE natal_charts (
        id BIGSERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id) ON DELETE CASCADE, name TEXT,
        subject_type TEXT NOT NULL DEFAULT 'saved_person', archived_at TIMESTAMPTZ, is_primary BOOLEAN,
        sun_sign TEXT, birth_date DATE, birth_time TIME, birth_place TEXT
      );
      INSERT INTO users VALUES (${MASHA}, 'Маша Иванова', 'female'), (${SASHA}, 'Саша', 'male'), (${OLGA}, 'Ольга', 'female');
      INSERT INTO natal_charts (user_id, subject_type, is_primary, sun_sign, birth_date, birth_time, birth_place)
        VALUES (${MASHA}, 'self', true, 'Leo', '1993-08-02', '14:30', 'Москва'),
               (${SASHA}, 'self', true, 'pisces', '1991-03-10', '08:00', 'Казань');
      INSERT INTO natal_charts (user_id, name, sun_sign, birth_date, birth_time, birth_place)
        VALUES (${SASHA}, 'Маша', 'leo', '1993-08-02', '14:00', 'Москва');
      ${PEOPLE_SCHEMA_SQL}
    `);
  }, 60000);
  afterAll(async () => { await database?.close(); });

  it('formats and normalizes invite codes without ambiguous characters', () => {
    expect(normalizeInviteCode('k7m2-pq4x')).toBe('K7M2PQ4X');
    expect(normalizeInviteCode('K7M2PQ4O')).toBeNull();
    expect(formatInviteCode('K7M2PQ4X')).toBe('K7M2-PQ4X');
  });

  it('links two accounts once, in any order, and shows each to the other', async () => {
    const invite = await createInvite(MASHA, 'relationship', mockPool);
    expect(invite.code).toHaveLength(8);

    const anonymous = await previewInvite(invite.code, null, mockPool);
    expect(anonymous).toMatchObject({ status: 'active', inviterName: 'Маша', relationshipContext: 'relationship' });
    expect(await previewInvite(invite.code, MASHA, mockPool)).toMatchObject({ status: 'own' });
    await expect(acceptInvite(MASHA, invite.code, null, mockPool)).rejects.toMatchObject({ code: 'INVITE_OWN' });

    const accepted = await acceptInvite(SASHA, invite.code, null, mockPool);
    expect(accepted.created).toBe(true);
    // A repeated tap by the same person is not an error.
    expect(await acceptInvite(SASHA, invite.code, null, mockPool)).toEqual({ linkId: accepted.linkId, created: false });
    await expect(acceptInvite(OLGA, invite.code, null, mockPool)).rejects.toMatchObject({ code: 'INVITE_USED' });

    // Sasha invites Masha back: still the very same link.
    const back = await createInvite(SASHA, 'friendship', mockPool);
    expect(await previewInvite(back.code, MASHA, mockPool)).toMatchObject({ status: 'already_linked', linkId: accepted.linkId });
    expect((await acceptInvite(MASHA, back.code, null, mockPool)).linkId).toBe(accepted.linkId);
    expect((await run('SELECT COUNT(*)::int AS count FROM people_links')).rows[0].count).toBe(1);

    const forSasha = await listPeople(SASHA, mockPool);
    expect(forSasha.people).toHaveLength(1);
    expect(forSasha.people[0]).toMatchObject({
      linkId: accepted.linkId, name: 'Маша', sunSign: 'leo', birthday: '08-02', relationshipContext: 'relationship', hasChart: true,
    });
    // Sasha already had a hand-made card of Masha with the same birth date.
    expect(forSasha.people[0].suggestedManualChartId).not.toBeNull();
    const forMasha = await listPeople(MASHA, mockPool);
    expect(forMasha.people[0]).toMatchObject({ name: 'Саша', sunSign: 'pisces', createdByMe: true });
  });

  it('keeps birthdays private on request and checks manual card ownership', async () => {
    const { people } = await listPeople(MASHA, mockPool);
    const linkId = people[0].linkId;
    await updateMemberSettings(MASHA, linkId, { shareBirthday: false }, mockPool);
    expect((await getLinkedPerson(SASHA, linkId, mockPool)).birthday).toBeNull();

    const card = (await run(`SELECT id::text FROM natal_charts WHERE user_id = ${SASHA} AND subject_type = 'saved_person'`)).rows[0].id;
    await expect(updateMemberSettings(MASHA, linkId, { manualChartId: card }, mockPool)).rejects.toMatchObject({ code: 'CHART_NOT_FOUND' });
    await updateMemberSettings(SASHA, linkId, { manualChartId: card }, mockPool);
    expect((await getLinkedPerson(SASHA, linkId, mockPool)).manualChartId).toBe(card);
    await expect(getLinkedPerson(OLGA, linkId, mockPool)).rejects.toMatchObject({ code: 'LINK_NOT_FOUND' });
  });

  it('changes the relationship type only after the other person agrees', async () => {
    const linkId = (await listPeople(MASHA, mockPool)).people[0].linkId;
    await proposeContext(MASHA, linkId, 'family', mockPool);
    await expect(respondToContextProposal(MASHA, linkId, true, mockPool)).rejects.toMatchObject({ code: 'NO_PROPOSAL' });
    expect((await getLinkedPerson(SASHA, linkId, mockPool))).toMatchObject({ relationshipContext: 'relationship', proposedContext: 'family', proposedByMe: false });
    await respondToContextProposal(SASHA, linkId, true, mockPool);
    expect((await getLinkedPerson(MASHA, linkId, mockPool))).toMatchObject({ relationshipContext: 'family', proposedContext: null });
  });

  it('handles revoked, declined and expired invites', async () => {
    const revoked = await createInvite(OLGA, 'friendship', mockPool);
    await revokeInvite(OLGA, revoked.code, mockPool);
    await expect(acceptInvite(SASHA, revoked.code, null, mockPool)).rejects.toMatchObject({ code: 'INVITE_REVOKED' });

    const declined = await createInvite(OLGA, 'work', mockPool);
    await declineInvite(SASHA, declined.code, mockPool);
    expect(await previewInvite(declined.code, null, mockPool)).toMatchObject({ status: 'declined' });

    const expired = await createInvite(OLGA, 'friendship', mockPool);
    await run(`UPDATE people_invites SET expires_at = NOW() - INTERVAL '1 minute' WHERE code = '${expired.code}'`);
    expect(await previewInvite(expired.code, SASHA, mockPool)).toMatchObject({ status: 'expired' });
    await expect(acceptInvite(SASHA, expired.code, null, mockPool)).rejects.toMatchObject({ code: 'INVITE_EXPIRED' });

    const open = await listPeople(OLGA, mockPool);
    expect(open.invites).toHaveLength(0);
  });

  it('removes the shared reading for both when the link is removed', async () => {
    const linkId = (await listPeople(MASHA, mockPool)).people[0].linkId;
    await run(
      `INSERT INTO people_pair_readings (link_id, reading_key, language, relationship_context, calculation_level, inputs, content)
       VALUES (${linkId}, 'k1', 'ru', 'family', 'exact', '{}', '{}')`,
    );
    await expect(unlink(OLGA, linkId, mockPool)).rejects.toMatchObject({ code: 'LINK_NOT_FOUND' });
    await unlink(SASHA, linkId, mockPool);
    expect((await listPeople(MASHA, mockPool)).people).toHaveLength(0);
    expect((await run('SELECT COUNT(*)::int AS count FROM people_pair_readings')).rows[0].count).toBe(0);
    // The hand-made card stays with its owner.
    expect((await run(`SELECT COUNT(*)::int AS count FROM natal_charts WHERE user_id = ${SASHA} AND subject_type = 'saved_person'`)).rows[0].count).toBe(1);
  });
});
