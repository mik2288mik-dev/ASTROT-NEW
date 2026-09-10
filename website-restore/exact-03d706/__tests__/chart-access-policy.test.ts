import {
  assertCanCreateSavedPerson, assertChartCanBeArchived, assertChartReadable,
  exposeChartAccess, getAccessibleSavedPersonIds, getChartSubjectType,
  getEffectiveChartLimit, PREMIUM_SAVED_PERSON_LIMIT,
} from '../lib/chartAccessPolicy';

const self = { id: 1, subject_type: 'self', is_primary: true } as const;
const people = Array.from({ length: 21 }, (_, index) => ({
  id: index + 2, subject_type: 'saved_person', is_primary: false,
  relation_label: '  close   friend  ',
}));

describe('chart identity and access policy', () => {
  it('allows one additional Free person and twenty additional Premium people', () => {
    expect(getEffectiveChartLimit(false)).toBe(2);
    expect(PREMIUM_SAVED_PERSON_LIMIT).toBe(20);
    expect(getEffectiveChartLimit(true)).toBe(21);
    expect(getChartSubjectType({ is_primary: true })).toBe('self');
    expect(getChartSubjectType({ is_primary: false })).toBe('saved_person');
    expect(() => assertCanCreateSavedPerson([self], false)).not.toThrow();
    expect(() => assertCanCreateSavedPerson([self, people[0]], false)).toThrow(
      expect.objectContaining({ code: 'CHART_LIMIT_REACHED' }),
    );
    expect(() => assertCanCreateSavedPerson([self, ...people.slice(0, 19)], true)).not.toThrow();
    expect(() => assertCanCreateSavedPerson([self, ...people.slice(0, 20)], true)).toThrow(
      expect.objectContaining({ code: 'CHART_LIMIT_REACHED' }),
    );
    expect(() => assertCanCreateSavedPerson([], true)).toThrow(
      expect.objectContaining({ code: 'SELF_CHART_REQUIRED' }),
    );
    expect(() => assertChartCanBeArchived(self)).toThrow(
      expect.objectContaining({ code: 'SELF_CHART_IMMUTABLE' }),
    );
  });

  it('keeps the oldest person readable after expiry and restores twenty on renewal', () => {
    const charts = [self, ...people.slice(0, 20).reverse()];
    expect(() => assertChartReadable(self, false)).not.toThrow();
    expect(() => assertChartReadable(people[0], false, charts)).not.toThrow();
    expect(() => assertChartReadable(people[1], false, charts)).toThrow(
      expect.objectContaining({ code: 'PREMIUM_REQUIRED' }),
    );
    const snapshot = JSON.stringify(charts);
    const locked = exposeChartAccess({
      ...people[1], chart_data: { sun: { sign: 'Libra' } },
      aspects: [{ type: 'trine' }], input_hash: 'private-calculation-hash',
    }, false, charts);
    expect(locked).toMatchObject({ id: 3, relation_label: 'close friend', access_locked: true });
    expect(locked).not.toHaveProperty('chart_data');
    expect(locked).not.toHaveProperty('aspects');
    expect(locked).not.toHaveProperty('input_hash');
    expect(JSON.stringify(charts)).toBe(snapshot);
    expect(charts.map((chart) => exposeChartAccess(chart, true, charts).access_locked)).not.toContain(true);
  });

  it('uses stable creation order, ignores archived people and locks excess Premium rows', () => {
    const charts = [self, ...people];
    expect(() => assertChartReadable(people[20], true, charts)).toThrow(
      expect.objectContaining({ code: 'CHART_LIMIT_REACHED' }),
    );
    expect(getAccessibleSavedPersonIds([
      { ...people[0], created_at: '2026-08-02T10:00:00Z' },
      { ...people[1], created_at: '2026-08-01T10:00:00Z' },
    ], false)).toEqual(new Set([3]));
    expect(getAccessibleSavedPersonIds([
      { ...people[0], archived_at: '2026-08-02T10:00:00Z' }, people[1],
    ], false)).toEqual(new Set([3]));
    expect(() => assertChartReadable(people[0], true)).toThrow();
    expect(() => assertChartReadable({ ...people[0], archived_at: '2026-08-02' }, true, charts)).toThrow(
      expect.objectContaining({ code: 'CHART_ARCHIVED' }),
    );
  });
});