import type { NatalInterpretationReport, UserProfile } from '../types';
import {
  buildLocalHumanBaseReportCacheKey,
  clearLocalHumanBaseReport,
  readLocalHumanBaseReport,
  readLocalHumanBaseReportWithFallback,
  writeLocalHumanBaseReport,
} from '../lib/localHumanBaseReportCache';
import { HUMAN_BASE_PROMPT_VERSION } from '../lib/natalHumanShared';

const profile: UserProfile = {
  id: 'user-1', name: 'Test', birthDate: '1990-01-02', birthTime: '03:04', birthPlace: 'Moscow',
  isSetup: true, language: 'ru', theme: 'light', isPremium: false,
};
const report = {
  userName: 'Test', birthData: { birthDate: '1990-01-02', birthTime: '03:04', birthPlace: 'Moscow' },
  shortCard: { title: 'Title', text: 'Text', keywords: [], advice: 'Advice' }, freeSections: [],
} as unknown as NatalInterpretationReport;

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

  it('persists the report with identity, chart and prompt metadata', () => {
    writeLocalHumanBaseReport(profile, report, 42);
    const raw = window.localStorage.getItem(buildLocalHumanBaseReportCacheKey(profile, 42));
    expect(JSON.parse(raw as string)).toMatchObject({
      schemaVersion: 1, userId: 'user-1', chartId: 42, birthDate: profile.birthDate,
      birthTime: profile.birthTime, birthPlace: profile.birthPlace, promptVersion: HUMAN_BASE_PROMPT_VERSION, report,
    });
    expect(readLocalHumanBaseReport(profile, 42)).toEqual(report);
  });

  it('falls back from a resolved chart ID to the primary report', () => {
    writeLocalHumanBaseReport(profile, report);
    expect(readLocalHumanBaseReportWithFallback(profile, 42)).toEqual(report);
  });

  it('invalidates when birth data changed', () => {
    writeLocalHumanBaseReport(profile, report);
    expect(readLocalHumanBaseReport({ ...profile, birthDate: '1991-01-02' })).toBeNull();
    expect(readLocalHumanBaseReport({ ...profile, birthTime: '05:06' })).toBeNull();
    expect(readLocalHumanBaseReport({ ...profile, birthPlace: 'London' })).toBeNull();
  });

  it('clears all birth-data variants for a profile/chart', () => {
    writeLocalHumanBaseReport(profile, report, 42);
    writeLocalHumanBaseReport({ ...profile, birthPlace: 'London' }, report, 42);
    clearLocalHumanBaseReport(profile, 42);
    expect(readLocalHumanBaseReport(profile, 42)).toBeNull();
    expect(readLocalHumanBaseReport({ ...profile, birthPlace: 'London' }, 42)).toBeNull();
  });
});
