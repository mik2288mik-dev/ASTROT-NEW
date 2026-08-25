import React from 'react';
import { ZodiacIllustration } from '../../components/icons/ZodiacArt';
import type { KnowledgeCategoryId, KnowledgeLanguage } from '../../lib/knowledge';
import styles from './AstrologyEncyclopedia.module.css';

type Props = {
  topicId: string;
  category: KnowledgeCategoryId;
  language: KnowledgeLanguage;
};

type SignVisual = {
  sign: string;
  element: readonly [string, string];
  modality: readonly [string, string];
  tone: 'fire' | 'earth' | 'air' | 'water';
};

const SIGNS: Record<string, SignVisual> = {
  'sign-aries': { sign: 'aries', element: ['Огонь', 'Fire'], modality: ['Кардинальный', 'Cardinal'], tone: 'fire' },
  'sign-taurus': { sign: 'taurus', element: ['Земля', 'Earth'], modality: ['Фиксированный', 'Fixed'], tone: 'earth' },
  'sign-gemini': { sign: 'gemini', element: ['Воздух', 'Air'], modality: ['Мутабельный', 'Mutable'], tone: 'air' },
  'sign-cancer': { sign: 'cancer', element: ['Вода', 'Water'], modality: ['Кардинальный', 'Cardinal'], tone: 'water' },
  'sign-leo': { sign: 'leo', element: ['Огонь', 'Fire'], modality: ['Фиксированный', 'Fixed'], tone: 'fire' },
  'sign-virgo': { sign: 'virgo', element: ['Земля', 'Earth'], modality: ['Мутабельный', 'Mutable'], tone: 'earth' },
  'sign-libra': { sign: 'libra', element: ['Воздух', 'Air'], modality: ['Кардинальный', 'Cardinal'], tone: 'air' },
  'sign-scorpio': { sign: 'scorpio', element: ['Вода', 'Water'], modality: ['Фиксированный', 'Fixed'], tone: 'water' },
  'sign-sagittarius': { sign: 'sagittarius', element: ['Огонь', 'Fire'], modality: ['Мутабельный', 'Mutable'], tone: 'fire' },
  'sign-capricorn': { sign: 'capricorn', element: ['Земля', 'Earth'], modality: ['Кардинальный', 'Cardinal'], tone: 'earth' },
  'sign-aquarius': { sign: 'aquarius', element: ['Воздух', 'Air'], modality: ['Фиксированный', 'Fixed'], tone: 'air' },
  'sign-pisces': { sign: 'pisces', element: ['Вода', 'Water'], modality: ['Мутабельный', 'Mutable'], tone: 'water' },
};

type ObjectVisual = {
  image: string;
  alt: readonly [string, string];
  type: readonly [string, string];
  note: readonly [string, string];
};

const OBJECTS: Record<string, ObjectVisual> = {
  'planet-sun': { image: 'sun', alt: ['Солнце с видимой светящейся поверхностью и протуберанцами', 'The Sun with its glowing surface and prominences'], type: ['Звезда', 'Star'], note: ['Светится собственным светом', 'Produces its own light'] },
  'planet-mercury': { image: 'mercury', alt: ['Кратерная поверхность Меркурия', 'Mercury’s cratered surface'], type: ['Каменистая планета', 'Rocky planet'], note: ['Ближайшая к Солнцу', 'Closest to the Sun'] },
  'planet-venus': { image: 'venus', alt: ['Венера, скрытая плотными облаками', 'Venus wrapped in dense clouds'], type: ['Каменистая планета', 'Rocky planet'], note: ['Поверхность скрыта облаками', 'Its surface is hidden by clouds'] },
  'planet-mars': { image: 'mars', alt: ['Красная каменистая поверхность Марса', 'Mars and its red rocky surface'], type: ['Каменистая планета', 'Rocky planet'], note: ['Холодный мир с тонкой атмосферой', 'A cold world with a thin atmosphere'] },
  'planet-jupiter': { image: 'jupiter', alt: ['Полосы облаков и Большое красное пятно Юпитера', 'Jupiter’s cloud bands and Great Red Spot'], type: ['Газовый гигант', 'Gas giant'], note: ['Самая большая планета', 'The largest planet'] },
  'planet-saturn': { image: 'saturn', alt: ['Сатурн и его широкая система колец', 'Saturn and its broad ring system'], type: ['Газовый гигант', 'Gas giant'], note: ['Окружён системой колец', 'Surrounded by rings'] },
  'planet-uranus': { image: 'uranus', alt: ['Голубой Уран и почти вертикальная система колец', 'Blue Uranus with its nearly vertical rings'], type: ['Ледяной гигант', 'Ice giant'], note: ['Вращается почти «на боку»', 'Rotates almost on its side'] },
  'planet-neptune': { image: 'neptune', alt: ['Синий Нептун с облаками и тёмным штормом', 'Blue Neptune with clouds and a dark storm'], type: ['Ледяной гигант', 'Ice giant'], note: ['Самая дальняя большая планета', 'The farthest major planet'] },
  'planet-pluto': { image: 'pluto', alt: ['Плутон со светлой областью в форме сердца', 'Pluto with its bright heart-shaped region'], type: ['Карликовая планета', 'Dwarf planet'], note: ['Малый мир пояса Койпера', 'A small Kuiper Belt world'] },
  'planet-chiron': { image: 'chiron', alt: ['Хирон как небольшой неровный каменисто-ледяной объект', 'Chiron as a small irregular rocky and icy body'], type: ['Малое небесное тело', 'Small Solar System body'], note: ['Реальный объект, не расчётная точка', 'A real object, not a calculated point'] },
};

