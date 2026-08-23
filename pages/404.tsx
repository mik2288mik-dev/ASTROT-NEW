import Link from 'next/link';
import { PageHead, PublicSiteShell, publicSiteStyles as styles } from '../components/public-site/PublicSiteShell';

export default function NotFoundPage() {
  return (
    <PublicSiteShell>
      <PageHead
        title="Страница не найдена — MEOU"
        description="Такой страницы на сайте MEOU нет."
        path="/404"
        canonical={false}
        noindex
      />
      <main id="main-content" className={styles.legalMain}>
        <article className={styles.legalArticle}>
          <header className={styles.legalHeading}>
            <p className={styles.eyebrow}>Ошибка 404</p>
            <h1>Такой страницы нет.</h1>
            <div className={styles.legalLead}>
              <p>Возможно, ссылка устарела или в адресе есть опечатка.</p>
            </div>
            <Link href="/">Вернуться на главную MEOU</Link>
          </header>
        </article>
      </main>
    </PublicSiteShell>
  );
}
