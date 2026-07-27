import Link from 'next/link';
import { getDictionary } from '@/lib/i18n';
import { brands, type Locale } from '@/lib/site';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Header({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link href={`/${locale}`} className="wordmark" aria-label={brands[locale]}>{brands[locale]}</Link>
        <nav className="primary-nav" aria-label="Primary">
          <Link href={`/${locale}#inside`}>{dict.nav.features}</Link>
          <Link href={`/${locale}/zodiac`}>{dict.nav.zodiac}</Link>
          <Link href={`/${locale}/guides`}>{dict.nav.guides}</Link>
          <Link href={`/${locale}/questions`}>{dict.nav.faq}</Link>
          <Link href={`/${locale}/support`}>{dict.nav.support}</Link>
        </nav>
        <LanguageSwitcher locale={locale} />
      </div>
    </header>
  );
}
