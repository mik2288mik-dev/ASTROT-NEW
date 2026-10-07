import Head from 'next/head';
import App from '../App';

export default function Home() {
  return <>
    <Head>
      <title>NEBO гороскоп натальная карта</title>
      <meta name="application-name" content="NEBO гороскоп натальная карта" />
      <link rel="icon" type="image/png" sizes="512x512" href="/assets/brand/nebo-app-icon-512.png" />
      <link rel="manifest" href="/site.webmanifest" />
      <meta name="robots" content="noindex,nofollow" />
    </Head>
    <App />
  </>;
}
