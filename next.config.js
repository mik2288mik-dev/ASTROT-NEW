const isMobileBuild = process.env.MOBILE_BUILD === '1';
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
    async headers() {
      return [{
        source: '/',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Cache-Control', value: 'no-store, max-age=0, must-revalidate' },
        ],
      }];
    },
  } : {}),
};

module.exports = nextConfig;
