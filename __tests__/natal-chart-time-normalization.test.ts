import { normalizeBirthTimeInput } from '../lib/natalChartCanonical';

describe('canonical natal chart time normalization', () => {
  it('normalizes PostgreSQL TIME values before canonical chart repair', () => {
    expect(normalizeBirthTimeInput('08:45:00')).toBe('08:45');
    expect(normalizeBirthTimeInput('08:45:00.000')).toBe('08:45');
  });
});
