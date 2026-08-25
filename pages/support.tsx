import { LegalPage } from '../components/public-site/PublicSiteShell';
import { SupportForm } from '../components/public-site/SupportForm';

export default function SupportPage() {
  return (
    <LegalPage
      title="Поддержка MEOU"
      description="Форма поддержки MEOU по вопросам приложения, входа, Premium, оплаты и персональных данных."
      path="/support"
      lead={<p>Опишите вопрос в форме. Ответ придёт на email, который вы укажете.</p>}
    >
      <section>
        <SupportForm />
      </section>

      <section>
        <h2>Быстрые ссылки</h2>
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
