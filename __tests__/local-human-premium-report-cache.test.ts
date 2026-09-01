import {
  NATAL_PERMANENT_CONTRACT_VERSION,
  buildNatalReportScopeKey,
  type NatalPermanentPremiumReport,
} from '../lib/natalReading/permanentReport';
import {
  clearHumanReadingSessionCache,
  getHumanPremiumReportCached,
  type NatalReportCacheIdentity,
} from '../services/natalReadingService';

const identity: NatalReportCacheIdentity = {
  chartFingerprint: 'chart-fingerprint-a',
  reportVersion: NATAL_PERMANENT_CONTRACT_VERSION,
};
const evidenceId = 'natal.position.sun';
const statement = (text: string) => ({ text, evidenceIds: [evidenceId] });
const report: NatalPermanentPremiumReport = {
  schemaVersion: 'natal-permanent-premium-v2',
  contractVersion: NATAL_PERMANENT_CONTRACT_VERSION,
  tier: 'premium',
  headline: 'Полная карта',
  headlineEvidenceIds: [evidenceId],
  lead: statement('Полный вводный результат.'),
  sections: [{
    id: 'relationships',
    title: 'Отношения и семья',
    paragraphs: [statement('Полный разбор отношений.')],
  }, {
    id: 'work',
    title: 'Работа и своё дело',
    paragraphs: [statement('Полный разбор работы.')],
  }],
  strategies: [],
  pitfalls: [],
  conclusion: statement('Итог полного разбора.'),
  evidenceIds: [evidenceId],
};

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
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage },
    writable: true,
    configurable: true,
  });
  return localStorage;
}

function storageKey(scopeKey: string): string {
  return `lumia:natal-human-premium:v1:${encodeURIComponent(scopeKey)}`;
}

describe('local human Premium report cache', () => {
  beforeEach(() => {
    clearHumanReadingSessionCache();
    installLocalStorage();
  });

  afterEach(() => {
    clearHumanReadingSessionCache();
    delete (globalThis as { window?: Window }).window;
  });

  it('restores a valid opened report synchronously for the same chart identity', () => {
    const scopeKey = buildNatalReportScopeKey('user-1', 42, 'ru', identity);
    window.localStorage.setItem(storageKey(scopeKey), JSON.stringify({
      schemaVersion: 1,
      scopeKey,
      report,
      updatedAt: '2026-09-01T00:00:00.000Z',
    }));

    expect(getHumanPremiumReportCached('user-1', 42, 'ru', identity)).toEqual({
      content: report,
      accessTier: 'premium',
    });
  });

  it('does not reuse Premium content across another chart fingerprint', () => {
    const scopeKey = buildNatalReportScopeKey('user-1', 42, 'ru', identity);
    window.localStorage.setItem(storageKey(scopeKey), JSON.stringify({
      schemaVersion: 1,
      scopeKey,
      report,
      updatedAt: '2026-09-01T00:00:00.000Z',
    }));

    expect(getHumanPremiumReportCached('user-1', 42, 'ru', {
      ...identity,
      chartFingerprint: 'chart-fingerprint-b',
    })).toBeNull();
  });

  it('rejects corrupted or incomplete local Premium content', () => {
    const scopeKey = buildNatalReportScopeKey('user-1', 42, 'ru', identity);
    window.localStorage.setItem(storageKey(scopeKey), JSON.stringify({
      schemaVersion: 1,
      scopeKey,
      report: {
        ...report,
        sections: report.sections.filter((section) => section.id !== 'work'),
      },
      updatedAt: '2026-09-01T00:00:00.000Z',
    }));

    expect(getHumanPremiumReportCached('user-1', 42, 'ru', identity)).toBeNull();
    expect(window.localStorage.removeItem).toHaveBeenCalledWith(storageKey(scopeKey));
  });
});
