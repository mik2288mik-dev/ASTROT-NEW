import Script from 'next/script';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { PUBLIC_SITE_CONFIG } from '../../lib/publicSiteConfig';
import styles from '../../styles/OpenAiPublicSite.module.css';

type AnalyticsEvent = 'rustore_click' | 'natal_click' | 'compatibility_click' | 'horoscope_click' | 'support_click' | 'scroll_depth_100';
type AnalyticsWindow = Window & { ym?: (counterId: string | number, method: string, ...args: unknown[]) => void; gtag?: (...args: unknown[]) => void; dataLayer?: unknown[][] };

const { ga4MeasurementId, yandexMetrikaId } = PUBLIC_SITE_CONFIG;
const isEnabled = Boolean(ga4MeasurementId || yandexMetrikaId);
const consentStorageKey = 'nebo_public_analytics_consent_v1';

function pagePath(url: string): string {
  try { const parsed = new URL(url, window.location.origin); return `${parsed.pathname}${parsed.search}`; } catch { return url; }
}

function analytics(): AnalyticsWindow {
  const analyticsWindow = window as AnalyticsWindow;
  if (yandexMetrikaId && !analyticsWindow.ym) {
    const queuedYm = ((...args: unknown[]) => { queuedYm.a.push(args); }) as AnalyticsWindow['ym'] & { a: unknown[][] };
    queuedYm.a = [];
    analyticsWindow.ym = queuedYm;
  }
  if (ga4MeasurementId && !analyticsWindow.gtag) {
    analyticsWindow.dataLayer = analyticsWindow.dataLayer || [];
    analyticsWindow.gtag = (...args: unknown[]) => analyticsWindow.dataLayer?.push(args);
  }
  return analyticsWindow;
}

function sendPageView(url: string) {
  const analyticsWindow = analytics();
  const path = pagePath(url);
  if (yandexMetrikaId) analyticsWindow.ym?.(yandexMetrikaId, 'hit', path);
  if (ga4MeasurementId) analyticsWindow.gtag?.('config', ga4MeasurementId, { page_location: window.location.href, page_path: path });
}

function sendEvent(name: AnalyticsEvent, parameters: Record<string, string | number> = {}) {
  const analyticsWindow = analytics();
  const payload = { page_path: pagePath(window.location.href), ...parameters };
  if (yandexMetrikaId) analyticsWindow.ym?.(yandexMetrikaId, 'reachGoal', name, payload);
  if (ga4MeasurementId) analyticsWindow.gtag?.('event', name, payload);
}

function eventForLink(link: HTMLAnchorElement): AnalyticsEvent | undefined {
  if (link.dataset.analyticsEvent === 'rustore_click') return 'rustore_click';
  const href = link.getAttribute('href') || '';
  if (href === '/natalnaya-karta' || href.startsWith('/natalnaya-karta?')) return 'natal_click';
  if (href === '/sovmestimost' || href.startsWith('/sovmestimost?')) return 'compatibility_click';
  if (href === '/goroskop' || href.startsWith('/goroskop?')) return 'horoscope_click';
  if (href === '/support' || href.startsWith('/support?') || href.startsWith('mailto:')) return 'support_click';
  return undefined;
}

export function PublicAnalytics() {
  const router = useRouter();
  const [analyticsConsent, setAnalyticsConsent] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isEnabled) return undefined;
    const readConsent = () => setAnalyticsConsent(window.localStorage.getItem(consentStorageKey) === 'granted');
    const openConsent = () => { window.localStorage.removeItem(consentStorageKey); setAnalyticsConsent(null); };
    readConsent();
    window.addEventListener('nebo-open-analytics-consent', openConsent);
    return () => window.removeEventListener('nebo-open-analytics-consent', openConsent);
  }, []);

  useEffect(() => {
    if (!isEnabled || !analyticsConsent) return undefined;
    const handleRoute = (url: string) => sendPageView(url);
    const handleClick = (event: MouseEvent) => {
      const element = event.target;
      if (!(element instanceof Element)) return;
      const link = element.closest('a');
      if (!link) return;
      const name = eventForLink(link);
      if (name) sendEvent(name, { link_url: link.href, link_text: (link.textContent || '').trim().slice(0, 120) });
    };
    let bottomReached = false;
    const handleScroll = () => {
      if (bottomReached) return;
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollableHeight <= 0 || window.scrollY >= scrollableHeight - 2) { bottomReached = true; sendEvent('scroll_depth_100'); }
    };
    sendPageView(router.asPath);
    router.events.on('routeChangeComplete', handleRoute);
    document.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => { router.events.off('routeChangeComplete', handleRoute); document.removeEventListener('click', handleClick); window.removeEventListener('scroll', handleScroll); };
  }, [analyticsConsent, router]);

  if (!isEnabled) return null;
  const chooseConsent = (value: 'granted' | 'denied') => { window.localStorage.setItem(consentStorageKey, value); setAnalyticsConsent(value === 'granted'); };
  if (analyticsConsent === null) return <aside className={styles.analyticsConsent} role="dialog" aria-label="Настройки аналитики"><p>Мы используем Яндекс Метрику и Google Analytics, чтобы понимать посещаемость и улучшать сайт. В Метрике включён Вебвизор. Подробнее — в <a href="/privacy">политике конфиденциальности</a>.</p><div className={styles.analyticsConsentActions}><button type="button" onClick={() => chooseConsent('granted')}>Разрешить аналитику</button><button type="button" onClick={() => chooseConsent('denied')}>Только необходимое</button></div></aside>;
  if (!analyticsConsent) return null;
  return <>{yandexMetrikaId ? <Script id="yandex-metrika" strategy="afterInteractive">{`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');ym(${JSON.stringify(yandexMetrikaId)},'init',{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});`}</Script> : null}{ga4MeasurementId ? <><Script id="ga4-library" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4MeasurementId)}`} strategy="afterInteractive" /><Script id="ga4-config" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config',${JSON.stringify(ga4MeasurementId)},{send_page_view:false});`}</Script></> : null}</>;
}
