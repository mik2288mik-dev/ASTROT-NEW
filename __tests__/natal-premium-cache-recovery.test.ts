import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Premium natal cache recovery', () => {
  it('treats an incomplete server cache as a miss before GET or generation', () => {
    const permanentApi = read('lib/natalReading/permanentApi.ts');
    const premiumRoute = read('pages/api/content/natal/human-premium.ts');
    const client = read('services/natalReadingService.ts');

    expect(permanentApi).toContain(
      'cached && isNatalPermanentPremiumReport(cached.content) ? cached : null',
    );
    expect(permanentApi).toMatch(
      /readCached: async \(\) => \{[\s\S]*cached && isNatalPermanentPremiumReport\(cached\.content\)/,
    );
    expect(premiumRoute.indexOf('getCachedPermanentPremiumReport(ctx)')).toBeLessThan(
      premiumRoute.indexOf("if (req.method === 'GET')"),
    );
    expect(client).toContain("if (code === 'NATAL_PREMIUM_REPORT_INCOMPLETE') return null;");
    expect(client.indexOf('getCachedHumanPremiumReport')).toBeLessThan(
      client.indexOf("postHuman<NatalPermanentPremiumReport>('human-premium'"),
    );
  });
});
