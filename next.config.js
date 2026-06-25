/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Нативные/серверные пакеты не бандлим в серверный билд (в т.ч. instrumentation),
  // иначе webpack пытается разрешить нативный .node и падает.
  serverExternalPackages: ['swisseph-v2', 'pg', 'pg-native', 'tz-lookup'],
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
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Webpack конфигурация для исключения Node.js модулей из клиентского бандла
  webpack: (config, { isServer }) => {
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
};

module.exports = nextConfig;
