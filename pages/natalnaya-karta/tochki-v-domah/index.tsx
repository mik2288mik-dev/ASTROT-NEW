import Link from 'next/link';
import { PublicSeoPage } from '../../../components/public-site/PublicSeoPage';
import { PUBLIC_SEO_POINTS, PUBLIC_SEO_POINT_HOUSE_PLACEMENTS } from '../../../lib/publicSeoExpansion';
import { PUBLIC_SEO_HOUSES } from '../../../lib/publicSeoHouses';

export default function PointsInHousesHubPage() {
  return (
    <PublicSeoPage
      path="/natalnaya-karta/tochki-v-domah"
      title="Узлы, Хирон и Лилит в домах натальной карты"
      description="Северный и Южный узлы, Хирон и Лилит в двенадцати домах: 48 сочетаний с отдельными страницами и понятными значениями."
      eyebrow="Натальная карта · точки в домах"
      heading="Точки карты в домах"
      lead={<p>Дом отвечает на вопрос «где именно это проявляется». Здесь собраны четыре дополнительные точки карты во всех двенадцати домах.</p>}
      breadcrumbs={[{ name: 'Натальная карта', path: '/natalnaya-karta' }, { name: 'Точки в домах', path: '/natalnaya-karta/tochki-v-domah' }]}
      schemaType="CollectionPage"
    >
      <section><h2>Что есть в разделе</h2><p>{PUBLIC_SEO_HOUSES.map((house) => `${house.house} дом`).join(', ')}.</p></section>
      {PUBLIC_SEO_POINTS.map((point) => (
        <section key={point.key}>
          <h2>{point.name} в домах</h2>
          <p>{point.meaning}.</p>
          <ul>{PUBLIC_SEO_POINT_HOUSE_PLACEMENTS.filter((item) => item.point.key === point.key).map((item) => <li key={item.slug}><Link href={item.path}>{item.point.name} в {item.house.house} доме</Link></li>)}</ul>
        </section>
      ))}
    </PublicSeoPage>
  );
}
