import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import App from '../App';

const CanvasApp = dynamic(() => import('../components/canvasApp/CanvasApp'), { ssr: false });

/** A plain entry opens the new interface. Any link with parameters (sign-in returns, deep links, payment) stays with the old app. */
function chooseInterface(): 'canvas' | 'classic' {
  return window.location.search ? 'classic' : 'canvas';
}

export default function Home() {
  const [ui, setUi] = useState<'canvas' | 'classic' | null>(null);
  useEffect(() => setUi(chooseInterface()), []);
  return <>
    <Head>
      <title>NEBO гороскоп натальная карта</title>
      <meta name="application-name" content="NEBO гороскоп натальная карта" />
      <link rel="icon" type="image/png" sizes="512x512" href="/assets/brand/nebo-app-icon-512.png" />
      <link rel="manifest" href="/site.webmanifest" />
      <meta name="robots" content="noindex,nofollow" />
    </Head>
    {ui === 'canvas' ? <CanvasApp /> : ui === 'classic' ? <App /> : null}
  </>;
}
