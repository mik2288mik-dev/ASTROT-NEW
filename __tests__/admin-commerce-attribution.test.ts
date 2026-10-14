import fs from 'node:fs';
import path from 'node:path';

describe('admin commerce attribution', () => {
  it('returns a bounded breakdown and renders placement with source', () => {
    const dashboard = fs.readFileSync(
      path.join(process.cwd(), 'pages', 'api', 'admin', 'v2', 'dashboard.ts'),
      'utf8',
    );
    const service = fs.readFileSync(
      path.join(process.cwd(), 'services', 'admin2Service.ts'),
      'utf8',
    );
    const admin = fs.readFileSync(
      path.join(process.cwd(), 'views', 'admin2', 'AdminApp.tsx'),
      'utf8',
    );

    expect(dashboard).toContain("payload_json->>'placement'");
    expect(dashboard).toContain(
      "WHEN event_type IN ('paywall_view', 'paywall_viewed', 'paywall_impression') THEN 'paywall_view'",
    );
    expect(dashboard).toContain('COUNT(DISTINCT user_id)::int AS users');
    expect(dashboard).toContain('ROW_NUMBER() OVER');
    expect(dashboard).toContain('WHERE row_rank <= 8');
    expect(dashboard).toContain('commerceAttribution: commerceAttribution.rows.map');
    expect(service).toContain('commerceAttribution: AdminCommerceAttributionRow[]');
    expect(admin).toContain('Откуда приходят к оплате');
    expect(admin).toContain('Раздел: {row.placement');
    expect(admin).toContain('Источник: {row.source');
  });
});
