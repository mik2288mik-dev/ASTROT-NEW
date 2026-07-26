import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('existing onboarding completion flow', () => {
  it('preserves stories and fields while making canonical profile/chart completion retry-safe', () => {
    const onboarding = read('views/Onboarding.tsx');
    const app = read('App.tsx');

    for (const preserved of [
      'const STORIES: Story[]',
      'onClick={nextStory}',
      "onClick={() => setStep('birth')}>Пропустить",
      'className="onb-card"',
      'className="onb-hero"',
      'className="onb-title"',
      'className="onb-text"',
      'className="fresh-input"',
      'className={`onb-gender',
      'className="onb-notify"',
      'className="fresh-btn-primary"',
      'CityAutocomplete',
    ]) {
      expect(onboarding).toContain(preserved);
    }

    for (const field of [
      'name: name.trim()',
      'gender',
      'birthDate: date',
      'birthTime: time',
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
    expect(onboarding).toContain('disabled={!canSubmit || isSubmitting}');
    expect(onboarding).toContain('await onComplete({');
    expect(onboarding).toContain('setIsSubmitting(false)');
    expect(onboarding).not.toContain("setDate('')");
    expect(onboarding).not.toContain("setPlace('')");

    expect(app).toContain('const hasGuestProfileId = isGuestUserId(currentProfileId)');
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

    expect(app).toContain("mode: 'generate-missing'");
    expect(app).toContain('void prepareUserContentDbFirst');
  });
});
