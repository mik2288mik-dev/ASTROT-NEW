import Head from 'next/head';
import { STORE_RELEASE_CONFIG as config } from '../lib/storeReleaseConfig';

const pageStyle = { maxWidth: 760, margin: '0 auto', padding: '32px 20px', lineHeight: 1.6 };

export default function TermsPage() {
  return <main style={pageStyle}>
    <Head><title>User Agreement — {config.appName}</title><meta name="robots" content="index,follow" /></Head>
    <p><a href="#en">English</a></p>
    <section lang="ru">
      <h1>Пользовательское соглашение</h1>
      <p>Дата публикации: {config.publicationDate}. Сервис: {config.appName}. Оператор: {config.developerName}.</p>
      <h2>Назначение</h2><p>Приложение предоставляет развлекательные и информационные астрологические материалы. Они не являются медицинской, психологической, юридической или финансовой рекомендацией.</p>
      <h2>Учётная запись и данные</h2><p>Пользователь отвечает за корректность предоставленных данных. Удаление доступно в Настройках и на <a href={config.deleteAccountUrl}>публичной странице</a>.</p>
      <h2>Контакты</h2><p><a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a></p>
    </section>
    <hr />
    <section id="en" lang="en">
      <h1>User Agreement</h1>
      <p>Publication date: {config.publicationDate}. Service: {config.appName}. Controller: {config.developerName}.</p>
      <h2>Purpose</h2><p>The app provides entertainment and informational astrology content. It is not medical, psychological, legal, or financial advice.</p>
      <h2>Account and data</h2><p>The user is responsible for accurate data. Deletion is available in Settings and on the <a href={config.deleteAccountUrl}>public deletion page</a>.</p>
      <h2>Contact</h2><p><a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a></p>
    </section>
  </main>;
}
