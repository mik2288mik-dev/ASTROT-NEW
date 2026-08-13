import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('first-run onboarding completion flow', () => {
  it('opens the birth form directly and reaches personal Today before any Premium surface', () => {
    const onboarding = read('views/Onboarding.tsx');
    const app = read('App.tsx');
    const completionFlow = app.slice(
      app.indexOf('const handleOnboardingComplete'),
      app.indexOf('const handleAccountLogin'),
    );

    for (const preserved of [
      'className="fresh-page lumia-main-scroll onboarding-editorial-page"',
      'className="fresh-page-title"',
      'className="fresh-input"',
      'className={`onb-gender',
      'className="fresh-btn-primary"',
      'CityAutocomplete',
      'Данные для расчёта',
      'Сначала рассчитаем твою карту, затем подготовим личный Today.',
      'Рассчитать карту',
    ]) {
      expect(onboarding).toContain(preserved);
    }
    expect(onboarding).not.toContain('const STORIES: Story[]');
    expect(onboarding).not.toContain('nextStory');
    expect(onboarding).not.toContain("setStep('birth')");
    expect(onboarding).not.toContain('className="onb-notify"');

    for (const field of [
      'name: name.trim()',
      'gender',
      'birthDate: date',
      "birthTime: timeMode === 'unknown' ? '' : time",
      'birthTimeMode: timeMode',
      "birthTimeUncertaintyMinutes: timeMode === 'approximate' ? uncertainty : null",
      'birthPlace: place.trim()',
      'birthLatitude: placeCoords?.lat ?? null',
      'birthLongitude: placeCoords?.lon ?? null',
      'birthTimezone: placeCoords?.timezone ?? null',
    ]) {
      expect(onboarding).toContain(field);
    }

    expect(onboarding).toContain("useState<'male' | 'female' | 'unspecified'>('unspecified')");
    expect(onboarding).toContain('(window as any).Telegram?.WebApp');
    expect(onboarding).toContain('ensureTelegramFullscreen()');
    expect(onboarding).toContain('if (submittingRef.current) return;');
    expect(onboarding).toContain('disabled={isSubmitting}');
    expect(onboarding).toContain('await onComplete({');
    expect(onboarding).toContain('setIsSubmitting(false)');
    expect(onboarding).toContain("notificationFrequency: 'quiet'");
    expect(onboarding).not.toContain('requestPermission');
    expect(onboarding).not.toContain("setDate('')");
    expect(onboarding).not.toContain("setPlace('')");

    expect(app).toContain('if (!isValidUserId(currentProfileId))');
    expect(app).toContain('const safeUserId = String(currentProfileId)');
    expect(app).toContain('const isGuestOnboarding = profile?.isGuest === true;');
    expect(app).not.toContain('hasTelegramUserId ? tgId : currentProfileId');
    expect(app).toContain('if (onboardingCompletionRef.current) return;');
    expect(app).toContain('onboardingCompletionRef.current = true;');
    expect(app).toContain('const pendingProfile = {');
    expect(app).toContain('isSetup: false');
    expect(app).toContain('const generatedChart = await getOrCalculateChart(pendingProfile)');
    expect(app).toContain('const fullProfile = { ...pendingProfile, isSetup: true }');
    expect(app).toContain('await saveProfile(fullProfile)');
    expect(app).toContain('setProfile(fullProfile)');
    expect(app).toContain('onboardingCompletionRef.current = false');
    expect(app).not.toContain("window.alert?.('Не удалось подтвердить гостевую сессию");

    expect(completionFlow).toContain("const targetView = onboardingTargetViewRef.current || 'dashboard'");
    expect(completionFlow).toContain("setDashboardPeriod('day')");
    expect(completionFlow).toContain('setView(targetView)');
    expect(completionFlow).not.toContain("setView('paywall')");
    expect(completionFlow).not.toContain('const isFirstSetup =');
    expect(completionFlow.indexOf('getOrCalculateChart(pendingProfile)'))
      .toBeLessThan(completionFlow.indexOf('setView(targetView)'));

    expect(app).toContain("mode: 'generate-missing'");
    expect(app).toContain('void prepareUserContentDbFirst');
  });
});
