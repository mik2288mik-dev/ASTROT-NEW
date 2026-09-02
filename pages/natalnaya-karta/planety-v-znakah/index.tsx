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
      description="Солнце, Луна, Меркурий, Венера, Марс и другие планеты во всех 12 знаках: 120 отдельных разборов и ссылки на расчёт натальной карты."
      eyebrow="Натальная карта · планеты в знаках"
      heading="Планеты в знаках зодиака"
      lead={<p>Знак показывает, как в астрологической интерпретации выражается значение планеты. Здесь собраны все 120 сочетаний десяти основных планет и двенадцати знаков.</p>}
      breadcrumbs={[
        { name: 'Натальная карта', path: '/natalnaya-karta' },
        { name: 'Планеты в знаках', path },
      ]}
      schemaType="CollectionPage"
      relatedLinks={[
        { href: '/natalnaya-karta', label: 'Рассчитать натальную карту' },
        { href: '/natalnaya-karta/planety-v-domah', label: 'Планеты в домах' },
        { href: '/goroskop', label: 'Все знаки зодиака' },
      ]}
    >
      <section>
        <h2>Как читать положение планеты в знаке</h2>
        <p>Сначала смотрят, какую тему обозначает планета, затем — каким способом эта тема выражается через знак. Одно положение не описывает человека целиком: в полной карте его уточняют дом и аспекты.</p>
      </section>

      {PUBLIC_SEO_PLANETS.map((planet) => {
        const placements = PUBLIC_SEO_PLANET_SIGN_PLACEMENTS.filter((item) => item.planet.key === planet.key);
        return (
          <section key={planet.key}>
            <h2>{planet.name} в знаках</h2>
            <p>{planet.name} связывают с темой: {planet.meaning}. Выберите знак:</p>
            <ul>
              {placements.map((item) => (
                <li key={item.slug}>
                  <Link href={item.path}>{planet.name} в {item.sign.prepositional}</Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </PublicSeoPage>
  );
}
