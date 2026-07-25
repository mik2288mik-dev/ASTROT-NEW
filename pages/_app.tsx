import type { AppProps } from 'next/app';
import '../styles/globals.css';
import '../styles/stickers.css';
import '../styles/cardBackgrounds.css';
import '../styles/cardBackgroundPolish.css';
import '../styles/homeMvpLayout.css';
import '../styles/typographyManrope.css';
import '../styles/homeContentHierarchy.css';
import '../styles/readingBackgrounds.css';
import '../styles/homeScrollStability.css';
import '../styles/dailyQuestionStory.css';
import '../styles/dailyQuestionCardTone.css';
import '../styles/periodExtraCards.css';
import { DoodleDefs } from '../components/doodle/DoodleDefs';
import { installDailyPackageFetchCache } from '../lib/dailyPackageFetchCache';

export default function App({ Component, pageProps }: AppProps) {
  // Install before the child App renders so its startup requests can use the cache.
  installDailyPackageFetchCache();

  // Database migrations are handled during build process (npm run migrate)
  return (
    <>
      {/* Global hand-drawn SVG filter defs for the doodle skin (visual-only) */}
      <DoodleDefs />
      <Component {...pageProps} />
    </>
  );
}
