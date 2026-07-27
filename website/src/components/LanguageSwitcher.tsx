import Link from 'next/link';
import { localeNames, locales, type Locale } from '@/lib/site';

export function LanguageSwitcher({ locale, path = '' }: { locale: Locale; path?: string }) {
  return (
    <nav aria-label="Language" className="language-switcher">
      {locales.map((item) => (
        <Link key={item} href={`/${item}${path ? `/${path.replace(/^\//, '')}` : ''}`} aria-current={item === locale ? 'page' : undefined}>
          {localeNames[item]}
        </Link>
      ))}
    </nav>
  );
}
