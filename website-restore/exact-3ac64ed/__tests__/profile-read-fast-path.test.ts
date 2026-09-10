import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('profile read fast path', () => {
  it('uses the user row for startup fields without redundant chart and preference queries', () => {
    const route = read('pages/api/users/[id].ts');
    const me = read('pages/api/users/me.ts');
    const getStart = route.indexOf("if(req.method==='GET')");
    const postStart = route.indexOf("if(req.method!=='POST'", getStart);
    const getBlock = route.slice(getStart, postStart);

    expect(getBlock).toContain('db.users.get(userId,{hydratePrimaryChart:false})');
    expect(me).toContain('db.users.get(auth.userId,{hydratePrimaryChart:false})');
    expect(getBlock).toContain('normalizeNotificationFrequency(user.notification_frequency)');
    expect(route).toContain('birthTimezone:user.birth_timezone||null');
    expect(route).toContain('birthLatitude:user.latitude??null');
    expect(route).toContain('birthLongitude:user.longitude??null');
    expect(getBlock).not.toContain('await getNotificationFrequency(userId)');
    expect(getBlock).toContain('if(!refCode)');
    expect(getBlock).toContain('queuePersonalForecastPrewarmForUser({');
  });

  it('keeps primary-chart hydration enabled by default for other callers', () => {
    const db = read('lib/db.ts');

    expect(db).toContain('async get(userId: string, options?: { hydratePrimaryChart?: boolean })');
    expect(db).toContain("if (options?.hydratePrimaryChart !== false)");
    expect(db).toContain('notification_frequency: u.notification_frequency');
    expect(db).toContain('birth_time_mode: u.birth_time_mode ?? null');
    expect(db).toContain('birth_time_uncertainty_minutes: u.birth_time_uncertainty_minutes ?? null');
    expect(db).toContain('birth_time_range_start: u.birth_time_range_start ?? null');
    expect(db).toContain('birth_time_range_end: u.birth_time_range_end ?? null');
    expect(db).toContain('const trustedPrimaryChart = trustedBirthContext({');
    expect(db).toContain('birth_timezone: trustedPrimaryChart?.timezone ?? legacyUserBirthContext?.birth_timezone ?? null');
    expect(db).toContain('AS primary_chart_summary');
    expect(db).toContain('normalizeJsonColumn(u.primary_chart_summary)');
  });
});
