import Link from 'next/link';
import { PublicSeoPage } from '../../components/public-site/PublicSeoPage';
import { ReleaseAction } from '../../components/public-site/PublicSiteShell';
import { PUBLIC_SEO_SIGNS } from '../../lib/publicSeoContent';

const path = '/goroskop';

const faq = [
  {
    question: 'Гороскоп по знаку и личный гороскоп — одно и то же?',
    answer: 'Прогноз по солнечному знаку общий. Личный прогноз MEOU использует выбранный период, данные сохранённой натальной карты и предыдущие тексты.',
  },
  {
    question: 'Что опубликовано на страницах знаков?',
    answer: 'Здесь собраны постоянные объяснения знаков. Ежедневный текст появляется внутри приложения.',
  },
  {
    question: 'Для гороскопа по знаку нужно знать время рождения?',
    answer: 'Для общего текста по солнечному знаку достаточно даты рождения. Время и место нужны для полной натальной карты и личного прогноза по её данным.',
  },
] as const;

export default function HoroscopeHubPage() {
  return (
    <PublicSeoPage
      path={path}
      title="Гороскоп по знакам зодиака"
      description="Гороскоп по 12 знакам зодиака в MEOU: понятные страницы Овна, Тельца, Близнецов и остальных знаков плюс личный прогноз по натальной карте."
      eyebrow="12 знаков зодиака"
      heading="Гороскоп для всех знаков зодиака"
      lead={<p>На странице каждого знака есть его краткое описание и основные темы. Ежедневный текст доступен в приложении, а личный прогноз использует данные сохранённой натальной карты.</p>}
      breadcrumbs={[{ name: 'Гороскоп по знакам', path }]}
      faq={faq}
      schemaType="CollectionPage"
      relatedLinks={[
        { href: '/lichnyy-goroskop', label: 'Личный гороскоп' },
        { href: '/natalnaya-karta', label: 'Натальная карта' },
        { href: '/sovmestimost/znakov', label: 'Совместимость знаков' },
      ]}
    >
      <section>
        <h2>Все знаки</h2>
        <ul>
          {PUBLIC_SEO_SIGNS.map((sign) => (
            <li key={sign.key}>
              <Link href={`/goroskop/${sign.slug}`}>Гороскоп для {sign.genitive}</Link>
              {' — '}{sign.shortAnswer}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Солнечный знак показывает только часть карты</h2>
        <p>Страница знака объясняет общий способ действия и типичные акценты. Для вывода о конкретном человеке этих данных мало.</p>
        <p>В натальной карте планеты обычно находятся в разных знаках. К ним добавляются дома и аспекты. Поэтому <Link href="/lichnyy-goroskop">личный прогноз</Link> получает больше данных, чем ежедневный гороскоп для знака.</p>
      </section>

      <section>
        <h2>Ежедневный прогноз доступен в приложении</h2>
        <p>Страницы ниже содержат постоянные объяснения знаков. Ежедневный гороскоп обновляется внутри MEOU и доступен бесплатно.</p>
        <ReleaseAction />
      </section>
    </PublicSeoPage>
  );
}
