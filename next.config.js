const isMobileBuild = process.env.MOBILE_BUILD === '1';

if (isMobileBuild && !process.env.NEXT_PUBLIC_API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL is required when MOBILE_BUILD=1');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
  // Next передаёт собственный экземпляр webpack в callback. Не require('webpack') здесь:
  // webpack не является прямой зависимостью проекта, и чистый Docker/npm ci обязан работать без
  // случайно оставшегося локального пакета в node_modules.
  webpack: (config, { isServer, webpack }) => {
    if (isMobileBuild) {
      config.plugins.push(new webpack.IgnorePlugin({
        resourceRegExp: /^\.\/lib\/notificationScheduler$/,
      }));
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
  // Для работы с Telegram WebApp
  ...(!isMobileBuild ? {
    async headers() {
      return [
      {
        // Telegram встраивает мини-апп в iframe — нужно всем путям
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL',
          },
        ],
      },
      {
        // HTML-оболочка приложения НЕ кэшируется, иначе Telegram держит
        // старую вёрстку до часа. Хешированные ассеты /_next/static Next
        // кэширует сам (immutable) — их это не трогает.
        source: '/',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0, must-revalidate',
          },
        ],
      },
      ];
    },
  } : {}),
};

module.exports = nextConfig;