type CategoryVisual = {
  image: string;
  alt: readonly [string, string];
  title: readonly [string, string];
  caption: readonly [string, string];
};

const CATEGORY_VISUALS: Partial<Record<KnowledgeCategoryId, CategoryVisual>> = {
  start: {
    image: 'sky-to-chart',
    alt: ['Небесные тела и круг карты из двенадцати секторов', 'Celestial bodies and a twelve-sector chart'],
    title: ['Наблюдаемое небо → схема', 'Observed sky → diagram'],
    caption: ['Положения объектов сначала рассчитывают, а уже затем астрологи их трактуют.', 'Object positions are calculated first; astrologers interpret them afterward.'],
  },
  planets: {
    image: 'sky-to-chart',
    alt: ['Реальные небесные тела и их положения на круговой схеме', 'Real celestial bodies and their positions on a circular diagram'],
    title: ['Объект в небе → точка на карте', 'Sky object → chart point'],
    caption: ['Солнце, Луна и планеты различаются физически, но на карте их показывают как рассчитанные положения.', 'The Sun, Moon, and planets differ physically, but a chart shows each as a calculated position.'],
  },
  angles: {
    image: 'chart-angles',
    alt: ['Небесная сфера с четырьмя основными углами карты', 'Celestial sphere with the four main chart angles'],
    title: ['Четыре опорные точки карты', 'Four chart reference points'],
    caption: ['ASC, DSC, MC и IC возникают из пересечения горизонта и меридиана с кругом карты.', 'ASC, DSC, MC, and IC come from the horizon and meridian meeting the chart circle.'],
  },
  synthesis: {
    image: 'chart-structures',
    alt: ['Круг карты со скоплением точек и геометрией аспектов', 'Chart wheel with a point cluster and aspect geometry'],
    title: ['Несколько связей образуют структуру', 'Several connections form a structure'],
    caption: ['Стеллиумы и конфигурации описывают группы положений, а не отдельную новую планету.', 'Stelliums and configurations describe groups of placements, not a separate new planet.'],
  },
  compatibility: {
    image: 'relationships',
    alt: ['Две отдельные карты и третья объединённая схема', 'Two separate charts and a third combined diagram'],
    title: ['Две карты можно сравнить по-разному', 'Two charts can be compared in different ways'],
    caption: ['Синастрия сопоставляет две карты, а композит строит из них отдельную условную карту.', 'Synastry compares two charts; a composite creates a separate derived chart.'],
  },
  forecasts: {
    image: 'forecast-methods',
    alt: ['Две круговые карты, соединённые линией времени', 'Two circular charts connected by a timeline'],
    title: ['Метод сравнивает положения во времени', 'A method compares positions over time'],
    caption: ['Транзиты, прогрессии и возвращения используют разные правила расчёта. Это методы, а не готовые предсказания.', 'Transits, progressions, and returns use different calculation rules. They are methods, not ready-made predictions.'],
  },
  'branches-tools': {
    image: 'astrology-tools',
    alt: ['Эфемериды, глобус и часы как инструменты расчёта', 'Ephemeris, globe, and clock as calculation tools'],
    title: ['Данные превращаются в координаты', 'Data becomes coordinates'],
    caption: ['Эфемериды дают положения объектов, а время и место задают систему отсчёта.', 'Ephemerides provide object positions; time and place set the reference frame.'],
  },
};

