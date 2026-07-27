import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Your Horoscope',
    short_name: 'Horoscope',
    description: 'Personal forecasts, natal chart, compatibility, and zodiac horoscopes.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f8fa',
    theme_color: '#18202b',
  };
}
