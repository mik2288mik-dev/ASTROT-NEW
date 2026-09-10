import Link from 'next/link';
import { PageHead, PublicSiteShell, publicSiteStyles as styles } from '../components/public-site/PublicSiteShell';

export default function ServerErrorPage() {
  return (
    <PublicSiteShell>
      <PageHead
        title="Ошибка сервера — NEBO"
        description="NEBO временно не смог открыть эту страницу. Вернитесь на главную или попробуйте открыть страницу снова."
        path="/500"
        canonical={false}
        noindex
      />
      <main id="main-content" className={styles.legalMain}>
        <article className={styles.legalArticle}>
          <header className={styles.legalHeading}>
            <p className={styles.eyebrow}>Ошибка 500</p>
            <h1>Страница временно недоступна.</h1>
            <div className={styles.legalLead}>
              <p>Сайт не смог обработать запрос. Можно вернуться на главную и продолжить оттуда.</p>
            </div>
            <Link href="/">Вернуться на главную NEBO</Link>
          </header>
        </article>
      </main>
    </PublicSiteShell>
  );
}
