import { PublicSeoPage } from '../../../components/public-site/PublicSeoPage';
import { PUBLIC_SEO_POINTS } from '../../../lib/publicSeoExpansion';
import { PUBLIC_SEO_SIGNS } from '../../../lib/publicSeoContent';

export default function PointsInSignsHubPage() {
  return (
    <PublicSeoPage
      path="/natalnaya-karta/tochki-v-znakah"
      title="Узлы, Хирон и Лилит в знаках натальной карты"
      description="Северный и Южный узлы, Хирон и Лилит в двенадцати знаках: что показывает знак каждой точки и как читать её вместе с остальной натальной картой."
      eyebrow="Натальная карта · точки в знаках"
      heading="Точки карты в знаках"
      lead={<p>Знак показывает, каким способом проявляется функция точки. В этом разделе — Северный узел, Южный узел, Хирон и Лилит во всех двенадцати знаках.</p>}
      breadcrumbs={[{ name: 'Натальная карта', path: '/natalnaya-karta' }, { name: 'Точки в знаках', path: '/natalnaya-karta/tochki-v-znakah' }]}
      schemaType="CollectionPage"
    >
      <section><h2>Какие точки есть в каталоге</h2><ul>{PUBLIC_SEO_POINTS.map((point) => <li key={point.key}><strong>{point.name}</strong> — {point.meaning}.</li>)}</ul></section>
      <section><h2>Какие знаки рассматриваются</h2><p>{PUBLIC_SEO_SIGNS.map((sign) => sign.name).join(', ')}.</p></section>
    </PublicSeoPage>
  );
}
