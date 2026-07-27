import Link from 'next/link';
import type { Metadata } from 'next';
import { absoluteUrl, brands, localeNames, locales, siteIndexable } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Your Horoscope',
  description: 'Choose your language for Your Horoscope.',
  robots: siteIndexable ? { index: true, follow: true } : { index: false, follow: true },
  alternates: { canonical: absoluteUrl('/'), languages: { ru: absoluteUrl('/ru'), en: absoluteUrl('/en'), es: absoluteUrl('/es'), 'x-default': absoluteUrl('/') } },
};

export default function LanguageRoot() {
  return (
    <main className="root-language">
      <section className="root-card">
        <p className="eyebrow">Your Horoscope</p>
        <h1>Choose your language</h1>
        <p>Русский · English · Español</p>
        <div className="root-links">
          {locales.map((locale) => <Link key={locale} href={`/${locale}`}><strong>{brands[locale]}</strong><br/><span>{localeNames[locale]}</span></Link>)}
        </div>
      </section>
    </main>
  );
}
