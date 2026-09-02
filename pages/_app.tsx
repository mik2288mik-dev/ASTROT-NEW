import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';
import '../styles/cardBackgrounds.css';
import '../styles/cardBackgroundPolish.css';
import '../styles/homeMvpLayout.css';
import '../styles/typographyManrope.css';
import '../styles/homeContentHierarchy.css';
import '../styles/readingBackgrounds.css';
import '../styles/homeScrollStability.css';
import '../styles/personalForecastFeed.css';
import '../styles/zodiacReader.css';
import '../styles/natalEditorial.css';
import '../styles/compatibilityEditorial.css';
import '../styles/settingsEditorial.css';
import '../styles/newspaperVisual.css';
import '../styles/liquidGlassChrome.css';
import '../styles/personalityReport.css';
import '../styles/personalForecastRuntimeHotfix.css';
import '../styles/personalForecastHeaderLogo.css';
import '../styles/editorialStudio.css';
import '../styles/todayHome.css';
import '../styles/uiPreview.css';
import '../styles/sharedShellFinal.css';
import '../styles/natalMeaningMap.css';
import { DoodleDefs } from '../components/doodle/DoodleDefs';
import { PublicAnalytics } from '../components/public-site/PublicAnalytics';
import { installRuntimeDiagnostics } from '../lib/runtimeDiagnostics';

if (typeof window !== 'undefined') {
  installRuntimeDiagnostics();
}

export default function App({ Component, pageProps, router }: AppProps) {
  const viewport = router.pathname === '/'
    ? 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
    : 'width=device-width, initial-scale=1, viewport-fit=cover';
  const publicAnalyticsEnabled = process.env.NEXT_PUBLIC_MEOU_PUBLIC_SITE === '1';
  // Database migrations are handled during build process (npm run migrate)
  return (
    <>
      <Head>
        <meta name="viewport" content={viewport} />
      </Head>
      {publicAnalyticsEnabled ? <PublicAnalytics /> : null}
      {/* Global hand-drawn SVG filter defs for the doodle skin (visual-only) */}
      <DoodleDefs />
      <Component {...pageProps} />
    </>
  );
}
