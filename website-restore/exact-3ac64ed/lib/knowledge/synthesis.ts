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
        summary: 'Планета в знаке — это положение натальной карты, которое соединяет тему планеты со способом её выражения, связанным с конкретным знаком.',
        sections: [
          {
            title: 'Что означает каждый слой',
            paragraphs: [
              'В астрологии Солнце связывают с выбором направления, Луну с привычными чувствами и реакциями, а Меркурий с мышлением и речью. Знак добавляет к этой теме характерный темп и способ действия, поэтому значение одной планеты меняется от знака к знаку.',
            ],
          },
          {
            title: 'Что ещё нужно учесть',
            paragraphs: [
              'Планета в знаке не описывает человека целиком. Дом показывает, с какой областью жизни связывают это положение, а аспекты, то есть углы к другим планетам, добавляют связи и возможные противоречия. Эти данные читают вместе.',
            ],
          },
        ],
        shortAnswer: 'Планета в знаке показывает, какая астрологическая тема рассматривается и каким способом она выражается; дом и углы к другим планетам уточняют значение.',
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
        summary: 'Планета в доме означает, что в момент рождения она находилась в одном из двенадцати секторов карты, которые в астрологии связывают с разными областями жизни.',
        sections: [
          {
            title: 'Что добавляет дом',
            paragraphs: [
              'Планета задаёт тему, знак описывает способ её выражения, а дом добавляет область жизни. Например, Меркурий связывают с мышлением и обменом информацией; его дом показывает, с какой областью карты эту тему соединяют.',
            ],
          },
          {
            title: 'Почему нужно точное время',
            paragraphs: [
              'Границы домов рассчитывают по времени и месту рождения. Если время неизвестно, надёжно определить дом планеты нельзя. Если указано приблизительное время, можно использовать только тот дом, который не меняется во всём возможном промежутке.',
            ],
          },
        ],
        shortAnswer: 'Планета в доме связывает значение планеты с определённой областью жизни, но её дом можно надёжно рассчитать только при достаточно точном времени рождения.',
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
        summary: 'Аспект — это угол между двумя планетами в натальной карте; в астрологии по нему описывают, как значения этих планет сочетаются.',
        sections: [
          {
            title: 'Какими бывают аспекты',
            paragraphs: [
              'Соединение означает, что планеты стоят рядом и их темы читают вместе. Трин и секстиль обычно связывают с более лёгким взаимодействием, а квадрат и оппозицию — с напряжением или разными требованиями. Ни один тип не гарантирует хороший или плохой результат.',
            ],
          },
          {
            title: 'Что такое орбис',
            paragraphs: [
              'Орб показывает, насколько положение двух планет отличается от точного положения для выбранного аспекта. Чем меньше эта разница, тем точнее связь. При чтении также учитывают сами планеты и остальные части карты.',
            ],
          },
        ],
        shortAnswer: 'Аспект показывает угол между двумя планетами и помогает описать их связь, но сам по себе не обещает удачу и не означает обязательную проблему.',
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
        summary: 'Повтором называют случай, когда несколько независимых частей натальной карты говорят об одном и том же.',
        sections: [
          {
            title: 'Что считают повтором',
            paragraphs: [
              'Например, Солнце может указывать на быстрые решения, Марс — на прямое действие, а несколько аспектов — на нетерпение к задержкам. Это три независимые части карты. Несколько похожих фраз, полученных из одного положения, отдельными подтверждениями не считаются.',
            ],
          },
          {
            title: 'Как используют повтор',
            paragraphs: [
              'Несколько независимых указаний помогают отличить заметную тему карты от отдельной детали. При этом разные части карты могут противоречить друг другу, например одна указывать на быстрые решения, а другая на долгую проверку важных шагов.',
            ],
          },
        ],
        shortAnswer: 'Повторяющуюся тему считают более заметной, когда на неё указывают несколько независимых положений карты, но такой повтор не отменяет других и даже противоположных указаний.',
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
        title: 'Почему одной детали карты недостаточно',
        summary: 'Одна планета, знак, дом или аспект отвечает только на узкий вопрос и не описывает человека или ситуацию целиком.',
        sections: [
          {
            title: 'У каждого положения своя тема',
            paragraphs: [
              'В астрологии Луну связывают с привычными чувствами и реакциями, Меркурий с мышлением и речью, а Венеру со вкусом и способом сближаться. Вывод об одной из этих тем нельзя автоматически переносить на все решения, качества и отношения человека.',
            ],
          },
          {
            title: 'Как проверяют вывод',
            paragraphs: [
              'Любой вывод сравнивают с другими планетами, домами и углами между планетами. Если значения расходятся, это не ошибка: разные способы реагировать могут становиться заметнее в разных обстоятельствах.',
            ],
          },
        ],
        shortAnswer: 'Одна деталь натальной карты отвечает только на узкий вопрос, поэтому для общего вывода сравнивают несколько независимых положений.',
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
        summary: 'Людьми одного знака называют тех, у кого Солнце при рождении находилось в одном участке зодиакального круга; остальные положения их карт могут различаться.',
        sections: [
          {
            title: 'Солнечный знак — одно положение',
            paragraphs: [
              'У двух людей Солнце может находиться в одном знаке, а Луна, Меркурий, Венера и Марс — в разных. Отличается и точное место Солнца внутри знака, и углы, которые оно образует с другими планетами.',
            ],
          },
          {
            title: 'Карта не заменяет жизнь',
            paragraphs: [
              'Точные время и место рождения также определяют Асцендент и дома, которые у людей одного знака могут быть разными. Кроме карты на человека влияют воспитание, среда, обстоятельства и собственные решения. Один знак не делает людей копиями.',
            ],
          },
        ],
        shortAnswer: 'У людей одного знака совпадает только знак Солнца; положения других планет, дома, углы между планетами и жизненный опыт у них могут быть разными.',
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
