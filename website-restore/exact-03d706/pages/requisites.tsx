import { LegalPage } from '../components/public-site/PublicSiteShell';
import { PUBLIC_SITE_CONFIG, mailto } from '../lib/publicSiteConfig';

export default function RequisitesPage() {
  const supportHref = mailto(PUBLIC_SITE_CONFIG.supportEmail, 'NEBO');

  return (
    <LegalPage
      title="Реквизиты и контакты"
      description="Реквизиты ИП — оператора NEBO, ОГРНИП, ИНН и контактный email."
      path="/requisites"
      lead={<p>Публичные реквизиты лица, которое предоставляет NEBO пользователям в России.</p>}
    >
      <section>
        <h2>Оператор</h2>
        <div>
          <p><strong>{PUBLIC_SITE_CONFIG.operatorName}</strong></p>
          <p><strong>ОГРНИП</strong> {PUBLIC_SITE_CONFIG.operatorOgrnip}</p>
          <p><strong>ИНН</strong> {PUBLIC_SITE_CONFIG.operatorInn}</p>
          <p>
            {supportHref ? <a href={supportHref}>{PUBLIC_SITE_CONFIG.supportEmail}</a> : PUBLIC_SITE_CONFIG.supportEmail}
          </p>
        </div>
      </section>
    </LegalPage>
  );
}
