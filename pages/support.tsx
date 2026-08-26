import { LegalPage } from '../components/public-site/PublicSiteShell';
import { PUBLIC_SITE_CONFIG, mailto } from '../lib/publicSiteConfig';

export default function SupportPage() {
  const supportHref = mailto(PUBLIC_SITE_CONFIG.supportEmail, 'Поддержка NEBO');
  const privacyHref = mailto(PUBLIC_SITE_CONFIG.privacyEmail, 'Персональные данные в NEBO');

  return (
    <LegalPage
      title="Поддержка NEBO"
      description="Контакты поддержки NEBO, запросы по аккаунту, оплате, персональным данным и удалению."
      path="/support"
      lead={<p>Письмо в поддержку откроется в вашем почтовом приложении. Ответ придёт на тот же адрес.</p>}
    >
      <section>
        <h2>Техническая поддержка</h2>
        <p>
          {supportHref ? <a href={supportHref}>{PUBLIC_SITE_CONFIG.supportEmail}</a> : PUBLIC_SITE_CONFIG.supportEmail}
        </p>
        <p>
          Укажите версию NEBO, модель устройства, версию Android и коротко опишите действие перед
          ошибкой. Не отправляйте пароль, одноразовый код, закрытый ключ, паспорт или
          банковские реквизиты.
        </p>
      </section>

      <section>
        <h2>Персональные данные</h2>
        <p>
          Запрос на доступ, исправление, отзыв согласия или удаление: {privacyHref ? (
            <a href={privacyHref}>{PUBLIC_SITE_CONFIG.privacyEmail}</a>
          ) : PUBLIC_SITE_CONFIG.privacyEmail}.
          Для удаления аккаунта сначала используйте путь NEBO → Настройки → Удалить аккаунт.
        </p>
      </section>

      <section>
        <h2>Покупки</h2>
        <p>
          Если Premium будет включён, приложите идентификатор покупки RuStore и название подписки.
          Данные банковской карты присылать не нужно. Оплата, отмена автопродления и возврат проходят
          по правилам RuStore; NEBO видит только статус покупки.
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
