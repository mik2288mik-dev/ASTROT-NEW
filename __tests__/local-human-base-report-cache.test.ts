import type { NatalChartData, UserProfile } from '../types';
import type { NatalPermanentFreeReport } from '../lib/natalReading/permanentReport';
import {
  buildLocalHumanBaseReportCacheKey,
  clearLocalHumanBaseReport,
  readLocalHumanBaseReport,
  readLocalHumanBaseReportWithFallback,
  writeLocalHumanBaseReport,
  type HumanBaseReportCacheContext,
} from '../lib/localHumanBaseReportCache';
import { NATAL_PERMANENT_FREE_PROMPT_VERSION } from '../lib/natalReading/permanentReport';

const profile: UserProfile = {
  id: 'user-1', name: 'Owner', birthDate: '1990-01-02', birthTime: '03:04', birthPlace: 'Moscow',
  isSetup: true, language: 'ru', theme: 'light', isPremium: true,
};
const report = {
  schemaVersion: 'natal-permanent-free-v3',
  contractVersion: 'natal-permanent-report-v7',
  tier: 'free',
  evidenceIds: ['natal.position.sun'],
  hook: {
    text: 'You notice quickly when a discussion loses its point and bring it back to the decision.',
    evidenceIds: ['natal.position.sun'],
  },
  userName: 'Saved person', birthData: { birthDate: '1992-02-03', birthTime: '04:05', birthPlace: 'London' },
  calculatedAt: '2026-08-13T00:00:00.000Z',
  shortCard: { title: 'Title', text: 'Text', keywords: [], advice: 'Advice' },
  freeSections: [{
    key: 'base_portrait', title: 'Title', access: 'free', content: 'Complete portrait',
    evidenceIds: ['natal.position.sun'],
  }],
  paidSections: [],
  premiumSections: [],
} as NatalPermanentFreeReport;
const chart = {
  sun: { sign: 'Aries', degree: 1 }, moon: { sign: 'Taurus', degree: 2 }, rising: { sign: 'Gemini', degree: 3 },
  mercury: { sign: 'Aries', degree: 4 }, venus: { sign: 'Taurus', degree: 5 }, mars: { sign: 'Gemini', degree: 6 },
  jupiter: { sign: 'Cancer', degree: 7 }, saturn: { sign: 'Leo', degree: 8 }, uranus: { sign: 'Virgo', degree: 9 },
  neptune: { sign: 'Libra', degree: 10 }, pluto: { sign: 'Scorpio', degree: 11 },
  element: 'Fire', rulingPlanet: 'Mars', summary: '', calculationVersion: 'natal-v1',
} as NatalChartData;
const savedContext = (name: string, chartData: NatalChartData = chart): HumanBaseReportCacheContext => ({
  subjectType: 'saved_person',
  subjectIdentity: { name, birthDate: '1992-02-03', birthTime: '04:05', birthPlace: 'London' },
  chartData,
  inputHash: `hash-${name}`,
  calculationVersion: 'natal-v1',
});

function installLocalStorage() {
  let store: Record<string, string> = {};
  const localStorage = {
    get length() { return Object.keys(store).length; },
    key: jest.fn((index: number) => Object.keys(store)[index] ?? null),
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
  };
  Object.defineProperty(globalThis, 'window', { value: { localStorage }, writable: true, configurable: true });
}

describe('local human-base report cache', () => {
  beforeEach(installLocalStorage);
  afterEach(() => delete (globalThis as any).window);

  it('persists owner, saved subject, calculation and chart identity separately', () => {
    const context = savedContext('Alex');
    writeLocalHumanBaseReport(profile, report, 42, context);
    const raw = window.localStorage.getItem(buildLocalHumanBaseReportCacheKey(profile, 42, context));
    expect(JSON.parse(raw as string)).toMatchObject({
      schemaVersion: 3,
      ownerUserId: 'user-1',
      language: 'ru',
      subjectScope: 'saved:42',
      chartAlias: 42,
      subjectName: 'Alex',
      inputHash: 'hash-Alex',
      calculationVersion: 'natal-v1',
      promptVersion: NATAL_PERMANENT_FREE_PROMPT_VERSION,
      report,
    });
    expect(readLocalHumanBaseReport(profile, 42, context)).toEqual(report);
  });

  it('allows the primary unresolved alias fallback only for self', () => {
    const selfContext = { subjectType: 'self' as const, chartData: chart };
    writeLocalHumanBaseReport(profile, report, undefined, selfContext);
    expect(readLocalHumanBaseReportWithFallback(profile, 42, selfContext)).toEqual(report);
    expect(readLocalHumanBaseReportWithFallback(profile, 42, savedContext('Alex'))).toBeNull();
  });

  it('misses when a saved chart fingerprint changes', () => {
    const initial = savedContext('Alex');
    writeLocalHumanBaseReport(profile, report, 42, initial);
    const changed = { ...chart, moon: { ...chart.moon, degree: 22 } } as NatalChartData;
    expect(readLocalHumanBaseReport(profile, 42, savedContext('Alex', changed))).toBeNull();
  });

  it('does not collide saved people with different chart IDs', () => {
    writeLocalHumanBaseReport(profile, report, 42, savedContext('Alex'));
    expect(readLocalHumanBaseReport(profile, 43, savedContext('Alex'))).toBeNull();
  });

  it('does not reuse a permanent reading across languages', () => {
    const context = savedContext('Alex');
    writeLocalHumanBaseReport(profile, report, 42, context);
    expect(readLocalHumanBaseReport({ ...profile, language: 'en' }, 42, context)).toBeNull();
  });

  it('clears only the requested subject scope', () => {
    const context = savedContext('Alex');
    writeLocalHumanBaseReport(profile, report, 42, context);
    writeLocalHumanBaseReport(profile, report, 43, savedContext('Sam'));
    clearLocalHumanBaseReport(profile, 42, context);
    expect(readLocalHumanBaseReport(profile, 42, context)).toBeNull();
    expect(readLocalHumanBaseReport(profile, 43, savedContext('Sam'))).toEqual(report);
  });
});
