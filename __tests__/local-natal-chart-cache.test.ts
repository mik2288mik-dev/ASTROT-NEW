import type { NatalChartData, UserProfile } from "../types";
import {
  buildNatalChartCacheKey,
  clearLocalNatalChart,
  readLocalNatalChart,
  readLocalNatalChartCache,
  writeLocalNatalChart,
} from "../lib/localNatalChartCache";

const chart: NatalChartData = {
  sun: { planet: "Sun", sign: "Aries", description: "Sun" },
  moon: { planet: "Moon", sign: "Cancer", description: "Moon" },
  rising: { planet: "Ascendant", sign: "Libra", description: "ASC" },
  mercury: null,
  venus: null,
  mars: null,
  element: "Fire",
  rulingPlanet: "Mars",
  summary: "summary",
};

const profile: UserProfile = {
  id: "user-1",
  name: "Test",
  birthDate: "1990-01-02",
  birthTime: "03:04",
  birthPlace: "Moscow",
  isSetup: true,
  language: "ru",
  theme: "light",
  isPremium: false,
};

function installLocalStorage() {
  let store: Record<string, string> = {};
  Object.defineProperty(globalThis, "window", {
    value: {
      localStorage: {
        getItem: jest.fn((key: string) => store[key] ?? null),
        setItem: jest.fn((key: string, value: string) => {
          store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete store[key];
        }),
        clear: jest.fn(() => {
          store = {};
        }),
      },
    },
    writable: true,
    configurable: true,
  });
}

describe("local natal chart cache", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  it("readLocalNatalChart returns valid chart for same profile", () => {
    writeLocalNatalChart(profile, chart, 42);

    expect(readLocalNatalChart(profile)).toEqual(chart);
    expect(readLocalNatalChartCache(profile)?.chartId).toBe(42);
  });

  it("readLocalNatalChart returns null if birth data changed", () => {
    writeLocalNatalChart(profile, chart);

    expect(readLocalNatalChart({ ...profile, birthTime: "05:06" })).toBeNull();
    expect(
      readLocalNatalChart({ ...profile, birthPlace: "London" }),
    ).toBeNull();
    expect(
      readLocalNatalChart({ ...profile, birthDate: "1991-01-02" }),
    ).toBeNull();
  });

  it("does not use another user cache", () => {
    writeLocalNatalChart(profile, chart);

    expect(readLocalNatalChart({ ...profile, id: "user-2" })).toBeNull();
  });

  it("writeLocalNatalChart persists chart", () => {
    writeLocalNatalChart(profile, chart);

    const raw = window.localStorage.getItem(buildNatalChartCacheKey(profile));
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string)).toMatchObject({
      schemaVersion: 1,
      userId: "user-1",
      birthDate: "1990-01-02",
      birthTime: "03:04",
      birthPlace: "Moscow",
      chartData: chart,
    });
  });

  it("corrupted localStorage does not crash", () => {
    window.localStorage.setItem(buildNatalChartCacheKey(profile), "{not-json");

    expect(() => readLocalNatalChart(profile)).not.toThrow();
    expect(readLocalNatalChart(profile)).toBeNull();
  });

  it("clearLocalNatalChart removes only matching profile key", () => {
    writeLocalNatalChart(profile, chart);
    clearLocalNatalChart(profile);

    expect(readLocalNatalChart(profile)).toBeNull();
  });
});
