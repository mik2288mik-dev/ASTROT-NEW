import Link from 'next/link';
import { PublicSeoPage } from '../../../components/public-site/PublicSeoPage';
import { PUBLIC_SEO_POINTS, PUBLIC_SEO_POINT_SIGN_PLACEMENTS } from '../../../lib/publicSeoExpansion';
import { PUBLIC_SEO_SIGNS } from '../../../lib/publicSeoContent';

export default function PointsInSignsHubPage() {
  return (
    <PublicSeoPage
      path="/natalnaya-karta/tochki-v-znakah"
      title="Узлы, Хирон и Лилит в знаках натальной карты"
      description="Северный и Южный узлы, Хирон и Лилит в двенадцати знаках: 48 сочетаний с отдельными страницами и понятными значениями."
      eyebrow="Натальная карта · точки в знаках"
      heading="Точки карты в знаках"
      lead={<p>Знак показывает, каким способом проявляется функция точки. Здесь — Северный узел, Южный узел, Хирон и Лилит во всех двенадцати знаках.</p>}
      breadcrumbs={[{ name: 'Натальная карта', path: '/natalnaya-karta' }, { name: 'Точки в знаках', path: '/natalnaya-karta/tochki-v-znakah' }]}
      schemaType="CollectionPage"
    >
      <section><h2>Что есть в разделе</h2><p>{PUBLIC_SEO_SIGNS.map((sign) => sign.name).join(', ')}.</p></section>
      {PUBLIC_SEO_POINTS.map((point) => (
        <section key={point.key}>
          <h2>{point.name} в знаках</h2>
          <p>{point.meaning}.</p>
          <ul>{PUBLIC_SEO_POINT_SIGN_PLACEMENTS.filter((item) => item.point.key === point.key).map((item) => <li key={item.slug}><Link href={item.path}>{item.point.name} в {item.sign.prepositional}</Link></li>)}</ul>
        </section>
      ))}
    </PublicSeoPage>
  );
}
