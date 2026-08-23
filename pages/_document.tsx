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

export default class MeouDocument extends Document<MeouDocumentProps> {
  static async getInitialProps(ctx: DocumentContext): Promise<MeouDocumentProps> {
    const initialProps = await Document.getInitialProps(ctx);
    const publicWebsiteBuild = process.env.NEXT_PUBLIC_MEOU_PUBLIC_SITE === '1';
    const publicDocument = publicWebsiteBuild || PUBLIC_ROUTES.has(ctx.pathname);
    return { ...initialProps, publicDocument };
  }

  render() {
    const { publicDocument } = this.props;
    const isUiPreviewBuild = process.env.NODE_ENV === 'development'
      && process.env.NEXT_PUBLIC_UI_PREVIEW === '1';
    const loadTelegramAppDependencies = !publicDocument && !isUiPreviewBuild;

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
