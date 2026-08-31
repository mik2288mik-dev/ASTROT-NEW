import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const cssRule = (css: string, selector: string) => {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return '';
  const end = css.indexOf('\n}', start);
  return end < 0 ? css.slice(start) : css.slice(start, end + 2);
};

describe('onboarding viewport contract', () => {
  const onboarding = read('views/Onboarding.tsx');
  const cityAutocomplete = read('components/ui/CityAutocomplete.tsx');
  const globalCss = read('styles/globals.css');
  const onboardingCss = globalCss.slice(globalCss.indexOf('/* ── MEOU first-run onboarding'));

  it('owns its viewport and scroll behavior instead of inheriting page-shell insets', () => {
    expect(onboarding).toContain('className="meou-onboarding antialiased"');
    expect(onboarding).not.toContain('meou-onboarding fresh-page');
    expect(onboarding).not.toContain('meou-onboarding lumia-main-scroll');

    const rootRule = cssRule(onboardingCss, '.meou-onboarding');
    expect(rootRule).toContain('box-sizing: border-box;');
    expect(rootRule).toContain('height: 100%;');
    expect(rootRule).toContain('min-height: 0;');
    expect(rootRule).toContain('max-height: 100%;');
    expect(rootRule).toContain('padding: 0;');
    expect(rootRule).toContain('overflow-y: auto;');
  });

  it('keeps the focused birth input visible while the software keyboard shrinks the viewport', () => {
    expect(onboarding).toContain("page.addEventListener('focusin', handleFocusIn)");
    expect(onboarding).toContain('const visualViewport = window.visualViewport');
    expect(onboarding).toContain("window.addEventListener('resize', handleViewportResize)");
    expect(onboarding).toContain("visualViewport.addEventListener('resize', handleViewportResize)");
    expect(onboarding).toContain('nextViewportHeight < previousViewportHeight - 1');
    expect(onboarding).toContain("activeBirthInput()?.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' })");
    expect(onboarding).toContain('viewportWatchDeadline = window.performance.now() + 1000');
    expect(onboarding).toContain('viewportWatchFrame = window.requestAnimationFrame(watchViewportWhileKeyboardOpens)');
    expect(onboarding).toContain("window.removeEventListener('resize', handleViewportResize)");
    expect(onboarding).toContain("visualViewport.removeEventListener('resize', handleViewportResize)");
  });

  it('associates the shared validation alert with only the invalid field', () => {
    expect(onboarding).toContain("aria-describedby={errorField === 'name' ? 'onboarding-error' : undefined}");
    expect(onboarding).toContain("aria-describedby={errorField === 'date' ? 'onboarding-error' : undefined}");
    expect(onboarding).toContain("aria-describedby={errorField === 'time' ? 'onboarding-error' : undefined}");
    expect(onboarding).toContain("ariaDescribedBy={errorField === 'place' ? 'onboarding-error' : undefined}");
    expect(onboarding).toContain('id="onboarding-error"');
    expect(cityAutocomplete).toContain('aria-describedby={ariaDescribedBy}');
  });

  it('derives every inset once and applies it only inside the onboarding shell', () => {
    const rootRule = cssRule(onboardingCss, '.meou-onboarding');
    const shellRules = onboardingCss.match(/\.meou-onboarding-shell\s*\{[\s\S]*?\n\}/g) || [];

    expect(rootRule).toContain('--meou-safe-top: max(');
    expect(rootRule).toContain('--meou-safe-bottom: max(');
    expect(rootRule).toContain('--meou-safe-left: max(');
    expect(rootRule).toContain('--meou-safe-right: max(');
    expect(shellRules.length).toBeGreaterThanOrEqual(2);
    expect(shellRules.every((rule) => !rule.includes('env(safe-area-inset-'))).toBe(true);
    expect(shellRules.join('\n')).toContain('max(var(--meou-safe-top)');
    expect(shellRules.join('\n')).toContain('max(var(--meou-safe-bottom)');
  });

  it('locks story and choice screens to a two-row shell with shrinkable artwork', () => {
    expect(onboardingCss).toMatch(
      /\.meou-onboarding\[data-onboarding-phase='welcome'\]\s*\{[\s\S]*?overflow-y:\s*hidden;/,
    );
    expect(onboardingCss).toMatch(
      /data-onboarding-phase='welcome'\] \.meou-onboarding-shell\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\);[\s\S]*?height:\s*100%;[\s\S]*?overflow:\s*hidden;/,
    );
    expect(onboardingCss).toContain('grid-template-rows: auto minmax(0, 1fr) auto auto;');
    expect(onboardingCss).toContain('grid-template-rows: minmax(0, 1fr) auto auto;');
    expect(onboardingCss).toMatch(
      /data-onboarding-phase='welcome'\] \.meou-day-art,[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;[\s\S]*?object-fit:\s*contain;/,
    );
  });

  it('has compact contracts for 320x568 and 360x640 while 393x873 uses the base grid', () => {
    expect(onboardingCss).toContain('@media (max-width: 370px)');
    expect(onboardingCss).toContain('@media (max-height: 760px)');
    expect(onboardingCss).toMatch(
      /@media \(max-height: 760px\)[\s\S]*?\.meou-onboarding\[data-onboarding-phase='welcome'\] \.meou-onboarding-shell[\s\S]*?padding-top:\s*max\(var\(--meou-safe-top\), 0\.75rem\);/,
    );
    expect(onboardingCss).toMatch(/\.meou-sign-in\s*\{[\s\S]*?min-height:\s*2\.75rem;/);
    expect(onboardingCss).toMatch(/\.meou-field input,[\s\S]*?min-height:\s*2\.75rem;/);
    expect(onboardingCss).toMatch(/\.meou-time-mode button\s*\{[\s\S]*?min-height:\s*2\.75rem;/);
    expect(onboardingCss).not.toMatch(/\.meou-field input[^}]*min-height:\s*2\.[0-6]rem;/);
    expect(onboardingCss).not.toMatch(/\.meou-time-mode button[^}]*min-height:\s*2\.[0-6]rem;/);
    expect(onboardingCss).not.toMatch(/(?:min-|max-)?height:\s*[^;]*(?:dvh|svh|lvh)/);
    expect(onboardingCss).not.toMatch(/font-size:\s*[^;]*v[wh]/);
  });

  it('keeps the complete birth form on one screen until the keyboard opens', () => {
    expect(onboarding).toContain('data-onboarding-screen={screen}');
    expect(onboardingCss).toMatch(
      /data-onboarding-screen='birth'\]\s*\{[\s\S]*?overflow-y:\s*hidden;/,
    );
    expect(onboardingCss).toMatch(
      /data-onboarding-screen='birth'\] \.meou-birth-form\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/,
    );
    expect(onboardingCss).toMatch(
      /data-onboarding-screen='birth'\]:focus-within\s*\{[\s\S]*?overflow-y:\s*auto;/,
    );
    expect(onboardingCss).toContain("@media (max-height: 700px)");
    expect(onboardingCss).toMatch(
      /data-onboarding-screen='birth'\] \.meou-time-mode button\s*\{[\s\S]*?min-height:\s*2\.75rem;/,
    );
  });
});
