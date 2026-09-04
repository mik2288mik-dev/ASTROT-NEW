import fs from 'fs';
import path from 'path';

const mockApiFetch = jest.fn();

jest.mock('../services/apiClient', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));
jest.mock('../services/sessionService', () => ({
  getTelegramInitDataHeaders: () => ({ 'X-Telegram-Init-Data': 'signed' }),
}));
jest.mock('../lib/localNatalChartCache', () => ({
  writeLocalNatalChart: jest.fn(),
}));

import { getChartFromDB, getPrimaryChartId } from '../services/chartService';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

function chartData(sign: string) {
  const chart = canonicalNatalChart({ time: {
    mode: 'unknown', localTime: null, uncertaintyMinutes: null, rangeStart: null, rangeEnd: null,
  } });
  chart.positions.sun.sign = sign;
  return chart;
}

describe('forecast and synastry access integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads only the session-owned self chart without putting a user id in the request URL', async () => {
    const savedPerson = {
      id: 20,
      subject_type: 'saved_person',
      is_primary: false,
      chart_data: chartData('Libra'),
    };
    const self = {
      id: 10,
      subject_type: 'self',
      is_primary: true,
      chart_data: chartData('Aries'),
    };
    mockApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ charts: [savedPerson, self] }),
    });

    await expect(getPrimaryChartId('1001')).resolves.toBe(10);
    await expect(getChartFromDB('1001')).resolves.toMatchObject({
      positions: { sun: { sign: 'Aries' } },
    });

    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    for (const [index, [url, options, timeout]] of mockApiFetch.mock.calls.entries()) {
      expect(url).toBe('/api/charts?repairPrimary=0');
      expect(String(url)).not.toContain('1001');
      expect(options).toMatchObject({
        method: 'GET',
        credentials: 'include',
      });
      expect(timeout).toBe(index === 0 ? 8_000 : 10_000);
    }
  });

  it('authenticates personal forecasts and derives the canonical profile from the session', () => {
    const route = read('pages/api/content/forecast/personal.ts');
    expect(route).toContain('requireAppUser(req, { allowGuest: true })');
    expect(route).toContain('const userId = String(auth.userId)');
    expect(route).not.toContain('claimedUserId');
    expect(route).toContain('getPremiumEntitlementState(userId)');
    expect(route).toContain('db.users.get(userId, { hydratePrimaryChart: false })');
    expect(route).toContain('birthProfileRepository.get(userId)');
    expect(route).toContain('buildPersonalForecastPrewarmProfile(userId, user, birthSettings)');

    const service = read('services/personalForecastService.ts');
    const buildUrlStart = service.indexOf('function buildUrl');
    const parseErrorStart = service.indexOf('async function parseError', buildUrlStart);
    const buildUrl = service.slice(buildUrlStart, parseErrorStart);
    expect(buildUrl).not.toContain('userId:');
    expect(buildUrl).not.toContain('chartId');

    const generationStart = service.indexOf('function generationRequest');
    const generationEnd = service.indexOf('async function generate', generationStart);
    const request = service.slice(generationStart, generationEnd);
    expect(request).not.toContain('userId');
    expect(request).not.toContain('chartId');
    expect(request).not.toContain('chartData');
  });

  it('derives synastry identity from the session and validates both selected charts on the server', () => {
    const route = read('pages/api/content/synastry/extended.ts');
    expect(route).toContain('auth = await requireAppUser(req)');
    expect(route).not.toContain('claimedUserId');
    expect(route).not.toContain('expectedUserId');
    expect(route).toContain('String(partnerChartRecord.user_id) !== userId');
    expect(route).toContain('String(primaryChartRecord.user_id) !== userId');
    expect(route).toContain('assertChartReadable(primaryChartRecord, isPremium, accessibleCharts)');
    expect(route).toContain('assertChartReadable(partnerChartRecord, isPremium, accessibleCharts)');
    expect(route).toContain('partnerChartRecord.id === primaryChartRecord.id');
    expect(route).toContain('partnerChartRecord?.birth_date || partnerDate');

    const service = read('services/astrologyService.ts');
    const start = service.indexOf('export const calculateExtendedSynastry');
    const end = service.indexOf('export const updateUserEvolution', start);
    const request = service.slice(start, end);
    expect(request).not.toContain('userId:');
    expect(request).not.toContain('profile,\n');
    expect(request).toContain('partnerChartId');
    expect(request).toContain('subjectChartId');
  });

  it('keeps legacy saved-person filtering and exposes every readable saved chart in the pair selector', () => {
    const view = read('views/Synastry.tsx');
    expect(view).toContain("chart.subject_type === 'saved_person'");
    expect(view).toContain('!chart.archived_at');
    expect(view).toContain('!chart.access_locked');
    expect(view).toContain('readOnly={partnerChartId != null}');

    const unionRoom = read('views/v2/UnionRoom.tsx');
    expect(unionRoom).toContain('!chart.archived_at');
    expect(unionRoom).toContain('!chart.access_locked');
    expect(unionRoom).toContain('<PersonSourcePicker');
    expect(unionRoom).toContain('charts={availableCharts}');
    expect(unionRoom).toContain('charts.map');
    expect(unionRoom).toContain("selected?.kind !== 'person'");
    expect(unionRoom).toContain('setSelected(null)');
    expect(unionRoom).toContain("setScreen('add')");
  });
});
