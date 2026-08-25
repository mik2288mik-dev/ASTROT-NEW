import { LegalPage } from '../components/public-site/PublicSiteShell';
import { PUBLIC_SITE_CONFIG } from '../lib/publicSiteConfig';

export default function RequisitesPage() {
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
          <div><dt>Поддержка</dt><dd><a href="/support">Форма обратной связи</a></dd></div>
          <div><dt>Персональные данные</dt><dd><a href="/support">Запрос через форму поддержки</a></dd></div>
          <div><dt>Сайт</dt><dd><a href={PUBLIC_SITE_CONFIG.baseUrl}>{PUBLIC_SITE_CONFIG.baseUrl}</a></dd></div>
        </dl>
      </section>
    </LegalPage>
  );
}
