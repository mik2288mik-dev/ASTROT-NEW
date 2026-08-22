import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  const isUiPreviewBuild = process.env.NODE_ENV === 'development'
    && process.env.NEXT_PUBLIC_UI_PREVIEW === '1';

  return (
    <Html lang="en">
      <Head>
        <title>Твой Гороскоп</title>
        <meta name="application-name" content="Твой Гороскоп" />
        <meta name="theme-color" content="#FFFFFF" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        {!isUiPreviewBuild ? <script src="https://telegram.org/js/telegram-web-app.js"></script> : null}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
