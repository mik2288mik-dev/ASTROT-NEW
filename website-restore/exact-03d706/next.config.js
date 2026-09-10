const isMobileBuild = process.env.MOBILE_BUILD === '1';
const isPublicWebsiteBuild = process.env.MEOU_PUBLIC_SITE === '1'
  || process.env.NEXT_PUBLIC_MEOU_PUBLIC_SITE === '1';
const isLegalPreview = process.env.NEXT_PUBLIC_LEGAL_PREVIEW === '1';
const distributionChannel = process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL;
const mobileDistributionChannels = new Set(['telegram', 'rustore', 'google_play', 'development']);
const excludesTelegramStars = isMobileBuild
  && (distributionChannel === 'google_play' || distributionChannel === 'rustore');

if (isMobileBuild && !process.env.NEXT_PUBLIC_API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL is required when MOBILE_BUILD=1');
}

if (isMobileBuild && !mobileDistributionChannels.has(distributionChannel)) {
  throw new Error('NEXT_PUBLIC_DISTRIBUTION_CHANNEL must be telegram, rustore, google_play, or development when MOBILE_BUILD=1');
}

// Keep the marketing/SEO site deployable even while operator/legal fields are
// being completed. Legal pages already perform their own readiness check and
// become draft/noindex when required public facts are missing, so incomplete
// legal configuration must not take the whole public site offline.

const publicScriptSource = process.env.NODE_ENV === 'development'
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://mc.yandex.ru"
  : "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://mc.yandex.ru";

const publicCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://mc.yandex.ru",
  "font-src 'self' data:",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: https://mc.yandex.ru",
  "object-src 'none'",
  publicScriptSource,
  "style-src 'self' 'unsafe-inline'",
  'upgrade-insecure-requests',
].join('; ');

const commonSecurityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const publicPageHeaders = [
  ...commonSecurityHeaders,
  { key: 'Content-Security-Policy', value: publicCsp },
  { key: 'X-Frame-Options', value: 'DENY' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Live View is the visual source of truth; keep Next's corner badge off the app navigation.
  devIndicators: false,
  output: isMobileBuild ? 'export' : 'standalone',
  // Нативные/серверные пакеты не бандлим в серверный билд (в т.ч. instrumentation),
  // иначе webpack пытается разрешить нативный .node и падает.
  serverExternalPackages: isMobileBuild ? [] : ['swisseph-v2', 'pg', 'pg-native', 'tz-lookup'],
  // Кладём файлы эфемерид (.se1) в standalone-сборку, иначе в проде их не найти
  // и расчёт уходит в Moshier-фолбэк. С ними — высокая точность Swiss Ephemeris.
  outputFileTracingIncludes: {
    '/api/**/*': ['./ephe/**/*'],
  },
  images: {
    domains: ['cdn.telegram.org'],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    unoptimized: isMobileBuild,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    NEXT_PUBLIC_MEOU_PUBLIC_SITE: isPublicWebsiteBuild ? '1' : '0',
  },
  webpack: (config, { isServer, webpack }) => {
    if (isMobileBuild) {
      config.plugins.push(new webpack.IgnorePlugin({
        resourceRegExp: /^\.\/lib\/notificationScheduler$/,
      }));
    }
    if (excludesTelegramStars) {
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(
        /[\\/]services[\\/]telegramStarsPayment\.ts$/,
        require.resolve('./services/telegramStarsPayment.disabled.ts'),
      ));
    }
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        'pg': false,
        'pg-native': false,
        'pg-connection-string': false,
      };
    }
    return config;
  },
  ...(!isMobileBuild ? {
    async redirects() {
      return [
        {
          source: '/:path*',
          has: [{ type: 'host', value: 'tvoi-goroskop.ru' }],
          destination: 'https://www.tvoi-goroskop.ru/:path*',
          statusCode: 301,
        },
        {
          source: '/contacts',
          destination: '/support',
          statusCode: 301,
        },
      ];
    },
    async headers() {
      if (isPublicWebsiteBuild) {
        return [{
          source: '/:path*',
          headers: [
            ...publicPageHeaders,
            ...(isLegalPreview ? [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] : []),
          ],
        }];
      }

      const publicRoutes = [
        '/404',
        '/delete-account',
        '/goroskop',
        '/goroskop/:path*',
        '/lichnyy-goroskop',
        '/natalnaya-karta',
        '/natalnaya-karta/:path*',
        '/personal-data-consent',
        '/privacy',
        '/requisites',
        '/site',
        '/sitemap.xml',
        '/sovmestimost',
        '/sovmestimost/:path*',
        '/support',
        '/terms',
      ];
      return [
        ...publicRoutes.map((source) => ({ source, headers: publicPageHeaders })),
        {
          // Telegram embeds only the app shell. Legal and marketing routes deny framing.
          source: '/',
          headers: [
            { key: 'X-Frame-Options', value: 'ALLOWALL' },
            { key: 'Cache-Control', value: 'no-store, max-age=0, must-revalidate' },
          ],
        },
      ];
    },
  } : {}),
};

module.exports = nextConfig;
