import type { AppProps } from 'next/app';
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
import { DoodleDefs } from '../components/doodle/DoodleDefs';

export default function App({ Component, pageProps }: AppProps) {
  // Database migrations are handled during build process (npm run migrate)
  return (
    <>
      {/* Global hand-drawn SVG filter defs for the doodle skin (visual-only) */}
      <DoodleDefs />
      <Component {...pageProps} />
    </>
  );
}
