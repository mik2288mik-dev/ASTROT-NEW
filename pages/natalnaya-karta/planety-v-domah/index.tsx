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
      description="Солнце, Луна, Меркурий, Венера, Марс и другие планеты во всех 12 домах: 120 отдельных разборов и ссылки на расчёт натальной карты."
      eyebrow="Натальная карта · планеты в домах"
      heading="Планеты в домах натальной карты"
      lead={<p>Дом показывает, в каких жизненных вопросах заметнее тема планеты. Здесь собраны все 120 сочетаний десяти основных планет и двенадцати домов.</p>}
      breadcrumbs={[
        { name: 'Натальная карта', path: '/natalnaya-karta' },
        { name: 'Планеты в домах', path },
      ]}
      schemaType="CollectionPage"
      relatedLinks={[
        { href: '/natalnaya-karta', label: 'Рассчитать натальную карту' },
        { href: '/natalnaya-karta/planety-v-znakah', label: 'Планеты в знаках' },
        { href: '/goroskop', label: 'Все знаки зодиака' },
      ]}
    >
      <section>
        <h2>Как читать планету в доме</h2>
        <p>Планета обозначает тему, а дом — область жизни, где эта тема чаще проявляется в астрологической интерпретации. Точное положение по домам зависит от времени и места рождения и выбранной системы домов.</p>
      </section>

      {PUBLIC_SEO_PLANETS.map((planet) => {
        const placements = PUBLIC_SEO_PLANET_HOUSE_PLACEMENTS.filter((item) => item.planet.key === planet.key);
        return (
          <section key={planet.key}>
            <h2>{planet.name} в домах</h2>
            <p>{planet.name} связывают с темой: {planet.meaning}. Выберите дом:</p>
            <ul>
              {placements.map((item) => (
                <li key={item.slug}>
                  <Link href={item.path}>{planet.name} в {item.house.name}</Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </PublicSeoPage>
  );
}
