import Link from 'next/link';
import { PublicSeoPage } from '../../../components/public-site/PublicSeoPage';
import { PUBLIC_SEO_HOUSES } from '../../../lib/publicSeoHouses';

const path = '/natalnaya-karta/doma';

export default function HousesHubPage() {
  return (
    <PublicSeoPage
      path={path}
      title="Дома в натальной карте: значения 1–12 домов"
      description="Что означают 12 домов натальной карты и за какие вопросы обычно отвечает каждый из них."
      eyebrow="Натальная карта"
      heading="Дома в натальной карте"
      lead={<p>Натальная карта делится на двенадцать домов. У каждого свой круг вопросов: от первого впечатления и денег до отношений, карьеры и личного пространства.</p>}
      breadcrumbs={[{ name: 'Натальная карта', path: '/natalnaya-karta' }, { name: 'Дома', path }]}
      relatedLinks={[
        { href: '/natalnaya-karta/planety-v-domah', label: 'Планеты в домах' },
        { href: '/natalnaya-karta/planety-v-znakah', label: 'Планеты в знаках' },
        { href: '/natalnaya-karta', label: 'Натальная карта' },
      ]}
      schemaType="CollectionPage"
    >
      <section>
        <h2>Выбери дом</h2>
        <ul>
          {PUBLIC_SEO_HOUSES.map((house) => (
            <li key={house.slug}><Link href={house.path}>{house.title}</Link> — {house.shortAnswer}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Дом — только часть карты</h2>
        <p>Чтобы понять конкретную карту точнее, дом смотрят вместе со знаком и планетами внутри него. Один дом сам по себе не описывает человека целиком.</p>
      </section>
    </PublicSeoPage>
  );
}
