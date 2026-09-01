import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('legal acknowledgement gate integration', () => {
  it('shows one compact screen with two separate unchecked controls and one action', () => {
    const gate = read('views/LegalAcknowledgementGate.tsx');

    expect(gate).toContain("const REQUIRED_DOCUMENTS = ['terms', 'personal_data', 'entertainment_notice'] as const");
    expect(gate.match(/type="checkbox"/g)).toHaveLength(2);
    expect(gate.match(/type="button"/g)).toHaveLength(1);
    expect(gate).not.toContain('defaultChecked');
    expect(gate).toContain('отдельно дай согласие на');
    expect(gate).toContain('Федеральным законом № 152-ФЗ');
    expect(gate).toContain('Принимаю');
    expect(gate).toContain('Даю');
    expect(gate).toContain('Продолжить');
    expect(gate).toContain('заменяют медицинскую, психологическую, юридическую или');
    expect(gate).toContain('Согласия и условия');
    expect(gate).not.toContain('Перед началом');
    expect(gate).toContain('h-[100dvh] overflow-hidden');
    expect(gate).toContain('flex justify-center');
    expect(gate).toContain('rounded-full');
  });

  it('records separate server-owned facts and recovers a partially completed request', () => {
    const gate = read('views/LegalAcknowledgementGate.tsx');

    expect(gate).toContain('for (const documentType of REQUIRED_DOCUMENTS)');
    expect(gate).toContain("action: 'accepted'");
    expect(gate).not.toContain('documentVersion:');
    expect(gate.match(/readLegalAcknowledgements\(\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(gate).toContain('setTermsAccepted(isAccepted(refreshedSummary');
    expect(gate).toContain('setPersonalDataAccepted(isAccepted(refreshedSummary');
  });

  it('uses authoritative uncached acknowledgements after login and on a later app launch', () => {
    const app = read('App.tsx');
    const gate = read('views/LegalAcknowledgementGate.tsx');
    const profileRoute = read('pages/api/users/me.ts');
    const acknowledgementRoute = read('pages/api/users/legal-acknowledgements.ts');
    const storage = read('services/storageService.ts');
    const storeConfig = read('lib/storeReleaseConfig.ts');

    const gateIndex = app.indexOf('if (!legalAcknowledgementGateContract.hasAcceptedEveryDocument');
    const onboardingIndex = app.indexOf("if (view === 'onboarding')");
    expect(gateIndex).toBeGreaterThan(0);
    expect(gateIndex).toBeLessThan(onboardingIndex);
    expect(profileRoute).toContain('getLegalDocumentStatusesForUser(auth.userId)');
    expect(profileRoute).toContain('legalAcknowledgements:{');
    expect(profileRoute).toContain("res.setHeader('Cache-Control','private, no-store, max-age=0')");
    expect(acknowledgementRoute).toContain("res.setHeader('Cache-Control', 'private, no-store, max-age=0')");
    expect(storage).toContain("cache: 'no-store'");
    expect(storage).toContain("'Cache-Control': 'no-cache'");
    expect(gate).toContain("cache: 'no-store'");
    expect(gate).toContain('if (initialSummary && hasAcceptedEveryDocument(initialSummary))');
    expect(gate).toContain('readLegalAcknowledgements()');
    expect(gate).toContain('const [loading, setLoading] = useState(true)');
    expect(gate).toContain('if (loading) return <Loading progress={100} />');
    expect(gate).not.toContain('.finally(() =>');
    expect(app).toContain('legalAcknowledgements: profile?.legalAcknowledgements ?? newProfile.legalAcknowledgements ?? null');
    expect(storeConfig).toContain("fallback('/personal-data-consent')");
  });

  it('keeps hosting and infrastructure names out of public legal copy', () => {
    const legalCopy = [
      read('pages/privacy.tsx'),
      read('pages/personal-data-consent.tsx'),
      read('pages/terms.tsx'),
      read('pages/support.tsx'),
    ].join('\n');

    expect(legalCopy).not.toMatch(/Railway|хостинг|hosting|инфраструктур/iu);
  });
});
