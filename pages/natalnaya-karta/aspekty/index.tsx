import Link from 'next/link';
import { PublicSeoPage } from '../../../components/public-site/PublicSeoPage';
import { PUBLIC_SEO_ASPECTS, PUBLIC_SEO_CHART_OBJECTS } from '../../../lib/publicSeoExpansion';

export default function AspectsHubPage() {
  return (
    <PublicSeoPage
      path="/natalnaya-karta/aspekty"
      title="Аспекты в натальной карте: соединение, квадрат, трин, оппозиция и секстиль"
      description="Как читать аспекты в натальной карте: пять основных типов связей между планетами и точками, примеры сочетаний и переход к подробным страницам."
      eyebrow="Натальная карта · аспекты"
      heading="Аспекты в натальной карте"
      lead={<p>Аспект показывает, как две функции карты работают вместе. Ни один аспект не читается отдельно от самих объектов и остальной карты.</p>}
      breadcrumbs={[
        { name: 'Натальная карта', path: '/natalnaya-karta' },
        { name: 'Аспекты', path: '/natalnaya-karta/aspekty' },
      ]}
      schemaType="CollectionPage"
      faq={[
        { question: 'Какие аспекты считаются основными?', answer: 'Чаще всего отдельно рассматривают соединение, оппозицию, трин, квадрат и секстиль.' },
        { question: 'Есть ли хорошие и плохие аспекты?', answer: 'Такое деление слишком грубое. Одни связи работают легче, другие требуют больше согласования, но значение зависит от самих объектов и всей карты.' },
        { question: 'Можно ли читать один аспект отдельно?', answer: 'Можно понять его базовую механику, но выводы о человеке лучше делать только вместе с другими положениями карты.' },
      ]}
    >
      <section>
        <h2>Пять базовых типов</h2>
        <ul>{PUBLIC_SEO_ASPECTS.map((aspect) => <li key={aspect.key}><strong>{aspect.name}</strong> — {aspect.action}.</li>)}</ul>
      </section>
      <section>
        <h2>Выбрать объект</h2>
        <p>В каталоге есть сочетания между десятью планетами и четырьмя дополнительными точками карты.</p>
        <ul>{PUBLIC_SEO_CHART_OBJECTS.map((item) => <li key={item.key}>{item.name}</li>)}</ul>
      </section>
      <section>
        <h2>С чего начать</h2>
        <p><Link href="/natalnaya-karta">Сначала построй натальную карту</Link>, затем найди нужный аспект в списке результатов и открой его подробное значение.</p>
      </section>
    </PublicSeoPage>
  );
}
