import dynamic from 'next/dynamic';
import Head from 'next/head';

const CanvasApp = dynamic(() => import('../components/canvasApp/CanvasApp'), { ssr: false });

export default function CanvasPage() {
  return (
    <>
      <Head>
        <title>NEBO</title>
        <meta name="robots" content="noindex" />
      </Head>
      <CanvasApp />
    </>
  );
}
