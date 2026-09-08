import { parseHomeCard, safeHomeCardUrl, selectPublishedHomeCards } from '../lib/homeCards';
import { homeCardFixture } from './fixtures/homeCard';

describe('home cards content contract', () => {
  it('accepts generated local artwork and compact cards without an image', () => {
    expect(parseHomeCard(JSON.stringify(homeCardFixture()))).toEqual(homeCardFixture());
    expect(parseHomeCard(homeCardFixture({ layout: 'compact', imageUrl: undefined }))).not.toHaveProperty('imageUrl');
  });
  it.each(['javascript:alert(1)', 'data:image/svg+xml,<svg/>', '//evil.com/image.png', 'http://cdn.site.com/a.png', 'https://user:password@site.com/a.png', 'https://localhost/a', 'https://127.0.0.1/a', 'https://0x7f000001/a', 'https://[::1]/a', 'https://app.internal/a', 'https://app.local/a', 'https://site.com:8443/a', '/assets/../private.png', '/assets/x.svg', '/api/users/me'])('rejects unsafe image address %s', (url) => {
    expect(() => safeHomeCardUrl(url, true)).toThrow();
  });
  it('supports HTTPS image hosting and an HTTPS external destination', () => {
    expect(parseHomeCard(homeCardFixture({ imageUrl: 'https://cdn.domain.com/card.webp', action: { kind: 'external', url: 'https://nebo.app/event' } })).action).toEqual({ kind: 'external', url: 'https://nebo.app/event' });
  });
  it.each([
    { audience: 'staff' }, { layout: 'mystery' }, { order: 1.2 }, { schemaVersion: 2 }, { title: ' '.repeat(4) },
    { action: { kind: 'internal', target: 'admin' } }, { imageUrl: undefined },
    { startsAt: '2026-02-30T12:00:00Z' }, { startsAt: '2026-09-08T12:00' },
    { startsAt: '2026-09-09T12:00:00Z', endsAt: '2026-09-08T12:00:00Z' },
  ])('rejects malformed card fields: %j', (changes) => expect(() => parseHomeCard({ ...homeCardFixture(), ...changes })).toThrow());
});

describe('published home cards schedule and audience', () => {
  const now = Date.parse('2026-09-08T12:00:00Z');
  const row = (id: number, changes: Parameters<typeof homeCardFixture>[0] = {}) => ({ id, body: JSON.stringify(homeCardFixture(changes)) });
  const rows = [row(1), row(2, { audience: 'premium', order: 0 }), row(3, { audience: 'free' }), row(4, { endsAt: '2026-09-08T12:00:00Z' }), row(5, { startsAt: '2026-09-08T12:00:10Z' }), { id: 6, body: 'invalid' }];
  it('returns active free/all cards and schedules the nearest future start', () => {
    expect(selectPublishedHomeCards(rows, false, now)).toMatchObject({ cards: [{ id: 1 }, { id: 3 }], nextChangeAt: '2026-09-08T12:00:10.000Z' });
  });
  it('orders Premium cards, excludes free ones and expires the cache at entitlement end', () => {
    expect(selectPublishedHomeCards(rows, true, now, '2026-09-08T12:00:05Z')).toMatchObject({ cards: [{ id: 2 }, { id: 1 }], nextChangeAt: '2026-09-08T12:00:05.000Z' });
  });
  it('includes a card exactly at its start and excludes it exactly at its end', () => {
    const active = [row(9, { startsAt: '2026-09-08T12:00:00Z', endsAt: '2026-09-08T12:01:00Z' })];
    expect(selectPublishedHomeCards(active, false, now).cards).toHaveLength(1);
    expect(selectPublishedHomeCards(active, false, now + 60_000).cards).toHaveLength(0);
  });
});
