
import { createMocks } from 'node-mocks-http';
import handler from '../pages/api/astrology/natal-chart';
import { db } from '../lib/db';
import * as calculator from '../lib/swisseph-calculator';
import * as serverLocks from '../lib/serverLocks';

// Mock dependencies
jest.mock('../lib/db', () => ({
  db: {
    charts: {
      needsRecalculation: jest.fn(),
      set: jest.fn(),
      get: jest.fn(),
    },
  },
}));

jest.mock('../lib/swisseph-calculator', () => ({
  calculateNatalChart: jest.fn(),
}));

jest.mock('../lib/serverLocks', () => ({
  tryAcquireLock: jest.fn(),
  releaseLock: jest.fn(),
  LockKeys: {
    natalChartCalculation: (id: string) => `lock:${id}`,
  },
}));

describe('API Natal Chart Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (serverLocks.tryAcquireLock as jest.Mock).mockReturnValue(true);
  });

  it('should return 405 for non-POST requests', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
  });

  it('should return 400 for invalid input', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        // Missing name and birthPlace
        birthDate: '1990-01-01',
      },
    });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
    const data = JSON.parse(res._getData());
    expect(data.error).toBe('Validation failed');
  });

  it('should return cached chart if available', async () => {
    const mockChart = { chart_data: { sun: { sign: 'Aries' } } };
    (db.charts.needsRecalculation as jest.Mock).mockResolvedValue({
      needsCalc: false,
      existingChart: mockChart,
      reason: 'CACHE_HIT',
    });

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        userId: 'user123',
        name: 'Test',
        birthDate: '1990-01-01',
        birthTime: '12:00',
        birthPlace: 'City',
      },
    });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.sun.sign).toBe('Aries');
    expect(calculator.calculateNatalChart).not.toHaveBeenCalled();
  });

  it('should calculate and save chart if not cached', async () => {
    (db.charts.needsRecalculation as jest.Mock).mockResolvedValue({
      needsCalc: true,
      reason: 'NO_EXISTING_CHART',
    });

    const mockCalculatedChart = {
      sun: { sign: 'Leo' },
      moon: { sign: 'Virgo' },
      rising: { sign: 'Libra' },
    };
    (calculator.calculateNatalChart as jest.Mock).mockResolvedValue(mockCalculatedChart);

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        userId: 'user123',
        name: 'Test',
        birthDate: '1990-01-01',
        birthTime: '12:00',
        birthPlace: 'City',
      },
    });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.sun.sign).toBe('Leo');
    
    expect(calculator.calculateNatalChart).toHaveBeenCalledWith(
      'Test', '1990-01-01', '12:00', 'City'
    );
    expect(db.charts.set).toHaveBeenCalled();
  });

  it('should handle calculation errors gracefully', async () => {
    (db.charts.needsRecalculation as jest.Mock).mockResolvedValue({
      needsCalc: true,
      reason: 'NO_EXISTING_CHART',
    });

    (calculator.calculateNatalChart as jest.Mock).mockRejectedValue(new Error('Calculation failed'));

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        userId: 'user123',
        name: 'Test',
        birthDate: '1990-01-01',
        birthTime: '12:00',
        birthPlace: 'City',
      },
    });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(500);
    const data = JSON.parse(res._getData());
    expect(data.error).toBe('Calculation failed');
  });

  it('should handle location not found error specifically', async () => {
    (db.charts.needsRecalculation as jest.Mock).mockResolvedValue({
      needsCalc: true,
      reason: 'NO_EXISTING_CHART',
    });

    (calculator.calculateNatalChart as jest.Mock).mockRejectedValue(new Error('Location not found: Unknown City'));

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        userId: 'user123',
        name: 'Test',
        birthDate: '1990-01-01',
        birthPlace: 'Unknown City',
        language: 'en'
      },
    });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(400); // Should be 400 Bad Request
    const data = JSON.parse(res._getData());
    expect(data.message).toContain('Location not found');
  });
  
  it('should fail if DB save fails', async () => {
      (db.charts.needsRecalculation as jest.Mock).mockResolvedValue({
        needsCalc: true,
        reason: 'NO_EXISTING_CHART',
      });
  
      const mockCalculatedChart = {
        sun: { sign: 'Leo' },
        moon: { sign: 'Virgo' },
        rising: { sign: 'Libra' },
      };
      (calculator.calculateNatalChart as jest.Mock).mockResolvedValue(mockCalculatedChart);
      (db.charts.set as jest.Mock).mockRejectedValue(new Error('DATABASE_URL is not configured'));
  
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: 'user123',
          name: 'Test',
          birthDate: '1990-01-01',
          birthTime: '12:00',
          birthPlace: 'City',
        },
      });
  
      await handler(req as any, res as any);
  
      expect(res._getStatusCode()).toBe(500);
      const data = JSON.parse(res._getData());
      // Even if DB save fails, we might want to return the chart to the user but log the error?
      // Currently the code catches the error and returns 500.
      expect(data.error).toBe('Calculation failed');
    });
});
