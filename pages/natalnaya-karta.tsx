import Link from 'next/link';
import { PublicSeoPage } from '../components/public-site/PublicSeoPage';
import { ReleaseAction } from '../components/public-site/PublicSiteShell';

const path = '/natalnaya-karta';

const faq = [
  { question: 'Что нужно для натальной карты?', answer: 'Дата, время и место рождения. Время особенно важно для домов и углов карты.' },
  { question: 'Натальная карта предсказывает конкретное будущее?', answer: 'Нет. Карта показывает положения на момент рождения, но не даёт расписание будущих событий.' },
  { question: 'Сколько карт можно сохранить?', answer: 'Бесплатно — свою карту. С Premium можно добавить ещё до пяти людей для сравнений и других разборов.' },
] as const;

export default function NatalChartPage() {
  return (
    <PublicSeoPage
      path={path}
      title="Натальная карта по дате, времени и месту рождения"
      description="Натальная карта NEBO по дате, времени и месту рождения: базовый разбор бесплатно, значения планет, знаков, домов, аспектов и точек карты."
      eyebrow="Натальная карта NEBO"
      heading="Натальная карта по дате, времени и месту рождения"
      lead={<p>Добавь дату, время и место рождения — NEBO покажет карту и поможет понятно разобрать её основные части.</p>}
      breadcrumbs={[{ name: 'Натальная карта', path }]}
      faq={faq}
      relatedLinks={[
        { href: '/natalnaya-karta/doma', label: 'Дома натальной карты' },
        { href: '/natalnaya-karta/planety-v-znakah', label: 'Планеты в знаках' },
        { href: '/natalnaya-karta/planety-v-domah', label: 'Планеты в домах' },
        { href: '/natalnaya-karta/aspekty', label: 'Аспекты натальной карты' },
        { href: '/natalnaya-karta/doma-v-znakah', label: 'Дома в знаках' },
        { href: '/natalnaya-karta/tochki-v-znakah', label: 'Узлы, Хирон и Лилит в знаках' },
        { href: '/natalnaya-karta/tochki-v-domah', label: 'Узлы, Хирон и Лилит в домах' },
        { href: '/lichnyy-goroskop', label: 'Личный гороскоп' },
        { href: '/sovmestimost', label: 'Совместимость' },
      ]}
    >
      <section>
        <h2>Что понадобится</h2>
        <dl>
          <div><dt>Дата рождения</dt><dd>Показывает, где находились планеты в день рождения.</dd></div>
          <div><dt>Время рождения</dt><dd>Помогает точнее определить дома и важные точки карты.</dd></div>
          <div><dt>Место рождения</dt><dd>Нужно, чтобы учесть местное время и положение горизонта.</dd></div>
        </dl>
      </section>
      <section>
        <h2>Что есть в карте</h2>
        <p>На карте видны планеты, знаки, дома, аспекты и дополнительные точки. NEBO помогает смотреть их по отдельности и затем складывать в общую картину.</p>
        <p>Один знак зодиака не описывает человека целиком. Поэтому <Link href="/goroskop">гороскоп по знаку</Link> — быстрый общий формат, а натальная карта показывает намного больше деталей.</p>
      </section>
      <section>
        <h2>Разобрать карту по частям</h2>
        <p>Начни с базовых разделов, а затем переходи к сочетаниям. Все каталоги связаны обычными ссылками, поэтому до нужной страницы можно дойти без поиска по сайту.</p>
        <ul>
          <li><Link href="/natalnaya-karta/doma">Что означают дома натальной карты</Link></li>
          <li><Link href="/natalnaya-karta/planety-v-znakah">Планеты в знаках</Link></li>
          <li><Link href="/natalnaya-karta/planety-v-domah">Планеты в домах</Link></li>
          <li><Link href="/natalnaya-karta/aspekty">Аспекты между планетами и точками</Link></li>
          <li><Link href="/natalnaya-karta/doma-v-znakah">12 домов во всех 12 знаках</Link></li>
          <li><Link href="/natalnaya-karta/tochki-v-znakah">Северный и Южный узлы, Хирон и Лилит в знаках</Link></li>
          <li><Link href="/natalnaya-karta/tochki-v-domah">Северный и Южный узлы, Хирон и Лилит в домах</Link></li>
        </ul>
      </section>
      <section>
        <h2>Что доступно бесплатно</h2>
        <p>Можно сохранить свою карту и открыть базовый разбор. Этого достаточно, чтобы увидеть карту и начать разбираться, что в ней находится.</p>
        <p>Premium открывает больше разделов карты, вопросы по ней и дополнительные сохранённые карты.</p>
      </section>
      <section>
        <h2>Карта и личный прогноз — не одно и то же</h2>
        <p>Карта остаётся одной и той же. <Link href="/lichnyy-goroskop">Личный прогноз</Link> меняется в зависимости от выбранного дня, недели или месяца и учитывает сохранённую карту.</p>
        <p>NEBO не придумывает по карте точные даты событий или чужую биографию.</p>
      </section>
      <section>
        <h2>Две карты можно сравнить</h2>
        <p>Добавь данные второго человека — и можно открыть <Link href="/sovmestimost">совместимость</Link> и посмотреть, где вы похожи, а где реагируете по-разному.</p>
      </section>
      <section><h2>С чего начать</h2><p>Своя базовая карта доступна бесплатно. Один раз добавь данные рождения — дальше NEBO будет использовать сохранённую карту в других разделах.</p><ReleaseAction /></section>
    </PublicSeoPage>
  );
}
