import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import '../globals.css';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { absoluteUrl, brands, isLocale, locales, type Locale } from '@/lib/site';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    metadataBase: new URL(absoluteUrl('/')),
    title: { default: brands[locale], template: `%s | ${brands[locale]}` },
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
      other: process.env.BING_SITE_VERIFICATION ? { 'msvalidate.01': process.env.BING_SITE_VERIFICATION } : undefined,
    },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <html lang={locale}><body><Header locale={locale as Locale}/><main>{children}</main><Footer locale={locale as Locale}/></body></html>;
}
