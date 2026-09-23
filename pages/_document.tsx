import Document, { Head, Html, Main, NextScript } from 'next/document';

export default class NeboDocument extends Document {
  render() {
    const isUiPreviewBuild = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_UI_PREVIEW === '1';
    const isNativeMobileBuild = process.env.NEXT_PUBLIC_MOBILE_BUILD === '1' || process.env.MOBILE_BUILD === '1';
    const loadTelegramAppDependencies = !isUiPreviewBuild && !isNativeMobileBuild;

    return (
      <Html lang="ru" className="antialiased">
        <Head>
          <meta name="theme-color" content="#fbfaf8" />
          {loadTelegramAppDependencies ? <><script src="https://telegram.org/js/telegram-web-app.js"></script><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" /><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" /></> : null}
        </Head>
        <body>
          {/* Early Telegram WebApp initialization and desktop platform detection */}
          <script dangerouslySetInnerHTML={{ __html: `try{var tg=window.Telegram&&window.Telegram.WebApp;if(tg){tg.ready&&tg.ready();tg.expand&&tg.expand();}}catch(e){}` }} />
          <Main /><NextScript />
        </body>
      </Html>
    );
  }
}
