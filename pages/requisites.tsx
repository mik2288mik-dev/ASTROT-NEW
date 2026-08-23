import { LegalPage } from '../components/public-site/PublicSiteShell';
import { PUBLIC_SITE_CONFIG, mailto } from '../lib/publicSiteConfig';

export default function RequisitesPage() {
  const supportHref = mailto(PUBLIC_SITE_CONFIG.supportEmail, 'MEOU');

  return (
    <LegalPage
      title="Реквизиты и контакты"
      description="Реквизиты оператора MEOU, адрес и контакты поддержки и запросов по персональным данным."
      path="/requisites"
      lead={<p>Публичные реквизиты лица, которое предоставляет MEOU пользователям в России.</p>}
    >
      <section>
        <h2>Оператор и правообладатель</h2>
        <dl>
          <div><dt>Наименование</dt><dd>{PUBLIC_SITE_CONFIG.operatorName}</dd></div>
          <div><dt>ИНН</dt><dd>{PUBLIC_SITE_CONFIG.operatorInn}</dd></div>
          <div><dt>ОГРНИП</dt><dd>{PUBLIC_SITE_CONFIG.operatorOgrnip}</dd></div>
          <div><dt>Адрес</dt><dd>{PUBLIC_SITE_CONFIG.operatorAddress}</dd></div>
        </dl>
      </section>

      <section>
        <h2>Контакты</h2>
        <dl>
          <div>
            <dt>Поддержка</dt>
            <dd>{supportHref ? <a href={supportHref}>{PUBLIC_SITE_CONFIG.supportEmail}</a> : PUBLIC_SITE_CONFIG.supportEmail}</dd>
          </div>
          <div><dt>Персональные данные</dt><dd>{PUBLIC_SITE_CONFIG.privacyEmail}</dd></div>
          <div><dt>Сайт</dt><dd><a href={PUBLIC_SITE_CONFIG.baseUrl}>{PUBLIC_SITE_CONFIG.baseUrl}</a></dd></div>
        </dl>
      </section>
    </LegalPage>
  );
}
