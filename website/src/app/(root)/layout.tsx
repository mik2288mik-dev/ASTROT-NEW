import type { Metadata } from 'next';
import '../globals.css';
import { absoluteUrl } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl('/')),
  title: 'Your Horoscope',
  description: 'Personal forecasts, natal chart, compatibility, and zodiac horoscopes.',
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION ? { 'msvalidate.01': process.env.BING_SITE_VERIFICATION } : undefined,
  },
};

export default function RootLanguageLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
