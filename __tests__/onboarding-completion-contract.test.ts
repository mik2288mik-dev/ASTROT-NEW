import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('first-run onboarding completion flow', () => {
  it('keeps the accepted welcome flow and reaches personal Today before any Premium surface', () => {
    const onboarding = read('views/Onboarding.tsx');
    const logo = read('components/brand/NeboLogo.tsx');
    const logoBridge = read('components/onboarding/MeouLogo.tsx');
    const artwork = read('components/onboarding/OnboardingArtwork.tsx');
    const app = read('App.tsx');
    const dashboard = read('views/Dashboard.tsx');
    const completionFlow = app.slice(
      app.indexOf('const handleOnboardingComplete'),
      app.indexOf('const handleAccountLogin'),
    );

    for (const preserved of [
      'className="meou-onboarding antialiased"',
      '<MeouLogo className="meou-onboarding-logo" fullCloud />',
      '<DayClockArtwork />',
      '<NatalWheelArtwork />',
      '<PeopleArtwork />',
      'CityAutocomplete',
      'Создать личный прогноз',
      'Немного данных —',
      'Рассчитать вашу карту',
    ]) {
      expect(onboarding).toContain(preserved);
    }
    expect(onboarding).toContain("const introScreens: OnboardingScreen[] = ['day', 'self', 'people']");
    expect(onboarding).toContain("const welcomeScreens: OnboardingScreen[] = [...introScreens, 'choice']");
    expect(onboarding).toContain('const nextScreen = welcomeScreens[currentIndex + direction]');
    expect(onboarding).toContain("initialStep === 'birth' ? 'birth' : 'day'");
    expect(onboarding).not.toContain('const STORIES: Story[]');
    expect(onboarding).not.toContain('nextStory');
    expect(onboarding).not.toContain("setStep('birth')");
    expect(onboarding).not.toContain('className="onb-notify"');
    expect(logo).toContain("/assets/brand/nebo-cloud-logo.png");
    expect(logo).toContain("alt={decorative ? '' : 'NEBO'}");
    expect(logoBridge).toContain('<NeboLogo');
    expect(logo).not.toContain('/assets/brand/personal-horoscope-mark.svg');
    expect(logo).not.toContain('<svg');
    expect(artwork).toContain('export const NatalWheelArtwork');

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

    expect(onboarding).toContain("useState<'male' | 'female' | 'unspecified'>(initialProfile?.gender || 'unspecified')");
    expect(onboarding).toContain('setGender((current) => current === value');
    expect(onboarding).toContain("validateName(name)");
    expect(onboarding).toContain("validateDate(date)");
    expect(onboarding).toContain('noValidate');
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
    expect(app).toContain('const generatedChart = await getOrCalculateChart(');
    expect(app).toContain('primaryChartRequestGuardRef.current.isCurrent(onboardingChartToken)');
    expect(app).toContain('const fullProfile = { ...pendingProfile, isSetup: true }');
    expect(app).toContain('const canonicalFullProfile: UserProfile = {');
    expect(app).toContain('birthTimezone: canonicalBirth?.timezone || generatedChart.timezone');
    expect(app).toContain('await saveProfile(canonicalFullProfile)');
    expect(app).toContain('setProfile(canonicalFullProfile)');
    expect(app).toContain('loadStartupPersonalForecasts(canonicalFullProfile)');
    expect(app).toContain('onboardingCompletionRef.current = false');
    expect(app).not.toContain("window.alert?.('Не удалось подтвердить гостевую сессию");

    expect(completionFlow).toContain("const targetView = onboardingTargetViewRef.current || 'dashboard'");
    expect(completionFlow).toContain("setDashboardPeriod('day')");
    expect(completionFlow).toContain('setView(targetView)');
    expect(completionFlow).not.toContain("setView('paywall')");
    expect(completionFlow).not.toContain('const isFirstSetup =');
    expect(completionFlow.indexOf('getOrCalculateChart('))
      .toBeLessThan(completionFlow.indexOf('setView(targetView)'));

    expect(app).not.toContain('prepareUserContentDbFirst');
    expect(dashboard).toContain('loadPersonalForecast({');
  });
});
