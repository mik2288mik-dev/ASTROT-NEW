import type { AppProps } from 'next/app';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  // Database migrations are handled during build process (npm run migrate)
  return <Component {...pageProps} />;
}
