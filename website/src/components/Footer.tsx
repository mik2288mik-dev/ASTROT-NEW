import Link from 'next/link';
import { brands, type Locale } from '@/lib/site';
import { getDictionary } from '@/lib/i18n';

export function Footer({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <strong>{brands[locale]}</strong>
          <p>{dict.footer.text}</p>
        </div>
        <nav aria-label="Legal">
          <Link href={`/${locale}/privacy`}>{dict.footer.privacy}</Link>
          <Link href={`/${locale}/terms`}>{dict.footer.terms}</Link>
          <Link href={`/${locale}/delete-account`}>{dict.footer.deleteAccount}</Link>
          <Link href={`/${locale}/support`}>{dict.footer.support}</Link>
        </nav>
      </div>
    </footer>
  );
}
