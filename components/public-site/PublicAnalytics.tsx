import Script from 'next/script';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

const yandexId = String(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID || '').trim();
const ga4Id = String(process.env.NEXT_PUBLIC_GA4_ID || '').trim();

function sendEvent(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  const w = window as typeof window & {
    ym?: (id: number, method: string, target: string, params?: Record<string, unknown>) => void;
    gtag?: (...args: unknown[]) => void;
  };
  if (ga4Id && w.gtag) w.gtag('event', name, params);
  if (yandexId && w.ym) w.ym(Number(yandexId), 'reachGoal', name, params);
}

export function PublicAnalytics() {
  const router = useRouter();

  useEffect(() => {
    const onRoute = (url: string) => {
      const w = window as typeof window & {
        ym?: (id: number, method: string, target: string, params?: Record<string, unknown>) => void;
        gtag?: (...args: unknown[]) => void;
      };
      if (ga4Id && w.gtag) w.gtag('event', 'page_view', { page_location: window.location.href, page_path: url });
      if (yandexId && w.ym) w.ym(Number(yandexId), 'hit', window.location.href);
    };
    router.events.on('routeChangeComplete', onRoute);
    return () => router.events.off('routeChangeComplete', onRoute);
  }, [router.events]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const element = target?.closest<HTMLElement>('[data-analytics-event]');
      const name = element?.dataset.analyticsEvent;
      if (!name) return;
      sendEvent(name, {
        link_url: element instanceof HTMLAnchorElement ? element.href : undefined,
        link_text: element.textContent?.trim().slice(0, 120),
      });
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  return (
    <>
      {ga4Id ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${ga4Id}',{send_page_view:true});` }} />
        </>
      ) : null}
      {yandexId ? (
        <Script id="yandex-metrika" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');ym(${Number(yandexId)},'init',{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});` }} />
      ) : null}
    </>
  );
}
