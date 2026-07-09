import type { AppProps } from 'next/app';
import '../styles/globals.css';
import '../styles/stickers.css';
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
