import fs from 'fs';
import path from 'path';
import { buildSynastryPrompt } from '../lib/contentPromptBuilders';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('AI-only compatibility pipeline', () => {
  it('sends normalized people data to Luna without compatibility calculations', () => {
    const api = read('pages/api/content/synastry/extended.ts');

    expect(api).toContain('createLunaStructuredResponse');
    expect(api).toContain('buildLunaPersonContext');
    expect(api).toContain('people: {');
    expect(api).not.toContain("from '../../../../lib/swisseph-calculator'");
    expect(api).not.toContain('calculateFlexibleNatalChart');
    expect(api).not.toContain('calculateNatalChart(');
    expect(api).not.toContain('computeSynastryAspects');
    expect(api).not.toContain('synastryAspects');
    expect(read('lib/synastryExtended.ts')).toContain("SYNASTRY_CONTEXT_PROMPT_VERSION = 'synastry-context.v6'");
  });

  it('asks Luna for vivid prose without pretending that exact astrology was calculated', () => {
    const prompt = buildSynastryPrompt().user;

    expect(prompt).toContain('AI-разбор по данным двух людей');
    expect(prompt).toContain('Не вычисляй и не выдумывай положения планет, дома, аспекты, градусы и орбы');
    expect(prompt).toContain('Каждый раздел должен давать новый узнаваемый эпизод');
    expect(prompt).toContain('никаких рекламных призывов');
    expect(prompt).not.toContain('context.synastryAspects');
  });
});
