import Head from 'next/head';
import { STORE_RELEASE_CONFIG as config } from '../lib/storeReleaseConfig';

const pageStyle = { maxWidth: 760, margin: '0 auto', padding: '32px 20px', lineHeight: 1.6 };

export default function PrivacyPage() {
  return <main style={pageStyle}>
    <Head><title>Privacy Policy — {config.appName}</title><meta name="robots" content="index,follow" /></Head>
    <p><a href="#en">English</a></p>
    <section lang="ru">
      <h1>Политика конфиденциальности</h1>
      <p>Дата публикации: {config.publicationDate}. Оператор: {config.developerName}.</p>
      <h2>Какие данные нужны сервису</h2>
      <p>Сервис обрабатывает данные профиля и рождения, сохранённые натальные карты, персональные прогнозы и вопросы, настройки уведомлений, технические данные сессии и статус Premium. Это нужно, чтобы предоставить персональные функции и защитить учётную запись.</p>
      <h2>Передача и хранение</h2>
      <p>Фактические категории данных, места хранения и подключённые сервисы перечислены в опубликованной версии этого документа и должны соответствовать реальному Data Inventory. Данные не продаются.</p>
      <h2>Удаление аккаунта</h2>
      <p>Удалить аккаунт можно в приложении: Настройки → Удалить аккаунт. Публичный путь и описание удаления: <a href={config.deleteAccountUrl}>{config.deleteAccountUrl}</a>.</p>
      <h2>Контакты</h2><p><a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a></p>
    </section>
    <hr />
    <section id="en" lang="en">
      <h1>Privacy Policy</h1>
      <p>Publication date: {config.publicationDate}. Data controller: {config.developerName}.</p>
      <h2>Data used by the service</h2>
      <p>The service processes profile and birth data, saved natal charts, personal forecasts and questions, notification preferences, session technical data, and Premium status to provide personalised features and protect the account.</p>
      <h2>Retention and sharing</h2>
      <p>The published version must list the actual data categories, storage locations, and connected services from the Data Inventory. Personal data is not sold.</p>
      <h2>Account deletion</h2>
      <p>Delete an account in the app through Settings → Delete account. The public deletion path is <a href={config.deleteAccountUrl}>{config.deleteAccountUrl}</a>.</p>
      <h2>Contact</h2><p><a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a></p>
    </section>
  </main>;
}
