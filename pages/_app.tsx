import type { AppProps } from 'next/app';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  // Note: Database migrations are handled automatically via:
  // 1. postbuild script (npm run migrate) after build
  // 2. API endpoint /api/migrations/run (can be called manually)
  // 3. Health check endpoint /api/health (runs migrations if needed)
  return <Component {...pageProps} />;
}
