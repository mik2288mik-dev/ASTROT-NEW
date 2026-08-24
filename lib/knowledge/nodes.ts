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
        summary: 'Лунные узлы — две рассчитанные точки пересечения орбиты Луны с эклиптикой; это не физические планеты или другие небесные тела.',
        sections: [
          {
            title: 'Как они возникают',
            paragraphs: [
              'Орбита Луны наклонена к плоскости видимого годового пути Солнца. В месте, где Луна пересекает эту плоскость с юга на север, находится Северный узел; противоположное пересечение называют Южным.',
            ],
          },
          {
            title: 'Как их читают',
            paragraphs: [
              'В астрологической традиции Северный узел связывают с менее знакомыми качествами, Южный — с привычными. Это условная трактовка двух расчётных точек; их читают вместе по знакам, домам и аспектам.',
            ],
          },
        ],
        shortAnswer: 'Лунные узлы — не планеты, а две противоположные расчётные точки пересечения орбиты Луны с эклиптикой.',
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
    relatedTopicIds: ['node-north', 'node-south', 'aspects-overview'],
    personalizationKind: { type: 'nodes' },
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
        summary: 'Северный узел — рассчитанная точка восходящего пересечения орбиты Луны с эклиптикой, а не физическая планета.',
        sections: [
          {
            title: 'Астрономическое определение',
            paragraphs: [
              'В этой точке Луна переходит с южной стороны эклиптики на северную. Северный и Южный узлы всегда стоят точно напротив друг друга и образуют одну ось.',
            ],
          },
          {
            title: 'Астрологическое чтение',
            paragraphs: [
              'Северный узел обычно связывают с менее привычными качествами. Это традиционная трактовка, а не предписание, как человеку жить. Знак, дом и аспекты уточняют её содержание.',
            ],
          },
        ],
        shortAnswer: 'Северный узел — не планета, а расчётная точка, которую традиционно связывают с менее привычными качествами.',
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
    personalizationKind: { type: 'planet', key: 'northNode', questionKind: 'sign' },
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
        summary: 'Южный узел — рассчитанная точка нисходящего пересечения орбиты Луны с эклиптикой, а не физическая планета.',
        sections: [
          {
            title: 'Астрономическое определение',
            paragraphs: [
              'В этой точке Луна переходит с северной стороны эклиптики на южную. Южный узел расположен ровно напротив Северного, поэтому их положения всегда читают как связанную пару.',
            ],
          },
          {
            title: 'Астрологическое чтение',
            paragraphs: [
              'Южный узел обычно связывают с привычными способами действовать и накопленным опытом. Это не требование отказаться от них, а условное противопоставление знакомого и менее знакомого.',
            ],
          },
        ],
        shortAnswer: 'Южный узел — не планета, а расчётная точка, которую связывают со знакомыми подходами и накопленным опытом.',
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
    personalizationKind: { type: 'planet', key: 'southNode', questionKind: 'sign' },
  },
] satisfies readonly KnowledgeTopicSource[];
