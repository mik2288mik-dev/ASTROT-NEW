import Link from 'next/link';
import { PublicSeoPage } from '../../../components/public-site/PublicSeoPage';
import {
  PUBLIC_SEO_PLANETS,
  PUBLIC_SEO_PLANET_SIGN_PLACEMENTS,
} from '../../../lib/publicSeoPlacements';

const path = '/natalnaya-karta/planety-v-znakah';

export default function PlanetsInSignsHubPage() {
  return (
    <PublicSeoPage
      path={path}
      title="Планеты в знаках зодиака в натальной карте"
      description="Что означают Солнце, Луна, Меркурий, Венера, Марс и другие планеты в разных знаках зодиака."
      eyebrow="Натальная карта · планеты в знаках"
      heading="Планеты в знаках зодиака"
      lead={<p>Выбери планету и знак, чтобы посмотреть, как обычно читают такое положение в натальной карте.</p>}
      breadcrumbs={[
        { name: 'Натальная карта', path: '/natalnaya-karta' },
        { name: 'Планеты в знаках', path },
      ]}
      schemaType="CollectionPage"
      relatedLinks={[
        { href: '/natalnaya-karta', label: 'Натальная карта' },
        { href: '/natalnaya-karta/planety-v-domah', label: 'Планеты в домах' },
        { href: '/goroskop', label: 'Знаки зодиака' },
      ]}
    >
      <section>
        <h2>Как это читать</h2>
        <p>Планета отвечает за одну часть карты, а знак показывает, как она обычно выражается. Одного положения мало, чтобы описать человека целиком — остальные части карты тоже важны.</p>
      </section>

      {PUBLIC_SEO_PLANETS.map((planet) => {
        const placements = PUBLIC_SEO_PLANET_SIGN_PLACEMENTS.filter((item) => item.planet.key === planet.key);
        return (
          <section key={planet.key}>
            <h2>{planet.name} в знаках</h2>
            <p>{planet.meaning} Выбери знак:</p>
            <ul>
              {placements.map((item) => (
                <li key={item.slug}><Link href={item.path}>{planet.name} в {item.sign.prepositional}</Link></li>
              ))}
            </ul>
          </section>
        );
      })}
    </PublicSeoPage>
  );
}
