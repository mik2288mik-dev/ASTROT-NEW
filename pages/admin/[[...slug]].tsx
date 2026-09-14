import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { admin2, AdminMe } from '../../services/admin2Service';
import { AdminAccessScreen } from '../../components/admin/AdminAccessScreen';
import { AdminLayout, AdminTab } from '../../components/admin/AdminLayout';

export default function AdminPage() {
  const router = useRouter();
  const { slug } = router.query;

  const [me, setMe] = useState<AdminMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);

  // Derive initial tab from slug
  const activeSlug = Array.isArray(slug) ? slug[0] : (typeof slug === 'string' ? slug : '');
  const tabFromUrl: AdminTab = (
    activeSlug === 'users' ? 'users' :
    activeSlug === 'events' ? 'events' :
    activeSlug === 'ai' ? 'ai' :
    activeSlug === 'errors' ? 'errors' :
    activeSlug === 'analytics' ? 'analytics' :
    activeSlug === 'billing' ? 'billing' :
    activeSlug === 'charts' ? 'charts' :
    activeSlug === 'content' ? 'content' :
    activeSlug === 'comms' ? 'comms' :
    activeSlug === 'system' ? 'system' :
    'dashboard'
  );

  const checkAuth = async () => {
    setLoading(true);
    try {
      const info = await admin2.me();
      setMe(info);
      setAuthRequired(false);
    } catch (e: any) {
      setAuthRequired(true);
      setMe(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleTabChange = (newTab: AdminTab) => {
    const path = newTab === 'dashboard' ? '/admin' : `/admin/${newTab}`;
    router.push(path, undefined, { shallow: true });
  };

  const handleLogout = () => {
    admin2.clearDevAuth();
    setMe(null);
    setAuthRequired(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-mono">Проверка доступа к NEBO Ops...</span>
        </div>
      </div>
    );
  }

  if (authRequired || !me) {
    return (
      <>
        <Head>
          <title>Авторизация | NEBO Ops Admin</title>
        </Head>
        <AdminAccessScreen onAuthenticated={checkAuth} />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>NEBO Ops — Панель управления и наблюдаемости</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <AdminLayout
        me={me}
        initialTab={tabFromUrl}
        onTabChange={handleTabChange}
        onLogout={handleLogout}
      />
    </>
  );
}
