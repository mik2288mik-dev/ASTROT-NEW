import { PageHead, PublicSiteShell } from '../components/public-site/PublicSiteShell';
import { NeboLanding } from '../components/public-site/NeboLanding';
import { PUBLIC_SITE_CONFIG, isRuStorePublished } from '../lib/publicSiteConfig';

const title = 'NEBO — личный гороскоп, натальная карта и совместимость';
const description = 'NEBO — личный прогноз на сегодня, неделю и месяц, натальная карта по дате рождения, совместимость и гороскопы всех знаков.';

function homeSchema() {
  const software: Record<string, unknown> = {
    '@type': 'SoftwareApplication',
    '@id': `${PUBLIC_SITE_CONFIG.baseUrl}/#application`,
    name: 'NEBO',
    url: PUBLIC_SITE_CONFIG.baseUrl,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Android',
    inLanguage: 'ru-RU',
    description,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'RUB',
      availability: isRuStorePublished() ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
    },
  };
  if (isRuStorePublished()) software.downloadUrl = PUBLIC_SITE_CONFIG.rustoreUrl;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${PUBLIC_SITE_CONFIG.baseUrl}/#website`,
        name: 'NEBO',
        url: PUBLIC_SITE_CONFIG.baseUrl,
        inLanguage: 'ru-RU',
        description,
      },
      software,
    ],
  };
}

export default function PublicLandingPage() {
  return (
    <PublicSiteShell>
      <PageHead title={title} description={description} path="/" jsonLd={homeSchema()} />
      <NeboLanding />
    </PublicSiteShell>
  );
}
