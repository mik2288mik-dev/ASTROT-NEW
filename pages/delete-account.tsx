import Head from 'next/head';
import { STORE_RELEASE_CONFIG as config } from '../lib/storeReleaseConfig';

const pageStyle = { maxWidth: 760, margin: '0 auto', padding: '32px 20px', lineHeight: 1.6 };

export default function DeleteAccountPage() {
  return <main style={pageStyle}>
    <Head><title>Delete account — {config.appName}</title><meta name="robots" content="index,follow" /></Head>
    <p><a href="#en">English</a></p>
    <section lang="ru">
      <h1>Удаление аккаунта и данных</h1>
      <p>Войдите в приложение и выберите Настройки → Удалить аккаунт. После подтверждения сервер удаляет аккаунт и связанные с ним пользовательские данные; активные сессии перестают работать.</p>
      <p>Если войти в приложение невозможно, запрос можно направить в поддержку: <a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a>. Способ проверки личности и сроки ответа должны быть заполнены оператором до публикации.</p>
      <p>Исключения из удаления и сроки хранения перечисляются в Политике конфиденциальности после юридической проверки.</p>
    </section>
    <hr />
    <section id="en" lang="en">
      <h1>Account and data deletion</h1>
      <p>Sign in to the app and choose Settings → Delete account. After confirmation, the server deletes the account and associated personal data; active sessions stop working.</p>
      <p>If you cannot sign in, contact support at <a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a>. The controller must add identity-verification steps and response times before publication.</p>
      <p>Any retention exceptions and periods will be listed in the Privacy Policy after legal review.</p>
    </section>
  </main>;
}
