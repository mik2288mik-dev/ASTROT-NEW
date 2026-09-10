import {
  buildLocalPersonSnapshot,
  buildLocalSignCompatibility,
} from '../lib/synastry/localSignText';
import {
  getRelationshipContextLabel,
  getRelationshipContextOption,
  normalizeRelationshipContext,
} from '../lib/synastry/relationshipContext';

describe('relationship context', () => {
  it('keeps love and established relationship as different stable values', () => {
    expect(getRelationshipContextLabel('romance', 'ru')).toBe('Любовь');
    expect(getRelationshipContextLabel('relationship', 'ru')).toBe('Отношения');
    expect(getRelationshipContextLabel('friendship', 'ru')).toBe('Дружба');
    expect(getRelationshipContextLabel('work', 'ru')).toBe('Работа');
    expect(getRelationshipContextLabel('family', 'ru')).toBe('Семья');
    expect(normalizeRelationshipContext('unknown')).toBe('romance');
  });

  it('keeps Love focused on attraction and separates an established relationship', () => {
    expect(getRelationshipContextOption('romance').hint.ru).toBe('Симпатия, влечение, начало отношений');
    expect(getRelationshipContextOption('romance').hint.ru).not.toContain('бывшие');
    expect(getRelationshipContextOption('relationship').hint.ru).toBe('Существующая пара и совместная жизнь');
  });

  it('changes the practical reading instead of forcing romance into every pair', () => {
    const romance = buildLocalSignCompatibility('aries', 'libra', 'ru', 'female', 'male', 'romance');
    const relationship = buildLocalSignCompatibility('aries', 'libra', 'ru', 'female', 'male', 'relationship');
    const work = buildLocalSignCompatibility('aries', 'libra', 'ru', 'female', 'male', 'work');

    expect(romance?.attraction).toContain('В любви');
    expect(relationship?.attraction).toContain('В отношениях');
    expect(work?.attraction).toContain('В работе');
    expect(work?.communication).toContain('роли и сроки');
    expect(work?.attraction).not.toContain('Его инициатива');
  });

  it('labels a date-only person portrait as general rather than exact', () => {
    const snapshot = buildLocalPersonSnapshot('scorpio', 'ru', 'friendship', 'male');
    expect(snapshot?.headline).toContain('сначала о человеке');
    expect(snapshot?.contextLine).toContain('В дружбе');
    expect(snapshot?.limitation).toContain('общий портрет по дате рождения');
  });
});
