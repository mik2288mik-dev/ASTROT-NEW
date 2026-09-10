import type { KnowledgeTopicSource } from './types';

export const NODE_TOPICS = [
  {
    id: 'nodes-overview',
    category: 'nodes-points',
    aliases: {
      ru: ['лунные узлы', 'узлы в натальной карте', 'раху и кету'],
      en: ['lunar nodes', 'nodes in the natal chart', 'rahu and ketu'],
    },
    keywords: {
      ru: ['лунные узлы', 'северный узел', 'южный узел', 'эклиптика', 'орбита луны'],
      en: ['lunar nodes', 'north node', 'south node', 'ecliptic', 'moon orbit'],
    },
    copy: {
      ru: {
        title: 'Лунные узлы',
        summary: 'Лунные узлы — две противоположные точки, где плоскость орбиты Луны пересекает плоскость эклиптики. Это геометрические точки, а не планеты, спутники или другие физические тела.',
        sections: [
          {
            title: 'Геометрия орбит',
            kind: 'mechanism',
            paragraphs: [
              'Луна обращается вокруг Земли не точно в той же плоскости, в которой Земля обращается вокруг Солнца. Лунная орбита наклонена примерно на пять градусов. Две плоскости пересекаются по линии, а на зодиакальном круге эта линия даёт две точки напротив друг друга.',
            ],
          },
          {
            title: 'Северный и Южный узел',
            kind: 'calculation',
            paragraphs: [
              'Точку, где Луна пересекает эклиптику, двигаясь с южной стороны на северную, называют восходящим, или Северным, узлом. Противоположное пересечение с движением на юг — нисходящий, или Южный, узел. Они всегда образуют ось примерно в сто восемьдесят градусов.',
            ],
          },
          {
            title: 'Как узлы связаны с затмениями',
            kind: 'fact',
            paragraphs: [
              'Затмение возможно, когда новолуние или полнолуние происходит достаточно близко к узлам. Тогда Солнце, Земля и Луна выстраиваются достаточно точно. Если фаза проходит далеко от узлов, наклон орбиты уводит Луну выше или ниже нужной линии.',
            ],
          },
          {
            title: 'Зачем их используют в астрологии',
            kind: 'astrology',
            paragraphs: [
              'В современной западной астрологии Северный узел часто связывают с менее привычным направлением развития, а Южный — с освоенными способами и накопленным опытом. Знаки и дома узлов трактуют как две стороны одной оси, а не как независимые планеты.',
            ],
          },
          {
            title: 'Средние и истинные узлы',
            kind: 'detail',
            depth: 'deep',
            paragraphs: [
              'Программы могут показывать средний узел, движение которого математически сглажено, или истинный узел, учитывающий кратковременные колебания. Их координаты немного различаются, поэтому для сравнения карт нужно проверить настройку.',
            ],
          },
          {
            title: 'Часто путают',
            kind: 'confusion',
            paragraphs: [
              'Узлы не являются невидимыми планетами. Названия Раху и Кету пришли из индийской традиции и могут сопровождаться иной системой трактовок; нельзя автоматически смешивать все школы в одно определение.',
            ],
          },
        ],
        shortAnswer: 'Лунные узлы — две точки пересечения наклонённой орбиты Луны с эклиптикой. Рядом с ними становятся возможны затмения.',
      },
      en: {
        title: 'Lunar nodes',
        summary: 'The lunar nodes are two calculated intersections of the Moon’s orbit with the ecliptic; they are not physical planets or other celestial bodies.',
        sections: [
          {
            title: 'How they arise',
            paragraphs: [
              'The Moon’s orbit is tilted relative to the plane of the Sun’s apparent yearly path. The North Node is where the Moon crosses that plane from south to north; the opposite crossing is called the South Node.',
            ],
          },
          {
            title: 'How they are read',
            paragraphs: [
              'Astrology reads the nodes as an axis: the North Node is associated with a less familiar direction of development, while the South Node is associated with familiar approaches and accumulated experience. Their signs, houses, and aspects are considered together.',
            ],
          },
        ],
        shortAnswer: 'The lunar nodes are not planets, but two opposite calculated intersections of the Moon’s orbit with the ecliptic.',
      },
    },
    relatedTopicIds: ['node-north', 'node-south', 'lunar-eclipse', 'solar-eclipse', 'zodiac-geometry', 'chart-point-object'],
    diagram: 'lunar-nodes',
    sourceIds: ['astro-nodes', 'nasa-eclipses'],
  },
  {
    id: 'node-north',
    category: 'nodes-points',
    aliases: {
      ru: ['северный лунный узел', 'восходящий узел', 'раху'],
      en: ['north lunar node', 'ascending node', 'rahu'],
    },
    keywords: {
      ru: ['северный узел', 'восходящий узел', 'раху', 'расчётная точка', 'развитие'],
      en: ['north node', 'ascending node', 'rahu', 'calculated point', 'development'],
    },
    copy: {
      ru: {
        title: 'Северный узел',
        summary: 'Северный узел — не планета, а расчётная точка, где Луна пересекает эклиптику — видимый путь Солнца — с юга на север.',
        sections: [
          {
            title: 'Астрономическое определение',
            paragraphs: [
              'Северный и Южный узлы всегда находятся напротив друг друга. Вместе они образуют одну линию через зодиакальный круг.',
            ],
          },
          {
            title: 'Астрологическое чтение',
            paragraphs: [
              'В астрологии Северный узел связывают с менее привычными способами действовать. Это традиционное значение, а не указание, как человеку нужно жить; знак, дом и аспекты лишь уточняют его.',
            ],
          },
        ],
        shortAnswer: 'Северный узел — не планета, а расчётная точка пересечения пути Луны с видимым путём Солнца; в астрологии её связывают с менее привычными способами действовать.',
      },
      en: {
        title: 'North Node',
        summary: 'The North Node is the calculated ascending intersection of the Moon’s orbit with the ecliptic, not a physical planet.',
        sections: [
          {
            title: 'Astronomical definition',
            paragraphs: [
              'At this point, the Moon crosses from the southern side of the ecliptic to the northern side. The North and South Nodes are always exactly opposite and form one axis.',
            ],
          },
          {
            title: 'Astrological reading',
            paragraphs: [
              'The North Node is usually associated with qualities and tasks that call for conscious learning and may feel unfamiliar at first. Its sign describes the approach, its house the field of experience, and its aspects the connections with planets.',
            ],
          },
        ],
        shortAnswer: 'The North Node is not a planet, but a calculated point associated in astrology with a less familiar direction of development.',
      },
    },
    relatedTopicIds: ['nodes-overview', 'node-south', 'aspects-overview'],
  },
  {
    id: 'node-south',
    category: 'nodes-points',
    aliases: {
      ru: ['южный лунный узел', 'нисходящий узел', 'кету'],
      en: ['south lunar node', 'descending node', 'ketu'],
    },
    keywords: {
      ru: ['южный узел', 'нисходящий узел', 'кету', 'расчётная точка', 'опыт'],
      en: ['south node', 'descending node', 'ketu', 'calculated point', 'experience'],
    },
    copy: {
      ru: {
        title: 'Южный узел',
        summary: 'Южный узел — не планета, а расчётная точка, где Луна пересекает эклиптику — видимый путь Солнца — с севера на юг.',
        sections: [
          {
            title: 'Астрономическое определение',
            paragraphs: [
              'Южный узел расположен напротив Северного. Вместе они образуют одну линию через зодиакальный круг.',
            ],
          },
          {
            title: 'Астрологическое чтение',
            paragraphs: [
              'В астрологии Южный узел связывают с привычными способами действовать и накопленным опытом. Это традиционное значение, а не требование отказаться от знакомого; знак, дом и аспекты лишь уточняют его.',
            ],
          },
        ],
        shortAnswer: 'Южный узел — не планета, а расчётная точка пересечения пути Луны с видимым путём Солнца; в астрологии её связывают с привычными способами действовать и накопленным опытом.',
      },
      en: {
        title: 'South Node',
        summary: 'The South Node is the calculated descending intersection of the Moon’s orbit with the ecliptic, not a physical planet.',
        sections: [
          {
            title: 'Astronomical definition',
            paragraphs: [
              'At this point, the Moon crosses from the northern side of the ecliptic to the southern side. The South Node sits exactly opposite the North Node, so their positions are always read as a connected pair.',
            ],
          },
          {
            title: 'Astrological reading',
            paragraphs: [
              'The South Node is usually associated with familiar ways of acting and experience that is easy to return to. It does not require rejecting those qualities; the nodal axis asks how the familiar can be used without blocking new learning.',
            ],
          },
        ],
        shortAnswer: 'The South Node is not a planet, but a calculated point associated with familiar approaches and accumulated experience.',
      },
    },
    relatedTopicIds: ['nodes-overview', 'node-north', 'aspects-overview'],
  },
] satisfies readonly KnowledgeTopicSource[];
