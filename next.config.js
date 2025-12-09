/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    EPHE_PATH: process.env.EPHE_PATH,
    WEATHER_API: process.env.WEATHER_API,
  },
  // Оптимизация изображений
  images: {
    domains: ['cdn.telegram.org'], // Telegram CDN для аватарок
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60, // Кэшировать изображения минимум 60 секунд
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
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, must-revalidate',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
