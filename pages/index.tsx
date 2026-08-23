import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import App from '../App';

const UiPreviewApp = dynamic(() => import('../components/ui-preview/UiPreviewApp'), {
  ssr: false,
});

const UI_PREVIEW_BUILD_ENABLED = process.env.NODE_ENV === 'development'
  && process.env.NEXT_PUBLIC_UI_PREVIEW === '1';

function isLocalPreviewHost(): boolean {
  return typeof window !== 'undefined'
    && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

export default function Home() {
  const router = useRouter();
  const [previewSurface, setPreviewSurface] = useState<'pending' | 'app' | 'preview'>(
    UI_PREVIEW_BUILD_ENABLED ? 'pending' : 'app',
  );

  useEffect(() => {
    if (!UI_PREVIEW_BUILD_ENABLED || !router.isReady) return;

    const previewRequested = router.query.uiPreview === '1';
    setPreviewSurface(previewRequested && isLocalPreviewHost() ? 'preview' : 'app');
  }, [router.isReady, router.query.uiPreview]);

  // The preview-enabled development server must render the same empty shell on
  // the server and during the first client pass. This prevents the real App
  // from mounting briefly and avoids a hydration mismatch in native Live View.
  if (previewSurface === 'pending') return null;
  if (previewSurface === 'preview') return <UiPreviewApp />;

  return <>
    <Head>
      <title>Твой гороскоп: натальная карта</title>
      <meta name="application-name" content="Твой гороскоп: натальная карта" />
      <meta name="robots" content="noindex,nofollow" />
    </Head>
    <App />
  </>;
}