function SignArtwork({ visual, language }: { visual: SignVisual; language: KnowledgeLanguage }) {
  const ru = language === 'ru';
  return (
    <figure className={`${styles.articleVisual} ${styles[`articleVisual_${visual.tone}`]}`}>
      <div className={styles.signVisualCopy}>
        <span>{ru ? 'ЗНАК ЗОДИАКА' : 'ZODIAC SIGN'}</span>
        <strong>{visual.element[ru ? 0 : 1]}</strong>
        <small>{visual.modality[ru ? 0 : 1]}</small>
      </div>
      <ZodiacIllustration
        sign={visual.sign}
        className={styles.signVisualImage}
        alt={ru ? 'Образ знака зодиака' : 'Zodiac sign illustration'}
        priority={false}
      />
      <figcaption>{ru ? 'Стихия показывает общую группу знака, модальность — его способ начинать, продолжать или менять действие.' : 'Element names the sign group; modality describes how it starts, sustains, or adapts action.'}</figcaption>
    </figure>
  );
}

function ObjectArtwork({ visual, language }: { visual: ObjectVisual; language: KnowledgeLanguage }) {
  const ru = language === 'ru';
  return (
    <figure className={`${styles.articleVisual} ${styles.objectPhotoVisual}`}>
      <img
        src={`/encyclopedia/objects/${visual.image}.webp`}
        alt={visual.alt[ru ? 0 : 1]}
        width="640"
        height="640"
        loading="lazy"
        decoding="async"
      />
      <div className={styles.objectPhotoLabel}>
        <span>{ru ? 'ЧТО ЭТО В РЕАЛЬНОСТИ' : 'WHAT IT IS IN REALITY'}</span>
        <strong>{visual.type[ru ? 0 : 1]}</strong>
        <small>{visual.note[ru ? 0 : 1]}</small>
      </div>
      <figcaption>{ru ? 'Сначала — тип реального объекта или точки. Астрологическое значение объясняется отдельно в статье.' : 'First comes the real object or point type. Its astrological interpretation is explained separately.'}</figcaption>
    </figure>
  );
}

function AstrologyOverviewArtwork({ language }: { language: KnowledgeLanguage }) {
  const ru = language === 'ru';
  return (
    <figure className={`${styles.articleVisual} ${styles.overviewVisual}`}>
      <img src="/encyclopedia/concepts/sky-to-chart.webp" alt={ru ? 'Небесные объекты и круг карты из двенадцати секторов' : 'Celestial objects and a twelve-sector chart'} width="640" height="640" loading="lazy" decoding="async" />
      <div className={styles.overviewVisualLabel}>
        <strong>{ru ? 'Наблюдаемое небо → символическая карта' : 'Observed sky → symbolic chart'}</strong>
        <span>{ru ? 'Сначала рассчитывают положения объектов, затем астрологи их трактуют.' : 'Positions are calculated first; astrologers interpret them afterward.'}</span>
      </div>
    </figure>
  );
}

function CategoryArtwork({ visual, language }: { visual: CategoryVisual; language: KnowledgeLanguage }) {
  const ru = language === 'ru';
  return (
    <figure className={`${styles.articleVisual} ${styles.overviewVisual}`}>
      <img
        src={`/encyclopedia/concepts/${visual.image}.webp`}
        alt={visual.alt[ru ? 0 : 1]}
        width="640"
        height="640"
        loading="lazy"
        decoding="async"
      />
      <div className={styles.overviewVisualLabel}>
        <strong>{visual.title[ru ? 0 : 1]}</strong>
        <span>{visual.caption[ru ? 0 : 1]}</span>
      </div>
    </figure>
  );
}

export function hasKnowledgeArticleVisual(topicId: string) {
  return topicId === 'astrology-overview' || Boolean(SIGNS[topicId]) || Boolean(OBJECTS[topicId]);
}

export function KnowledgeArticleVisual({ topicId, category, language }: Props) {
  if (topicId === 'astrology-overview') return <AstrologyOverviewArtwork language={language} />;
  if (SIGNS[topicId]) return <SignArtwork visual={SIGNS[topicId]} language={language} />;
  if (OBJECTS[topicId]) return <ObjectArtwork visual={OBJECTS[topicId]} language={language} />;
  if (CATEGORY_VISUALS[category]) return <CategoryArtwork visual={CATEGORY_VISUALS[category]} language={language} />;
  return null;
}
