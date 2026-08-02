import type { NatalChartData, NatalInterpretationReport, UserProfile } from '../types';
import {
  buildLocalHumanBaseReportCacheKey,
  clearLocalHumanBaseReport,
  readLocalHumanBaseReport,
  readLocalHumanBaseReportWithFallback,
  writeLocalHumanBaseReport,
  type HumanBaseReportCacheContext,
} from '../lib/localHumanBaseReportCache';
import { HUMAN_BASE_PROMPT_VERSION } from '../lib/natalHumanShared';

const profile: UserProfile = {
  id: 'user-1', name: 'Owner', birthDate: '1990-01-02', birthTime: '03:04', birthPlace: 'Moscow',
  isSetup: true, language: 'ru', theme: 'light', isPremium: true,
};
const report = {
  userName: 'Saved person', birthData: { birthDate: '1992-02-03', birthTime: '04:05', birthPlace: 'London' },
  shortCard: { title: 'Title', text: 'Text', keywords: [], advice: 'Advice' }, freeSections: [],
} as unknown as NatalInterpretationReport;
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
      schemaVersion: 2,
      ownerUserId: 'user-1',
      subjectScope: 'saved:42',
      chartAlias: 42,
      subjectName: 'Alex',
      inputHash: 'hash-Alex',
      calculationVersion: 'natal-v1',
      promptVersion: HUMAN_BASE_PROMPT_VERSION,
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

  it('clears only the requested subject scope', () => {
    const context = savedContext('Alex');
    writeLocalHumanBaseReport(profile, report, 42, context);
    writeLocalHumanBaseReport(profile, report, 43, savedContext('Sam'));
    clearLocalHumanBaseReport(profile, 42, context);
    expect(readLocalHumanBaseReport(profile, 42, context)).toBeNull();
    expect(readLocalHumanBaseReport(profile, 43, savedContext('Sam'))).toEqual(report);
  });
});
