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
  it('contains only personal cats, capybaras, objects and text-free editorial-v2 assets', () => {
    const library = getPersonalForecastEditorialVisualLibrary();

    expect(library.length).toBeGreaterThan(0);
    expect(library.every(isPersonalForecastEditorialAsset)).toBe(true);
    expect(library.some((asset) => asset.collection === 'main')).toBe(false);
    expect(library.some((asset) => (
      asset.path.startsWith('/assets/forecast-feed/editorial-stickers/')
    ))).toBe(false);

    for (const asset of library) {
      if (asset.collection === 'diary-mascot') {
        expect(asset.slug).toMatch(/^(?:cat|capy)_/u);
      } else if (asset.collection === 'diary-object') {
        expect(asset.path).toMatch(/^\/stickers\/objects\/[^/]+\.webp$/u);
      } else {
        if (asset.collection !== 'editorial-v2') {
          throw new Error(`Unexpected personal forecast asset: ${asset.id}`);
        }
        expect(asset.path).toMatch(/^\/stickers\/editorial-v2\//u);
        expect(asset.hasEmbeddedText).toBe(false);
        expect(asset.sourceCategory).not.toBe('fixed_text');
        expect(asset.sourceCategory).not.toBe('newspaper');
      }
    }
  });

  it('keeps paper accents on empty editorial-v2 templates only', () => {
    const templates = getPersonalForecastPaperTemplateLibrary();

    expect(templates.length).toBeGreaterThan(0);
    expect(templates.every((template) => (
      template.hasEmbeddedText === false
      && template.path.startsWith('/stickers/editorial-v2/paper_templates/')
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
