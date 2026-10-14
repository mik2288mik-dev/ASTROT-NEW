import React, { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { admin2, Admin2Error, type AdminMe, type AdminRangeKey } from '../../services/admin2Service';
import { AdminLogin } from '../../components/admin/AdminLogin';
import { AdminShell, SECTION_KEYS, type AdminSectionKey } from '../../components/admin/AdminShell';
import { Loading } from '../../components/admin/ui';

const RANGE_KEYS: AdminRangeKey[] = ['today', 'yesterday', '7d', '30d', 'month', '90d'];
const LOGIN_NOTICES: Record<string, string> = {
  expired: 'Ссылка для входа уже использована или устарела. Запроси новую.',
  failed: 'Не получилось войти по ссылке. Запроси новую.',
};

/** The only admin: /admin on the live server's website. */
export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState<AdminMe | null>(null);
  const [state, setState] = useState<'loading' | 'login' | 'denied' | 'ready'>('loading');

  const slug = router.query.slug;
  const requested = (Array.isArray(slug) ? slug[0] : '') as AdminSectionKey;
  const section: AdminSectionKey = SECTION_KEYS.includes(requested) ? requested : 'overview';
  const range: AdminRangeKey = RANGE_KEYS.includes(router.query.range as AdminRangeKey) ? router.query.range as AdminRangeKey : '7d';
  const loginNotice = typeof router.query.login === 'string' ? LOGIN_NOTICES[router.query.login] || null : null;

  const check = useCallback(async () => {
    setState('loading');
    try {
      setMe(await admin2.me());
      setState('ready');
    } catch (error) {
      setMe(null);
      setState(error instanceof Admin2Error && error.status === 403 ? 'denied' : 'login');
    }
  }, []);

  useEffect(() => { if (router.isReady) void check(); }, [router.isReady, check]);

  const navigate = useCallback((next: AdminSectionKey, nextRange = range) => {
    const path = next === 'overview' ? '/admin' : `/admin/${next}`;
    void router.push({ pathname: path, query: nextRange !== '7d' ? { range: nextRange } : {} }, undefined, { shallow: true });
  }, [router, range]);

  const logout = useCallback(async () => {
    await admin2.logout().catch(() => undefined);
    admin2.clearDevAuth();
    setMe(null);
    setState('login');
  }, []);

  return (
    <>
      <Head>
        <title>NEBO · Админка</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      {state === 'loading' ? <div className="adm-root adm-center"><Loading text="Проверяю доступ…" /></div> : null}
      {state === 'login' || state === 'denied' ? (
        <AdminLogin notice={loginNotice} denied={state === 'denied'} onSignedIn={check} onLogout={logout} />
      ) : null}
      {state === 'ready' && me ? (
        <AdminShell me={me} section={section} range={range} onNavigate={(next) => navigate(next)} onRange={(next) => navigate(section, next)} onLogout={logout} />
      ) : null}
    </>
  );
}
