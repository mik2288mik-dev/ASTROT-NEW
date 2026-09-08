import type { HomeCard } from '../../lib/homeCards';
export const homeCardFixture = (changes: Partial<HomeCard> = {}): HomeCard => ({
  schemaVersion: 1, title: 'Твоя натальная карта', caption: 'Наблюдения о тебе — простыми словами.',
  imageUrl: '/assets/nebo-refined/natal-chart.webp', tone: 'violet', layout: 'popout',
  action: { kind: 'internal', target: 'natal' }, order: 10, audience: 'all', startsAt: null, endsAt: null, ...changes,
});
