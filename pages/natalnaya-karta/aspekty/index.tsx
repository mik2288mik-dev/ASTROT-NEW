import Link from 'next/link';
import { PublicSeoPage } from '../../../components/public-site/PublicSeoPage';
import { PUBLIC_SEO_ASPECTS, PUBLIC_SEO_ASPECT_PLACEMENTS, PUBLIC_SEO_CHART_OBJECTS } from '../../../lib/publicSeoExpansion';

export default function AspectsHubPage() {
  return (
    <PublicSeoPage
      path="/natalnaya-karta/aspekty"
      title="Аспекты в натальной карте: соединение, квадрат, трин, оппозиция и секстиль"
      description="Как читать аспекты в натальной карте: пять основных типов связей между планетами и точками, 455 сочетаний и переход к подробным значениям."
      eyebrow="Натальная карта · аспекты"
      heading="Аспекты в натальной карте"
      lead={<p>Аспект показывает, как две функции карты работают вместе. Ни один аспект не читается отдельно от самих объектов и остальной карты.</p>}
      breadcrumbs={[{ name: 'Натальная карта', path: '/natalnaya-karta' }, { name: 'Аспекты', path: '/natalnaya-karta/aspekty' }]}
      schemaType="CollectionPage"
      faq={[
        { question: 'Какие аспекты считаются основными?', answer: 'Чаще всего отдельно рассматривают соединение, оппозицию, трин, квадрат и секстиль.' },
        { question: 'Есть ли хорошие и плохие аспекты?', answer: 'Такое деление слишком грубое. Одни связи работают легче, другие требуют больше согласования, но значение зависит от самих объектов и всей карты.' },
        { question: 'Можно ли читать один аспект отдельно?', answer: 'Можно понять его базовую механику, но выводы о человеке лучше делать только вместе с другими положениями карты.' },
      ]}
    >
      <section><h2>Пять базовых типов</h2><ul>{PUBLIC_SEO_ASPECTS.map((aspect) => <li key={aspect.key}><strong>{aspect.name}</strong> — {aspect.action}.</li>)}</ul></section>
      <section><h2>Объекты карты</h2><p>{PUBLIC_SEO_CHART_OBJECTS.map((item) => item.name).join(', ')}.</p></section>
      {PUBLIC_SEO_ASPECTS.map((aspect) => (
        <section key={aspect.key}>
          <h2>{aspect.name[0].toUpperCase()}{aspect.name.slice(1)}</h2>
          <ul>{PUBLIC_SEO_ASPECT_PLACEMENTS.filter((item) => item.aspect.key === aspect.key).map((item) => <li key={item.slug}><Link href={item.path}>{item.first.name} — {item.aspect.name} — {item.second.name}</Link></li>)}</ul>
        </section>
      ))}
    </PublicSeoPage>
  );
}
