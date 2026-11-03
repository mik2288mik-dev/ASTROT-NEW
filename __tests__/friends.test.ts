jest.mock('../lib/db', () => ({ getPool: jest.fn() }));
jest.mock('../lib/appPush', () => ({ createAppPushMessage: jest.fn(async () => 1) }));

import { createAppPushMessage } from '../lib/appPush';
import { addFriendByCode, getOrCreateFriendCode, normalizeFriendCode, readMessages, sendMessage, setFriendPrefs } from '../lib/friends';

/** In-memory stand-in for the friend tables. */
function fakePool() {
  const codes = new Map<string, string>();
  const pairs = new Set<string>();
  const messages: Array<{ id: number; from: string; to: string; body: string; kind: string; payload: unknown; at: Date; read: boolean }> = [];
  const prefs = new Map<string, boolean>();
  const query = jest.fn(async (sql: string, params: any[] = []) => {
    const text = sql.replace(/\s+/g, ' ').trim();
    if (text.startsWith('CREATE TABLE')) return { rows: [] };
    if (text.startsWith('SELECT code FROM friend_codes')) return { rows: codes.has(params[0]) ? [{ code: codes.get(params[0]) }] : [] };
    if (text.startsWith('INSERT INTO friend_codes')) {
      if ([...codes.values()].includes(params[1]) || codes.has(params[0])) return { rows: [] };
      codes.set(params[0], params[1]);
      return { rows: [{ code: params[1] }] };
    }
    if (text.startsWith('SELECT user_id FROM friend_codes')) {
      const owner = [...codes.entries()].find(([, code]) => code === params[0]);
      return { rows: owner ? [{ user_id: owner[0] }] : [] };
    }
    if (text.startsWith('INSERT INTO friendships')) { pairs.add(`${params[0]}|${params[1]}`); return { rows: [] }; }
    if (text.startsWith('SELECT 1 FROM friendships')) return { rows: pairs.has(`${params[0]}|${params[1]}`) ? [{}] : [] };
    if (text.startsWith('SELECT COUNT(*) AS n FROM friend_messages')) return { rows: [{ n: messages.filter((m) => m.from === params[0]).length }] };
    if (text.startsWith('INSERT INTO friend_messages')) {
      const message = { id: messages.length + 1, from: params[0], to: params[1], body: params[2], kind: params[3], payload: params[4] ? JSON.parse(params[4]) : null, at: new Date(), read: false };
      messages.push(message);
      return { rows: [{ id: message.id, created_at: message.at }] };
    }
    if (text.startsWith('SELECT notify_messages FROM friend_prefs')) {
      const key = `${params[0]}|${params[1]}`;
      return { rows: prefs.has(key) ? [{ notify_messages: prefs.get(key) }] : [] };
    }
    if (text.startsWith('INSERT INTO friend_prefs')) { prefs.set(`${params[0]}|${params[1]}`, params[2]); return { rows: [] }; }
    if (text.startsWith('SELECT id, from_user, body, kind, payload, created_at FROM friend_messages')) {
      const rows = messages
        .filter((m) => m.id > params[2] && ((m.from === params[0] && m.to === params[1]) || (m.from === params[1] && m.to === params[0])))
        .sort((a, b) => b.id - a.id)
        .map((m) => ({ id: m.id, from_user: m.from, body: m.body, kind: m.kind, payload: m.payload, created_at: m.at }));
      return { rows };
    }
    if (text.startsWith('UPDATE friend_messages SET read_at')) {
      messages.filter((m) => m.from === params[0] && m.to === params[1]).forEach((m) => { m.read = true; });
      return { rows: [] };
    }
    throw new Error(`unexpected SQL: ${text}`);
  });
  return { pool: { query } as any, messages };
}

describe('friends', () => {
  it('gives each person one stable code', async () => {
    const { pool } = fakePool();
    const code = await getOrCreateFriendCode('10', pool);
    expect(code).toMatch(/^NEBO-[A-Z2-9]{4}$/);
    expect(await getOrCreateFriendCode('10', pool)).toBe(code);
    expect(normalizeFriendCode(' nebo-ab12 ')).toBe('NEBO-AB12');
  });

  it('links two people by a code, both ways, and refuses your own or a wrong code', async () => {
    const { pool } = fakePool();
    const code = await getOrCreateFriendCode('20', pool);
    await expect(addFriendByCode('20', code, pool)).rejects.toThrow('SELF_CODE');
    await expect(addFriendByCode('30', 'NEBO-0000', pool)).rejects.toThrow('CODE_NOT_FOUND');
    expect(await addFriendByCode('30', code.toLowerCase(), pool)).toBe('20');
    await expect(sendMessage({ userId: '20', senderName: 'Ника', friendId: '30', body: 'Привет' }, pool)).resolves.toMatchObject({ mine: true, body: 'Привет' });
  });

  it('only friends can write, the friend gets a push unless muted, and reading marks messages read', async () => {
    const { pool, messages } = fakePool();
    const code = await getOrCreateFriendCode('40', pool);
    await expect(sendMessage({ userId: '50', senderName: 'Марк', friendId: '40', body: 'Привет' }, pool)).rejects.toThrow('NOT_FRIENDS');
    await addFriendByCode('50', code, pool);
    await sendMessage({ userId: '50', senderName: 'Марк', friendId: '40', body: 'Привет' }, pool);
    expect(createAppPushMessage).toHaveBeenLastCalledWith(expect.objectContaining({ audience: 'user', target: '40', title: 'Марк пишет тебе' }), 'friend:50');
    (createAppPushMessage as jest.Mock).mockClear();
    await setFriendPrefs('40', '50', false, pool);
    await sendMessage({ userId: '50', senderName: 'Марк', friendId: '40', body: 'Ещё' }, pool);
    expect(createAppPushMessage).not.toHaveBeenCalled();
    const read = await readMessages('40', '50', 0, pool);
    expect(read.map((m) => m.body)).toEqual(['Привет', 'Ещё']);
    expect(read.every((m) => !m.mine)).toBe(true);
    expect(messages.every((m) => m.read)).toBe(true);
    await expect(sendMessage({ userId: '50', senderName: 'Марк', friendId: '40', body: '   ' }, pool)).rejects.toThrow('EMPTY_MESSAGE');
  });
});
