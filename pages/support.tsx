import { LegalPage } from '../components/public-site/PublicSiteShell';
import { PUBLIC_SITE_CONFIG, mailto } from '../lib/publicSiteConfig';

export default function SupportPage() {
  const supportHref = mailto(PUBLIC_SITE_CONFIG.supportEmail, 'Поддержка MEOU');
  const privacyHref = mailto(PUBLIC_SITE_CONFIG.privacyEmail, 'Персональные данные в MEOU');

  return (
    <LegalPage
      title="Поддержка MEOU"
      description="Контакты поддержки MEOU, запросы по аккаунту, оплате, персональным данным и удалению."
      path="/support"
      lead={<p>На первом релизе сайт не собирает обращения через форму: письмо открывается в вашем почтовом приложении.</p>}
    >
      <section>
        <h2>Техническая поддержка</h2>
        <p>
          {supportHref ? <a href={supportHref}>{PUBLIC_SITE_CONFIG.supportEmail}</a> : PUBLIC_SITE_CONFIG.supportEmail}
        </p>
        <p>
          Укажите версию MEOU, модель устройства, версию Android и коротко опишите действие перед
          ошибкой. Не отправляйте пароль, одноразовый код, приватный key, полный token, паспорт или
          банковские реквизиты.
        </p>
      </section>

      <section>
        <h2>Персональные данные</h2>
        <p>
          Запрос на доступ, исправление, отзыв согласия или удаление: {privacyHref ? (
            <a href={privacyHref}>{PUBLIC_SITE_CONFIG.privacyEmail}</a>
          ) : PUBLIC_SITE_CONFIG.privacyEmail}.
          Для удаления аккаунта сначала используйте путь MEOU → Настройки → Удалить аккаунт.
        </p>
      </section>

      <section>
        <h2>Покупки</h2>
        <p>
          Если Premium будет включён, приложите RuStore purchase ID и название товара, но не данные
          карты. Оплата, отмена автопродления и возврат выполняются по правилам RuStore; MEOU проверяет
          только серверный статус покупки.
        </p>
      </section>

      <section>
        <h2>Полезные страницы</h2>
        <ul>
          <li><a href="/delete-account">Удаление аккаунта и данных</a></li>
          <li><a href="/privacy">Политика обработки персональных данных</a></li>
          <li><a href="/terms">Пользовательское соглашение</a></li>
          <li><a href="/requisites">Реквизиты оператора</a></li>
        </ul>
      </section>
    </LegalPage>
  );
}
