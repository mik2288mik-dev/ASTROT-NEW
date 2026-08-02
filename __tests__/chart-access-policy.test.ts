import {
  assertCanCreateSavedPerson,
  assertChartCanBeArchived,
  assertChartReadable,
  exposeChartAccess,
  getChartSubjectType,
  getEffectiveChartLimit,
} from '../lib/chartAccessPolicy';

const self = { id: 1, subject_type: 'self', is_primary: true } as const;
const saved = { id: 2, subject_type: 'saved_person', is_primary: false, relation_label: '  close   friend  ' } as const;

describe('chart identity and access policy', () => {
  it('keeps one immutable self chart and derives limits from the live entitlement', () => {
    expect(getEffectiveChartLimit(false)).toBe(1);
    expect(getEffectiveChartLimit(true)).toBe(5);
    expect(getChartSubjectType({ is_primary: true })).toBe('self');
    expect(getChartSubjectType({ is_primary: false })).toBe('saved_person');

    expect(() => assertCanCreateSavedPerson([self], false)).toThrow(
      expect.objectContaining({ code: 'PREMIUM_REQUIRED' }),
    );
    expect(() => assertCanCreateSavedPerson([self], true)).not.toThrow();
    expect(() => assertCanCreateSavedPerson([self, saved, { id: 3 }, { id: 4 }, { id: 5 }], true)).toThrow(
      expect.objectContaining({ code: 'CHART_LIMIT_REACHED' }),
    );
    expect(() => assertChartCanBeArchived(self)).toThrow(
      expect.objectContaining({ code: 'SELF_CHART_IMMUTABLE' }),
    );
  });

  it('locks saved people after Premium expiry without hiding or deleting their metadata', () => {
    expect(() => assertChartReadable(self, false)).not.toThrow();
    expect(() => assertChartReadable(saved, false)).toThrow(
      expect.objectContaining({ code: 'PREMIUM_REQUIRED' }),
    );
    expect(() => assertChartReadable(saved, true)).not.toThrow();

    expect(exposeChartAccess(saved, false)).toMatchObject({
      id: 2,
      subject_type: 'saved_person',
      relation_label: 'close friend',
      access_locked: true,
    });
    expect(exposeChartAccess(saved, true).access_locked).toBe(false);
  });
});
