import { normalizeChartListItem } from '../services/storageService';

describe('saved chart time boundary', () => {
  it('normalizes PostgreSQL TIME before a saved chart is opened for editing', () => {
    const chart = normalizeChartListItem({
      id: 9,
      user_id: '42',
      name: 'Друг',
      chart_data: {} as any,
      birth_date: '1990-01-02T00:00:00.000Z',
      birth_time: '08:45:00',
      birth_place: 'Москва',
      is_primary: false,
    });
    expect(chart.birth_date).toBe('1990-01-02');
    expect(chart.birth_time).toBe('08:45');
  });
});
