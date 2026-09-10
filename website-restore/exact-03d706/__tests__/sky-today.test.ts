import {
  SKY_MOON_PHASE_KEYS,
  calculateMoonPhaseFromLongitudes,
  getSkyTodayNarrative,
  type SkyTodaySnapshot,
} from '../lib/skyToday';

const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

function snapshot(input: Partial<SkyTodaySnapshot['mercury']> = {}): SkyTodaySnapshot {
  return {
    date: '2026-07-01',
    moon: {
      sign: 'Gemini',
      degree: 8.42,
      phaseKey: 'waning-crescent',
      phaseLabel: 'Убывающий серп',
      illumination: 4,
    },
    mercury: {
      sign: 'Leo',
      degree: 15.17,
      retrograde: false,
      motionLabel: 'прямой',
      speedLongitude: 1.12,
      ...input,
    },
    source: 'swisseph',
  };
}

describe('sky today calculations', () => {
  it.each([
    [0, 'new-moon'],
    [90, 'first-quarter'],
    [180, 'full-moon'],
    [270, 'last-quarter'],
  ] as const)('derives %s° phase from Moon minus Sun longitude', (elongation, phaseKey) => {
    const phase = calculateMoonPhaseFromLongitudes(245, 245 + elongation);
    expect(phase.elongation).toBe(elongation);
    expect(phase.phaseKey).toBe(phaseKey);
  });

  it('derives illumination from the same elongation', () => {
    expect(calculateMoonPhaseFromLongitudes(120, 120).illumination).toBe(0);
    expect(calculateMoonPhaseFromLongitudes(120, 300).illumination).toBe(100);
  });

  it('normalizes a negative Moon minus Sun angle', () => {
    expect(calculateMoonPhaseFromLongitudes(20, 10)).toMatchObject({
      elongation: 350,
      phaseKey: 'new-moon',
    });
  });
});
describe('sky today deterministic copy', () => {
  const forbidden = [
    'не спеши', 'не распыляйся', 'выбери одно дело', 'замедлись',
    'доверься себе', 'энергия луны', 'вселенная подсказывает', 'меркурий заставит',
  ];

  it('provides five non-repeating Moon variants for every phase and sign combination', () => {
    for (const phaseKey of SKY_MOON_PHASE_KEYS) {
      for (const sign of SIGNS) {
        const variants = Array.from({ length: 5 }, (_, index) => getSkyTodayNarrative({
          ...snapshot(),
          date: `2026-07-0${index + 1}`,
          moon: { ...snapshot().moon, phaseKey, sign },
        }, 'ru').moonDescription);
        expect(new Set(variants).size).toBe(5);
      }
    }
  });

  it('provides five non-repeating Mercury variants for every sign and motion status', () => {
    for (const sign of SIGNS) {
      for (const retrograde of [false, true]) {
        const variants = Array.from({ length: 5 }, (_, index) => getSkyTodayNarrative({
          ...snapshot({ sign, retrograde }),
          date: `2026-07-0${index + 1}`,
        }, 'ru').mercuryDescription);
        expect(new Set(variants).size).toBe(5);
      }
    }
  });

  it('keeps the prepared copy free from banned astrology clichés', () => {
    const allCopy: string[] = [];
    for (const phaseKey of SKY_MOON_PHASE_KEYS) {
      for (const sign of SIGNS) {
        for (let index = 0; index < 5; index += 1) {
          const copy = getSkyTodayNarrative({
            ...snapshot({ sign, retrograde: index % 2 === 0 }),
            date: `2026-07-0${index + 1}`,
            moon: { ...snapshot().moon, phaseKey, sign },
          }, 'ru');
          allCopy.push(copy.moonDescription, copy.mercuryDescription);
        }
      }
    }
    const normalized = allCopy.join(' ').toLowerCase();
    forbidden.forEach((phrase) => expect(normalized).not.toContain(phrase));
  });
});
