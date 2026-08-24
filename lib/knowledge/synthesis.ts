import type { KnowledgeTopicSource } from './types';

export const SYNTHESIS_TOPICS = [
  {
    id: 'combine-planet-sign',
    category: 'synthesis',
    aliases: {
      ru: ['планета в знаке', 'значение планеты и знака', 'как читать планету в знаке'],
      en: ['planet in a sign', 'planet and sign meaning', 'reading a planet in a sign'],
    },
    keywords: {
      ru: ['планета', 'знак', 'значение', 'способ действия'],
      en: ['planet', 'sign', 'function', 'style of action'],
    },
    copy: {
      ru: {
        title: 'Планета в знаке',
        summary: 'Планета показывает, о чём идёт речь, а знак — каким способом это выражено.',
        sections: [
          {
            title: 'Два слоя одного положения',
            paragraphs: [
              'Солнце связывают с важными решениями, Луну — с эмоциональной реакцией, Меркурий — с мышлением и речью. Знак уточняет темп, тон и способ действия, поэтому трактовка одной планеты меняется в разных знаках.',
            ],
          },
          {
            title: 'Чего положение не решает',
            paragraphs: [
              'Планета в знаке не даёт готовый портрет. На её смысл влияют дом, аспекты и связи с другими частями карты. Вывод становится точнее, когда эти данные читают вместе.',
            ],
          },
        ],
        shortAnswer: 'Планета отвечает на вопрос «что», знак — на вопрос «как», а дом и аспекты добавляют остальные детали.',
      },
      en: {
        title: 'A planet in a sign',
        summary: 'A planet indicates what function is active, while its sign describes the familiar manner in which that function operates.',
        sections: [
          {
            title: 'Two layers of one placement',
            paragraphs: [
              'The Sun concerns authorship and identity, the Moon emotional response, and Mercury thought and speech. The sign refines the pace, tone, and manner of that function. This is why the same planet reads differently across the signs.',
            ],
          },
          {
            title: 'What one placement cannot decide',
            paragraphs: [
              'A planet in a sign is not a complete portrait. Its house, aspects, and links with the rest of the chart also matter. The reading becomes more precise when these pieces are considered together.',
            ],
          },
        ],
        shortAnswer: 'The planet answers “what,” the sign answers “how,” and the rest of the chart supplies context.',
      },
    },
    relatedTopicIds: ['planet-in-house', 'planet-aspects', 'no-single-indicator'],
  },
  {
    id: 'planet-in-house',
    category: 'synthesis',
    aliases: {
      ru: ['планета в доме', 'значение планеты в доме', 'планеты по домам'],
      en: ['planet in a house', 'planet house placement', 'planets through houses'],
    },
    keywords: {
      ru: ['планета', 'дом', 'область жизни', 'время рождения'],
      en: ['planet', 'house', 'area of life', 'birth time'],
    },
    copy: {
      ru: {
        title: 'Планета в доме',
        summary: 'Дом показывает, в какой области жизни значение планеты особенно заметно при чтении карты.',
        sections: [
          {
            title: 'Где это видно',
            paragraphs: [
              'Знак описывает способ действия, а дом показывает область жизни. Например, Меркурий связан с мышлением и обменом информацией, а дом уточняет, где это особенно заметно: в учёбе, работе, близких связях или другой области.',
            ],
          },
          {
            title: 'Ограничение расчёта',
            paragraphs: [
              'Дома зависят от времени и места рождения. При неизвестном времени надёжно определить дом планеты нельзя. При приблизительном времени стоит использовать только те положения, которые не меняются во всём указанном промежутке.',
            ],
          },
        ],
        shortAnswer: 'Дом отвечает на вопрос «где», но для этого слоя карты нужно достаточно точное время рождения.',
      },
      en: {
        title: 'A planet in a house',
        summary: 'A house indicates the area of life where a planet’s function is more often noticeable and calls for attention.',
        sections: [
          {
            title: 'Where the theme takes place',
            paragraphs: [
              'If the sign describes the manner of an action, the house supplies its life context. Mercury, for example, still concerns thought and communication, while the house indicates where those qualities matter most: study, work, close bonds, or another area.',
            ],
          },
          {
            title: 'A calculation limit',
            paragraphs: [
              'Houses depend on birth time and place. With an unknown time, a planet’s house cannot be identified reliably. With an approximate time, only placements that remain unchanged throughout the stated interval should be used.',
            ],
          },
        ],
        shortAnswer: 'The house answers “where,” but this layer of the chart requires a sufficiently accurate birth time.',
      },
    },
    relatedTopicIds: ['combine-planet-sign', 'planet-aspects', 'angles-overview'],
  },
  {
    id: 'planet-aspects',
    category: 'synthesis',
    aliases: {
      ru: ['аспекты планеты', 'связи между планетами', 'как читать аспекты'],
      en: ['planetary aspects', 'links between planets', 'reading aspects'],
    },
    keywords: {
      ru: ['соединение', 'секстиль', 'квадрат', 'трин', 'оппозиция'],
      en: ['conjunction', 'sextile', 'square', 'trine', 'opposition'],
    },
    copy: {
      ru: {
        title: 'Планета и её аспекты',
        summary: 'Аспекты показывают, как две части карты действуют вместе: поддерживают друг друга, спорят или требуют согласования.',
        sections: [
          {
            title: 'Связь важнее ярлыка',
            paragraphs: [
              'Соединение объединяет две темы, трин и секстиль обычно описывают более лёгкую связь, квадрат и оппозиция — более напряжённую. Это не деление на хорошие и плохие аспекты: лёгкий аспект не гарантирует результат, а напряжённый не означает обязательную проблему.',
            ],
          },
          {
            title: 'Сила аспекта',
            paragraphs: [
              'При чтении учитывают участвующие планеты, тип аспекта и орбис, то есть отклонение от точного угла. Чем ближе аспект к точному, тем заметнее его связь. Итог всё равно сверяют с остальной картой.',
            ],
          },
        ],
        shortAnswer: 'Аспект показывает связь двух планет, но не делит их на хорошие и плохие.',
      },
      en: {
        title: 'A planet and its aspects',
        summary: 'Aspects show how two parts of a chart work together, whether they cooperate, compete, or require adjustment.',
        sections: [
          {
            title: 'The connection matters more than the label',
            paragraphs: [
              'A conjunction combines functions, trines and sextiles tend to ease cooperation, while squares and oppositions more often create tension. This is not a division into good and bad aspects. An easy link still needs to be used, and a tense one can support precision and persistence.',
            ],
          },
          {
            title: 'Aspect strength',
            paragraphs: [
              'A reading considers the planets involved, the aspect type, and the orb, which is the distance from the exact angle. A closer aspect generally carries a clearer connection. The conclusion still needs the wider chart.',
            ],
          },
        ],
        shortAnswer: 'An aspect describes interaction between two chart functions; it does not grade them.',
      },
    },
    relatedTopicIds: ['combine-planet-sign', 'repeated-chart-themes', 'interchart-aspects'],
  },
  {
    id: 'repeated-chart-themes',
    category: 'synthesis',
    aliases: {
      ru: ['повторяющиеся темы карты', 'повторы в натальной карте', 'главные мотивы карты'],
      en: ['repeated chart themes', 'repetition in a natal chart', 'dominant chart motifs'],
    },
    keywords: {
      ru: ['повтор', 'несколько указаний', 'синтез', 'приоритет чтения'],
      en: ['repetition', 'multiple indicators', 'synthesis', 'reading priority'],
    },
    copy: {
      ru: {
        title: 'Повторяющиеся темы в карте',
        summary: 'Когда одна мысль подтверждается несколькими независимыми частями карты, ей можно дать больше веса.',
        sections: [
          {
            title: 'Как находят повтор',
            paragraphs: [
              'Одна тема может появиться через знак планеты, её дом, аспекты и положение управителя. Важно не считать похожие формулировки отдельными доказательствами, если они происходят из одного и того же положения.',
            ],
          },
          {
            title: 'Зачем нужен синтез',
            paragraphs: [
              'Повторы помогают отличить центральную черту от небольшой детали. При этом они не отменяют противоречий. Карта может одновременно показывать стремление к быстрому решению и потребность долго проверять важные шаги.',
            ],
          },
        ],
        shortAnswer: 'Повтор из нескольких независимых указаний важнее одиночной детали, но не отменяет сложность карты.',
      },
      en: {
        title: 'Repeated themes in a chart',
        summary: 'When several independent parts of a chart support the same idea, that idea can be given more weight.',
        sections: [
          {
            title: 'How repetition is identified',
            paragraphs: [
              'One theme may appear through a planet’s sign, house, aspects, and ruler. Similar wording should not be counted as separate evidence when every statement comes from the same underlying placement.',
            ],
          },
          {
            title: 'Why synthesis matters',
            paragraphs: [
              'Repetition helps distinguish a central trait from a minor detail. It does not erase contradictions. A chart can describe both a wish to decide quickly and a need to examine important steps carefully.',
            ],
          },
        ],
        shortAnswer: 'Several independent indicators carry more weight than one detail, but they do not remove the chart’s complexity.',
      },
    },
    relatedTopicIds: ['planet-aspects', 'no-single-indicator', 'same-sign-different-people'],
  },
  {
    id: 'no-single-indicator',
    category: 'synthesis',
    aliases: {
      ru: ['почему одного показателя мало', 'один показатель карты', 'главное положение карты'],
      en: ['why one indicator is not enough', 'single chart indicator', 'one dominant placement'],
    },
    keywords: {
      ru: ['целая карта', 'контекст', 'противоречия', 'точность вывода'],
      en: ['whole chart', 'context', 'contradictions', 'reading accuracy'],
    },
    copy: {
      ru: {
        title: 'Почему одного показателя недостаточно',
        summary: 'Одна планета, знак или аспект описывает только часть человека и не должен заменять чтение всей карты.',
        sections: [
          {
            title: 'Ограниченный вопрос',
            paragraphs: [
              'Каждое положение отвечает за свою область. Луна говорит об эмоциональной реакции, Меркурий о мышлении и речи, Венера о вкусе и способе сближения. Нельзя переносить вывод из одной области на все решения и отношения человека.',
            ],
          },
          {
            title: 'Проверка контекстом',
            paragraphs: [
              'Хороший вывод выдерживает сравнение с другими планетами, домами и аспектами. Если данные расходятся, задача не выбрать удобную версию, а описать условия, в которых каждая сторона становится заметнее.',
            ],
          },
        ],
        shortAnswer: 'Один показатель отвечает на узкий вопрос; целостный вывод требует нескольких независимых данных.',
      },
      en: {
        title: 'Why no single indicator is enough',
        summary: 'One planet, sign, or aspect describes only part of a person and should not replace a reading of the whole chart.',
        sections: [
          {
            title: 'A limited question',
            paragraphs: [
              'Each placement has its own scope. The Moon concerns emotional response, Mercury thought and speech, and Venus taste and ways of becoming close. A conclusion from one area cannot be extended to every choice and relationship.',
            ],
          },
          {
            title: 'Checking the wider context',
            paragraphs: [
              'A sound conclusion holds up when compared with other planets, houses, and aspects. When the data differ, the task is not to choose the convenient version, but to describe the conditions in which each side becomes more noticeable.',
            ],
          },
        ],
        shortAnswer: 'One indicator answers a narrow question; a complete conclusion needs several independent pieces of data.',
      },
    },
    relatedTopicIds: ['combine-planet-sign', 'planet-in-house', 'repeated-chart-themes'],
  },
  {
    id: 'same-sign-different-people',
    category: 'synthesis',
    aliases: {
      ru: ['почему люди одного знака разные', 'одинаковый знак разные люди', 'разница между людьми одного знака'],
      en: ['why people of the same sign differ', 'same sign different people', 'differences within one zodiac sign'],
    },
    keywords: {
      ru: ['солнечный знак', 'луна', 'асцендент', 'дома', 'аспекты'],
      en: ['sun sign', 'moon', 'ascendant', 'houses', 'aspects'],
    },
    copy: {
      ru: {
        title: 'Почему люди одного знака разные',
        summary: 'Общий солнечный знак не означает одинаковую натальную карту, характер или жизненный опыт.',
        sections: [
          {
            title: 'Солнце только одна часть',
            paragraphs: [
              'У двух людей может быть Солнце в одном знаке, а Луна, Меркурий, Венера и Марс могут стоять иначе. Даже градус Солнца и его аспекты могут различаться.',
            ],
          },
          {
            title: 'Время и место добавляют различия',
            paragraphs: [
              'Точное время и место рождения определяют Асцендент, дома и углы карты. К этому добавляются воспитание, среда и личные решения, которых натальная карта не заменяет. Поэтому знак объединяет людей по одной теме, а не делает их копиями.',
            ],
          },
        ],
        shortAnswer: 'Люди одного знака разделяют только положение Солнца по знаку; остальная карта и жизнь у них разные.',
      },
      en: {
        title: 'Why people of the same sign differ',
        summary: 'Sharing a Sun sign does not mean sharing the same natal chart, personality, or life experience.',
        sections: [
          {
            title: 'The Sun is one part',
            paragraphs: [
              'Two people can have the Sun in the same sign while the Moon, Mercury, Venus, and Mars occupy different signs. Even the Sun itself has a different degree and receives different aspects.',
            ],
          },
          {
            title: 'Time and place add further differences',
            paragraphs: [
              'Exact birth time and place determine the Ascendant, houses, and chart angles. Upbringing, environment, and personal choices also matter and are not replaced by a natal chart. A sign links people through one theme; it does not make them copies.',
            ],
          },
        ],
        shortAnswer: 'People of one sign share only the Sun’s sign placement; the rest of the chart and their lives differ.',
      },
    },
    relatedTopicIds: ['combine-planet-sign', 'no-single-indicator', 'ascendant'],
  },
] satisfies readonly KnowledgeTopicSource[];
