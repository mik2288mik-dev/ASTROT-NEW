import Link from 'next/link';
import { PublicSeoPage } from '../../../components/public-site/PublicSeoPage';
import { PUBLIC_SEO_HOUSES } from '../../../lib/publicSeoHouses';

const path = '/natalnaya-karta/doma';

export default function HousesHubPage() {
  return (
    <PublicSeoPage
      path={path}
      title="Дома в натальной карте: значения 1–12 домов"
      description="Все 12 домов натальной карты: что означает каждый дом, какие вопросы к нему относят и как читать планеты в домах."
      eyebrow="Натальная карта"
      heading="Дома в натальной карте"
      lead={<p>Дома делят круг натальной карты на двенадцать частей. Каждый дом относится к своей группе вопросов, а знак на его границе и планеты внутри уточняют чтение.</p>}
      breadcrumbs={[{ name: 'Натальная карта', path: '/natalnaya-karta' }, { name: 'Дома', path }]}
      relatedLinks={[
        { href: '/natalnaya-karta/planety-v-domah', label: 'Планеты в домах' },
        { href: '/natalnaya-karta/planety-v-znakah', label: 'Планеты в знаках' },
        { href: '/natalnaya-karta', label: 'Рассчитать натальную карту' },
      ]}
      schemaType="CollectionPage"
    >
      <section>
        <h2>Все 12 домов</h2>
        <ul>
          {PUBLIC_SEO_HOUSES.map((house) => (
            <li key={house.slug}><Link href={house.path}>{house.title}</Link> — {house.shortAnswer}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Как читать дом</h2>
        <p>Сам номер дома задаёт группу вопросов. Знак на границе дома описывает способ, которым эти вопросы проявляются, а планеты внутри дома добавляют свои значения. Одного дома недостаточно, чтобы описать человека целиком.</p>
      </section>
    </PublicSeoPage>
  );
}
