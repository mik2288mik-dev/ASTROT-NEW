import Document, {
  DocumentContext,
  DocumentInitialProps,
  Head,
  Html,
  Main,
  NextScript,
} from 'next/document';

type MeouDocumentProps = DocumentInitialProps & {
  publicDocument: boolean;
};

const PUBLIC_ROUTES = new Set([
  '/404',
  '/delete-account',
  '/personal-data-consent',
  '/privacy',
  '/requisites',
  '/site',
  '/support',
  '/terms',
]);

const PUBLIC_ROUTE_PREFIXES = [
  '/goroskop',
  '/lichnyy-goroskop',
  '/natalnaya-karta',
  '/sovmestimost',
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.has(pathname)
    || PUBLIC_ROUTE_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
}

export default class MeouDocument extends Document<MeouDocumentProps> {
  static async getInitialProps(ctx: DocumentContext): Promise<MeouDocumentProps> {
    const initialProps = await Document.getInitialProps(ctx);
    const publicWebsiteBuild = process.env.NEXT_PUBLIC_MEOU_PUBLIC_SITE === '1';
    const publicDocument = publicWebsiteBuild || isPublicRoute(ctx.pathname);
    return { ...initialProps, publicDocument };
  }

  render() {
    const { publicDocument } = this.props;
    const isUiPreviewBuild = process.env.NODE_ENV === 'development'
      && process.env.NEXT_PUBLIC_UI_PREVIEW === '1';
    const isMobileBuild = process.env.NEXT_PUBLIC_MOBILE_BUILD === '1'
      || process.env.MOBILE_BUILD === '1';
    // Native Android must be able to render its local loading shell before any
    // external network is reachable. A parser-blocking Telegram script in <head>
    // can otherwise leave a device on a completely white screen before React or
    // the API client ever starts.
    const loadTelegramAppDependencies = !publicDocument && !isUiPreviewBuild && !isMobileBuild;

    return (
      <Html lang="ru" className="antialiased">
        <Head>
          <meta name="theme-color" content="#fbfaf8" />
          {loadTelegramAppDependencies ? (
            <>
              <script src="https://telegram.org/js/telegram-web-app.js"></script>
              <link rel="preconnect" href="https://fonts.googleapis.com" />
              <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
              <link
                href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
                rel="stylesheet"
              />
            </>
          ) : null}
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
