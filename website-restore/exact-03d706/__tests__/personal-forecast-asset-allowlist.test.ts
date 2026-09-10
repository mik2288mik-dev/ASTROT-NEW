import {
  resolveDiaryEditorialPauses,
  resolveDiaryTodayVisualPlan,
} from '../lib/personalForecastVisuals';
import {
  getPersonalForecastEditorialVisualLibrary,
  getPersonalForecastPaperTemplateLibrary,
  isPersonalForecastEditorialAsset,
} from '../lib/personalForecastVisuals/personalEditorialAllowlist';

describe('personal forecast editorial asset allowlist', () => {
  it('contains only auto-selectable assets from the canonical personal manifest', () => {
    const library = getPersonalForecastEditorialVisualLibrary();

    expect(library.length).toBeGreaterThan(0);
    expect(library.every(isPersonalForecastEditorialAsset)).toBe(true);
    for (const asset of library) {
      expect(asset.collection).toBe('personal-editorial');
      expect(asset.path).toMatch(/^\/assets\/personal-editorial\//u);
      expect(['editorial-v2', 'cat', 'capybara', 'object']).toContain(asset.source);
      expect(asset.hasEmbeddedText).toBe(false);
      expect(asset.productionSelectable).toBe(true);
    }
  });

  it('keeps paper accents on the canonical empty-template manifest only', () => {
    const templates = getPersonalForecastPaperTemplateLibrary();

    expect(templates.length).toBeGreaterThan(0);
    expect(templates.every((template) => (
      template.hasEmbeddedText === false
      && template.path.startsWith('/assets/personal-paper-templates/')
    ))).toBe(true);
  });

  it('keeps both Today plans and Week or Month pauses inside the allowlist', () => {
    for (let day = 1; day <= 31; day += 1) {
      const plan = resolveDiaryTodayVisualPlan({
        userId: 'personal-allowlist-user',
        periodKey: `2026-08-${String(day).padStart(2, '0')}`,
        contractVersion: 'personal-allowlist-contract',
      });
      if (plan.asset) expect(isPersonalForecastEditorialAsset(plan.asset)).toBe(true);
    }

    for (const period of ['week', 'month'] as const) {
      const pauses = resolveDiaryEditorialPauses({
        userId: 'personal-allowlist-user',
        period,
        periodKey: period === 'week' ? '2026-W33' : '2026-08',
        sections: [{
          id: `${period}-overview`,
          kind: 'overview',
          sourceTopicKey: 'overview',
          visualTag: 'overview',
          visualCue: null,
        }],
      });

      expect(pauses).toHaveLength(1);
      expect(isPersonalForecastEditorialAsset(pauses[0].asset)).toBe(true);
    }
  });
});
