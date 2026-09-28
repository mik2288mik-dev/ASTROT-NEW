import fs from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('temporary natal interpretation inspector', () => {
  it('is admin-only and toggled from developer settings', () => {
    const settings = source('views/Settings.tsx');
    const magazine = source('views/v2/NatalMagazine.tsx');

    expect(settings).toContain('Проверка нового натала');
    expect(settings).toContain('writeNatalInterpretationDebug');
    expect(settings).not.toContain('Версия разбора натальной карты');
    expect(magazine).toContain('profile.isAdmin === true && natalDebugEnabled');
    expect(magazine).toContain('<NatalInterpretationDebugPanel');
  });

  it('shows the deterministic layer directly and does not call an AI provider', () => {
    const panel = source('components/NatalReading/NatalInterpretationDebugPanel.tsx');

    expect(panel).toContain('buildNatalInterpretation');
    expect(panel).toContain('Swiss → надёжный факт → наше объяснение');
    expect(panel).toContain('Наш смысл:');
    expect(panel).toContain('Не использовано:');
    expect(panel).not.toContain('createLunaStructuredResponse');
    expect(panel).not.toContain('fetch(');
  });
});
