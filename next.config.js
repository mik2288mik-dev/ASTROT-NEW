const isMobileBuild = process.env.MOBILE_BUILD === '1';
const isPublicWebsiteBuild = process.env.MEOU_PUBLIC_SITE === '1'
  || process.env.NEXT_PUBLIC_MEOU_PUBLIC_SITE === '1';
const isLegalPreview = process.env.NEXT_PUBLIC_LEGAL_PREVIEW === '1';
const distributionChannel = process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL;
const excludesTelegramStars = isMobileBuild
  && (distributionChannel === 'google_play' || distributionChannel === 'rustore');

if (isMobileBuild && !process.env.NEXT_PUBLIC_API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL is required when MOBILE_BUILD=1');
}

const publicScriptSource = process.env.NODE_ENV === 'development'
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const publicCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self'",
  "font-src 'self' data:",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "object-src 'none'",
  publicScriptSource,
  "style-src 'self' 'unsafe-inline'",
  'upgrade-insecure-requests',
].join('; ');

const commonSecurityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
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
  // Оптимизация изображений
  images: {
    domains: ['cdn.telegram.org'], // Telegram CDN для аватарок
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60, // Кэшировать изображения минимум 60 секунд
    unoptimized: isMobileBuild,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    NEXT_PUBLIC_MEOU_PUBLIC_SITE: isPublicWebsiteBuild ? '1' : '0',
  },
  // Next передаёт собственный экземпляр webpack в callback. Не require('webpack') здесь:
  // webpack не является прямой зависимостью проекта, и чистый Docker/npm ci обязан работать без
  // случайно оставшегося локального пакета в node_modules.
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
      // Исключаем Node.js модули из клиентского бандла
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
          permanent: true,
        },
        {
          source: '/contacts',
          destination: '/support',
          permanent: true,
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
        '/personal-data-consent',
        '/privacy',
        '/requisites',
        '/site',
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
