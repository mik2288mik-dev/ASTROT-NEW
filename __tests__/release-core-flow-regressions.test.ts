import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('release-critical core flow regressions', () => {
  it('cancels and invalidates stale city autocomplete requests', () => {
    const city = read('components/ui/CityAutocomplete.tsx');

    expect(city).toContain('const requestIdRef = useRef(0);');
    expect(city).toContain('const controller = new AbortController();');
    expect(city).toContain('fetch(url, { signal: controller.signal })');
    expect(city).toContain('requestId !== requestIdRef.current');
    expect(city).toContain('controller.abort();');
    expect(city).toContain('requestIdRef.current += 1;');
  });

  it('resumes a persisted pending onboarding profile on the birth step', () => {
    const onboarding = read('views/Onboarding.tsx');
    const app = read('App.tsx');

    expect(onboarding).toContain('initialProfile?: UserProfile;');
    expect(onboarding).toContain("useState(initialProfile?.birthDate || '')");
    expect(onboarding).toContain("useState(initialProfile?.birthTime || '')");
    expect(onboarding).toContain("useState(initialProfile?.birthPlace || '')");
    expect(onboarding).toContain('initialTimeMode(initialProfile)');
    expect(onboarding).toContain("if (!profile) return 'exact'");
    expect(app).toContain('const hasPendingOnboardingDraft = !profile.isSetup');
    expect(app).toContain("initialStep={hasPendingOnboardingDraft ? 'birth' : onboardingInitialStep}");
    expect(app).toContain('initialProfile={hasPendingOnboardingDraft ? profile : undefined}');
  });

  it('persists a normalized non-empty profile name before committing UI or quota', () => {
    const settings = read('views/Settings.tsx');
    const saveFlow = settings.slice(
      settings.indexOf('const handleSaveProfile = async'),
      settings.indexOf('const handleDeleteAccount ='),
    );
    const failureFlow = saveFlow.slice(saveFlow.indexOf('} catch (error)'), saveFlow.indexOf('} finally'));

    expect(saveFlow).toContain("const normalizedName = (tempName || '').trim();");
    expect(saveFlow).toContain('if (!normalizedName)');
    expect(saveFlow).toContain('const updated = { ...profile, name: normalizedName };');
    expect(saveFlow.indexOf('await saveProfile(updated)')).toBeLessThan(saveFlow.indexOf('onUpdate(updated)', saveFlow.indexOf('setSavingProfile(true)')));
    expect(saveFlow.indexOf('await saveProfile(updated)')).toBeLessThan(saveFlow.indexOf('recordProfileEdit(profile.id)'));
    expect(failureFlow).toContain('setProfileSaveError');
    expect(failureFlow).not.toContain('recordProfileEdit');
    expect(failureFlow).not.toContain('setEditing(false)');
    expect(settings).toContain('value={profile.birthPlace}');
    expect(settings).toContain('readOnly');
    expect(settings).not.toContain('setTempPlace');
  });

  it('warns twice for active RuStore auto-renewal and still permits deletion', () => {
    const settings = read('views/Settings.tsx');
    const deletionFlow = settings.slice(
      settings.indexOf('const handleDeleteAccount ='),
      settings.indexOf('\n    return (', settings.indexOf('const handleDeleteAccount =')),
    );

    expect(settings).toContain("profile.premiumEntitlement?.source === 'rustore'");
    expect(settings).toContain('profile.premiumEntitlement.autoRenew === true');
    expect(settings).not.toContain("const hasActiveRuStoreAutoRenewal = activePremium");
    expect(deletionFlow.match(/window\.confirm/g)).toHaveLength(2);
    expect(deletionFlow).toContain('manageSubscription();');
    expect(deletionFlow).toContain('void onDeleteAccount()');
    expect(deletionFlow.indexOf('hasActiveRuStoreAutoRenewal')).toBeLessThan(deletionFlow.indexOf('void onDeleteAccount()'));
  });

  it('renders existing Natal loading and error states with an in-place retry', () => {
    const app = read('App.tsx');
    const natal = read('views/v2/NatalMagazine.tsx');

    expect(app).toContain("const [chartLoadState, setChartLoadState] = useState<ChartLoadState>('idle')");
    expect(app).toContain('chartLoadState={chartLoadState}');
    expect(app).toContain('onRetryChart={() => { void loadPrimaryChartOnce(profile); }}');
    expect(natal).toContain("chartLoadState?: 'idle' | 'loading' | 'ready' | 'error';");
    expect(natal).toContain("chartLoadState === 'loading'");
    expect(natal).toContain("chartLoadState === 'error'");
    expect(natal).toContain('onClick={onRetryChart}');
    expect(natal).toContain("language === 'ru' ? 'Повторить' : 'Retry'");
    expect(natal).toContain("language === 'ru' ? 'Ввести данные' : 'Enter birth details'");
  });
});
