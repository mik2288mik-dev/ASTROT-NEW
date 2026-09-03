import { PublicSeoPage } from '../../../components/public-site/PublicSeoPage';
import { PUBLIC_SEO_POINTS } from '../../../lib/publicSeoExpansion';
import { PUBLIC_SEO_HOUSES } from '../../../lib/publicSeoHouses';

export default function PointsInHousesHubPage() {
  return (
    <PublicSeoPage
      path="/natalnaya-karta/tochki-v-domah"
      title="Узлы, Хирон и Лилит в домах натальной карты"
      description="Северный и Южный узлы, Хирон и Лилит в двенадцати домах: где проявляется функция каждой точки и как читать её вместе с остальной картой."
      eyebrow="Натальная карта · точки в домах"
      heading="Точки карты в домах"
      lead={<p>Дом отвечает на вопрос «где именно это проявляется». Здесь собраны четыре дополнительные точки карты во всех двенадцати домах.</p>}
      breadcrumbs={[{ name: 'Натальная карта', path: '/natalnaya-karta' }, { name: 'Точки в домах', path: '/natalnaya-karta/tochki-v-domah' }]}
      schemaType="CollectionPage"
    >
      <section><h2>Точки</h2><ul>{PUBLIC_SEO_POINTS.map((point) => <li key={point.key}><strong>{point.name}</strong> — {point.meaning}.</li>)}</ul></section>
      <section><h2>Дома</h2><p>{PUBLIC_SEO_HOUSES.map((house) => `${house.house} дом`).join(', ')}.</p></section>
    </PublicSeoPage>
  );
}
