import Link from 'next/link';
import { PublicSeoPage } from '../../../components/public-site/PublicSeoPage';
import {
  PUBLIC_SEO_PLANETS,
  PUBLIC_SEO_PLANET_HOUSE_PLACEMENTS,
} from '../../../lib/publicSeoPlacements';

const path = '/natalnaya-karta/planety-v-domah';

export default function PlanetsInHousesHubPage() {
  return (
    <PublicSeoPage
      path={path}
      title="Планеты в домах натальной карты"
      description="Что означают Солнце, Луна, Меркурий, Венера, Марс и другие планеты в домах натальной карты."
      eyebrow="Натальная карта · планеты в домах"
      heading="Планеты в домах натальной карты"
      lead={<p>Выбери планету и дом, чтобы посмотреть, какие вопросы обычно связывают с таким положением.</p>}
      breadcrumbs={[
        { name: 'Натальная карта', path: '/natalnaya-karta' },
        { name: 'Планеты в домах', path },
      ]}
      schemaType="CollectionPage"
      relatedLinks={[
        { href: '/natalnaya-karta', label: 'Натальная карта' },
        { href: '/natalnaya-karta/planety-v-znakah', label: 'Планеты в знаках' },
        { href: '/natalnaya-karta/doma', label: 'Дома натальной карты' },
      ]}
    >
      <section>
        <h2>Как это читать</h2>
        <p>Планета показывает одну часть карты, а дом — где эта часть чаще становится заметной. Чтобы определить дома точно, важны время и место рождения.</p>
      </section>

      {PUBLIC_SEO_PLANETS.map((planet) => {
        const placements = PUBLIC_SEO_PLANET_HOUSE_PLACEMENTS.filter((item) => item.planet.key === planet.key);
        return (
          <section key={planet.key}>
            <h2>{planet.name} в домах</h2>
            <p>{planet.meaning} Выбери дом:</p>
            <ul>
              {placements.map((item) => (
                <li key={item.slug}><Link href={item.path}>{planet.name} в {item.house.name}</Link></li>
              ))}
            </ul>
          </section>
        );
      })}
    </PublicSeoPage>
  );
}
