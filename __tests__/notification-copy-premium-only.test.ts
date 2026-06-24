import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

const NOTIFICATION_COPY_FILES = [
  'lib/adminNotificationSeedCatalog.ts',
  'lib/notificationSlotCatalog.ts',
  'pages/api/admin/notifications/ai-drafts.ts',
].map((rel) => path.join(ROOT, rel));

const FORBIDDEN_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'разовое открытие', pattern: /разовое открытие/i },
  { label: 'открыть разово', pattern: /открыть разово/i },
  { label: 'разово через Stars', pattern: /разово через Stars/i },
  { label: 'Premium или Stars', pattern: /Premium или Stars/i },
  { label: 'через Premium или Stars', pattern: /через Premium или Stars/i },
  { label: 'one-off Stars', pattern: /one-off Stars/i },
  { label: 'one-off Lumi', pattern: /one-off Lumi/i },
  { label: 'one-off unlock', pattern: /\bone-off\b.*unlock/i },
  { label: 'unlock за Stars', pattern: /unlock за Stars/i },
  { label: 'unlock за Lumi', pattern: /unlock за Lumi/i },
  { label: 'collect Lumi', pattern: /collect Lumi/i },
  { label: 'daily Lumi', pattern: /daily Lumi/i },
  { label: 'Lumi reward', pattern: /Lumi reward/i },
  { label: 'ежедневные Lumi', pattern: /ежедневн(?:ые|ой|ый) Lumi/i },
  { label: 'забери Lumi', pattern: /забери Lumi/i },
  { label: 'Lumi-сбор', pattern: /Lumi-сбор/i },
  { label: 'разовый unlock', pattern: /разов(?:ый|ое) unlock/i },
  { label: 'разовый доступ', pattern: /разов(?:ый|ое) доступ/i },
];

describe('notification copy is Premium-only', () => {
  it('admin notification sources avoid legacy Lumi and one-off Stars copy', () => {
    const violations: string[] = [];

    for (const file of NOTIFICATION_COPY_FILES) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf8');
      const hits = FORBIDDEN_PATTERNS.filter(({ pattern }) => pattern.test(content)).map(({ label }) => label);
      if (hits.length) violations.push(`${rel}: ${hits.join(', ')}`);
    }

    expect(violations).toEqual([]);
  });

  it('upsell and promo slots promote Premium in seed catalog', () => {
    const source = fs.readFileSync(path.join(ROOT, 'lib/adminNotificationSeedCatalog.ts'), 'utf8');
    expect(source).toMatch(/UPSELL_MESSAGES[\s\S]*Premium/);
    expect(source).toMatch(/PROMO_MESSAGES[\s\S]*Premium/);
    expect(source).not.toMatch(/UPSELL_MESSAGES[\s\S]*Stars/);
  });

  it('notification slot defaults use Premium CTAs', () => {
    const { NOTIFICATION_SLOT_CONFIG } = require('../lib/notificationSlotCatalog');
    expect(NOTIFICATION_SLOT_CONFIG.upsell.defaultButtonText).toBe('Открыть Premium');
    expect(NOTIFICATION_SLOT_CONFIG.promo.defaultButtonText).toBe('Посмотреть Premium');
  });
});
