import fs from 'fs';
import path from 'path';
import {
  balanceSummaryEn,
  balanceSummaryRu,
  type ChartBalance,
} from '../lib/natal/chartBalance';

const ROOT = path.join(__dirname, '..');

function balance(): ChartBalance {
  return {
    elements: { fire: 4, earth: 2, air: 1, water: 1 },
    modalities: { cardinal: 2, fixed: 3, mutable: 3 },
    total: 8,
    topElement: 'fire',
    lowElement: 'air',
    topModality: 'fixed',
  };
}

describe('chart balance placement and copy', () => {
  it('keeps calculated balance out of the active unified reading', () => {
    const natalMagazine = fs.readFileSync(path.join(ROOT, 'views', 'v2', 'NatalMagazine.tsx'), 'utf8');
    const unifiedReport = fs.readFileSync(path.join(ROOT, 'components', 'NatalReading', 'NatalUnifiedReport.tsx'), 'utf8');

    expect(natalMagazine).not.toContain('<ChartBalance');
    expect(unifiedReport).not.toContain('<ChartBalance');
    expect(natalMagazine).toContain('<NatalUnifiedReport');
    expect(natalMagazine).toContain('<InteractiveNatalMap');
  });

  it('does not use deficit wording in element summaries', () => {
    const source = fs.readFileSync(path.join(ROOT, 'lib', 'natal', 'chartBalance.ts'), 'utf8');
    expect(source).not.toMatch(/не хватает|дефицит|даётся труднее/);
  });

  it('provides RU and EN element summaries', () => {
    expect(balanceSummaryRu(balance())).toContain('Огонь');
    expect(balanceSummaryRu(balance())).toContain('Воздух');
    expect(balanceSummaryEn(balance())).toContain('Fire');
    expect(balanceSummaryEn(balance())).toContain('Air');
  });
});
