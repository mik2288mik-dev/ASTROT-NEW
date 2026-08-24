import type { KnowledgeTopicSource } from './types';

export const RELATIONSHIP_TOPICS = [
  {
    id: 'sign-compatibility',
    category: 'compatibility',
    aliases: {
      ru: ['совместимость знаков', 'знаки зодиака в отношениях', 'пара по знакам'],
      en: ['sign compatibility', 'zodiac signs in relationships', 'compatibility by signs'],
    },
    keywords: {
      ru: ['солнечный знак', 'любовь', 'общий портрет пары', 'без времени рождения'],
      en: ['sun sign', 'general relationship portrait', 'without birth time'],
    },
    copy: {
      ru: {
        title: 'Совместимость по знакам',
        summary: 'Сравнение солнечных знаков показывает только общие сходства и различия и не заменяет две полные натальные карты.',
        sections: [
          {
            title: 'Что можно увидеть',
            paragraphs: [
              'Солнечный знак помогает сравнить, как люди принимают решения и выражают свою позицию. Такое чтение подходит, когда известны только даты рождения.',
            ],
          },
          {
            title: 'Граница метода',
            paragraphs: [
              'Отношения зависят не только от Солнца. Луна, Венера, Марс, Меркурий и аспекты между двумя картами могут заметно изменить картину. Поэтому совместимость по знакам остаётся общим, а не персональным выводом.',
            ],
          },
        ],
        shortAnswer: 'Совместимость по знакам показывает общий контраст двух солнечных знаков, но не описывает всю пару.',
      },
      en: {
        title: 'Compatibility by signs',
        summary: 'Comparing Sun signs gives a broad language for similarities and differences, but it does not replace two complete natal charts.',
        sections: [
          {
            title: 'What it can show',
            paragraphs: [
              'The Sun sign helps compare basic self-expression, decision pace, and a familiar way of taking one’s place. This reading is useful when only the birth dates are known.',
            ],
          },
          {
            title: 'The method’s limit',
            paragraphs: [
              'Relationships involve more than the Sun. The Moon, Venus, Mars, Mercury, and aspects between two charts can change the picture considerably. Sign compatibility is therefore broad rather than fully personal.',
            ],
          },
        ],
        shortAnswer: 'Sign compatibility compares two Sun signs in broad terms; it does not describe the whole relationship.',
      },
    },
    relatedTopicIds: ['two-chart-compatibility', 'synastry', 'compatibility-not-fate'],
  },
  {
    id: 'two-chart-compatibility',
    category: 'compatibility',
    aliases: {
      ru: ['совместимость по двум картам', 'сравнение натальных карт', 'персональная совместимость'],
      en: ['two-chart compatibility', 'natal chart comparison', 'personal compatibility'],
    },
    keywords: {
      ru: ['две даты рождения', 'любовь', 'время рождения', 'место рождения', 'аспекты пары'],
      en: ['two birth dates', 'birth time', 'birth place', 'relationship aspects'],
    },
    copy: {
      ru: {
        title: 'Совместимость по двум картам',
        summary: 'Две рассчитанные карты позволяют сравнить больше личных факторов, чем два солнечных знака.',
        sections: [
          {
            title: 'Что входит в сравнение',
            paragraphs: [
              'В полном астрологическом сравнении обычно сопоставляют положения Солнца, Луны, Меркурия, Венеры и Марса и угловые расстояния между ними. Углы и дома можно добавлять только при надёжном времени рождения в обеих картах.',
            ],
          },
          {
            title: 'Что остаётся за картой',
            paragraphs: [
              'Даже подробное сравнение не знает историю отношений, договорённости и реальные поступки. Оно описывает возможные точки согласия и напряжения, а не измеряет качество пары одним числом.',
            ],
          },
        ],
        shortAnswer: 'Две карты дают персональное сравнение многих факторов, но не решают судьбу отношений.',
      },
      en: {
        title: 'Compatibility using two charts',
        summary: 'Two calculated charts allow a more personal comparison than two Sun signs alone.',
        sections: [
          {
            title: 'What the comparison includes',
            paragraphs: [
              'A comparison can consider the Sun, Moon, Mercury, Venus, Mars, and aspects between the two people’s planets. Exact birth times can add angles and houses when those data are reliable in both charts.',
            ],
          },
          {
            title: 'What remains outside the chart',
            paragraphs: [
              'Even a detailed comparison does not know the relationship history, agreements, or actual behavior. It describes possible points of ease and tension rather than measuring the quality of a couple with one score.',
            ],
          },
        ],
        shortAnswer: 'Two charts offer a personal comparison of many factors, but they do not decide the relationship’s fate.',
      },
    },
    relatedTopicIds: ['sign-compatibility', 'synastry', 'interchart-aspects'],
  },
  {
    id: 'synastry',
    category: 'compatibility',
    aliases: {
      ru: ['синастрия', 'наложение двух карт', 'астрология отношений'],
      en: ['synastry', 'chart overlay', 'relationship astrology'],
    },
    keywords: {
      ru: ['две натальные карты', 'межкартовые аспекты', 'взаимодействие'],
      en: ['two natal charts', 'inter-chart aspects', 'interaction'],
    },
    copy: {
      ru: {
        title: 'Что такое синастрия',
        summary: 'Синастрия сравнивает две натальные карты и читает связи между планетами одного и другого человека.',
        sections: [
          {
            title: 'Как устроено сравнение',
            paragraphs: [
              'Положение каждой планеты сначала рассчитывают в собственной карте. Затем смотрят угловые расстояния между планетами двух людей. Так можно обсудить, где способы думать, чувствовать, сближаться и действовать легче сочетаются, а где требуют ясных договорённостей.',
            ],
          },
          {
            title: 'Не рейтинг пары',
            paragraphs: [
              'Синастрия не сводится к проценту и не делит пары на правильные и неправильные. Один напряжённый аспект не отменяет другие связи, а лёгкие аспекты не гарантируют взаимность и уважение.',
            ],
          },
        ],
        shortAnswer: 'Синастрия читает связи между двумя картами, а не выдаёт окончательный вердикт отношениям.',
      },
      en: {
        title: 'What synastry is',
        summary: 'Synastry compares two natal charts and reads connections between one person’s planets and the other’s.',
        sections: [
          {
            title: 'How the comparison works',
            paragraphs: [
              'Each planet is first calculated in its own natal chart. Angular distances are then measured between the planets of both people. This helps discuss where ways of thinking, feeling, connecting, and acting fit easily and where clear agreements matter more.',
            ],
          },
          {
            title: 'Not a relationship rating',
            paragraphs: [
              'Synastry is not a percentage and does not divide couples into right and wrong matches. One tense aspect does not cancel the other links, while easy aspects cannot guarantee reciprocity or respect.',
            ],
          },
        ],
        shortAnswer: 'Synastry reads links between two charts; it does not issue a final verdict on a relationship.',
      },
    },
    relatedTopicIds: ['two-chart-compatibility', 'interchart-aspects', 'compatibility-not-fate'],
  },
  {
    id: 'moon-in-relationships',
    category: 'compatibility',
    aliases: {
      ru: ['луна в отношениях', 'совместимость по луне', 'луна в синастрии'],
      en: ['moon in relationships', 'moon compatibility', 'moon in synastry'],
    },
    keywords: {
      ru: ['эмоциональная реакция', 'забота', 'быт', 'чувство безопасности'],
      en: ['emotional response', 'care', 'daily life', 'sense of safety'],
    },
    copy: {
      ru: {
        title: 'Луна в отношениях',
        summary: 'Луна помогает читать эмоциональные реакции, привычки заботы и то, как человек восстанавливает спокойствие рядом с другим.',
        sections: [
          {
            title: 'Повседневная близость',
            paragraphs: [
              'В отношениях Луна особенно заметна в быту: как человек просит поддержки, реагирует на напряжение и понимает заботу. Совпадение знаков Луны не обязательно, важнее увидеть, могут ли оба распознавать разные способы ответа.',
            ],
          },
          {
            title: 'Луна в сравнении карт',
            paragraphs: [
              'Аспекты к Луне показывают, как планеты другого человека затрагивают эмоциональный темп. Этот слой читают вместе с Венерой, Марсом, Меркурием и реальным опытом пары.',
            ],
          },
        ],
        shortAnswer: 'Луна описывает эмоциональный быт пары и способы заботы, но не определяет совместимость одна.',
      },
      en: {
        title: 'The Moon in relationships',
        summary: 'The Moon helps describe emotional responses, habits of care, and how someone regains calm beside another person.',
        sections: [
          {
            title: 'Everyday closeness',
            paragraphs: [
              'The Moon is especially visible in daily life: how someone asks for support, responds to strain, and recognizes care. Matching Moon signs are not required; it matters more whether both people can understand different ways of responding.',
            ],
          },
          {
            title: 'The Moon in chart comparison',
            paragraphs: [
              'Aspects to the Moon describe how another person’s planets affect emotional pace. This layer is read together with Venus, Mars, Mercury, and the couple’s actual experience.',
            ],
          },
        ],
        shortAnswer: 'The Moon describes emotional daily life and ways of caring, but it does not determine compatibility alone.',
      },
    },
    relatedTopicIds: ['venus-in-relationships', 'mercury-in-relationships', 'interchart-aspects'],
  },
  {
    id: 'venus-in-relationships',
    category: 'compatibility',
    aliases: {
      ru: ['венера в отношениях', 'совместимость по венере', 'венера в синастрии'],
      en: ['venus in relationships', 'venus compatibility', 'venus in synastry'],
    },
    keywords: {
      ru: ['симпатия', 'вкус', 'сближение', 'приятное общение', 'любовь'],
      en: ['attraction', 'taste', 'affection', 'ways of connecting'],
    },
    copy: {
      ru: {
        title: 'Венера в отношениях',
        summary: 'Венера описывает вкус, симпатию и привычный способ показывать расположение.',
        sections: [
          {
            title: 'Что приятно получать и давать',
            paragraphs: [
              'Знак Венеры помогает понять, какие жесты человек считает тёплыми, красивыми и уместными. Это относится не только к романтике, но и к дружбе, общению и совместному досугу.',
            ],
          },
          {
            title: 'Разные способы показывать внимание',
            paragraphs: [
              'Разные Венеры не означают несовместимость. Иногда один человек показывает внимание словами, другой делами или временем вместе. Сравнение помогает назвать различие, а договорённость решает, что с ним делать.',
            ],
          },
        ],
        shortAnswer: 'Венера описывает, как человек показывает симпатию, но не оценивает глубину отношений.',
      },
      en: {
        title: 'Venus in relationships',
        summary: 'Venus describes taste, attraction, and a familiar way of showing fondness.',
        sections: [
          {
            title: 'What feels pleasant to give and receive',
            paragraphs: [
              'Venus’s sign helps describe which gestures feel warm, attractive, and appropriate to someone. This applies not only to romance, but also to friendship, conversation, and shared leisure.',
            ],
          },
          {
            title: 'Translation matters in a couple',
            paragraphs: [
              'Different Venus placements do not mean incompatibility. One person may show care through words, another through actions or time together. A comparison can name the difference; an agreement determines what both people do with it.',
            ],
          },
        ],
        shortAnswer: 'Venus concerns attraction and ways of showing fondness; it does not measure a relationship’s depth.',
      },
    },
    relatedTopicIds: ['moon-in-relationships', 'mars-in-relationships', 'mercury-in-relationships'],
  },
  {
    id: 'mars-in-relationships',
    category: 'compatibility',
    aliases: {
      ru: ['марс в отношениях', 'совместимость по марсу', 'марс в синастрии'],
      en: ['mars in relationships', 'mars compatibility', 'mars in synastry'],
    },
    keywords: {
      ru: ['инициатива', 'желание', 'границы', 'спор'],
      en: ['initiative', 'desire', 'boundaries', 'conflict'],
    },
    copy: {
      ru: {
        title: 'Марс в отношениях',
        summary: 'Марс относится к инициативе, прямому желанию, защите границ и способу действовать при несогласии.',
        sections: [
          {
            title: 'Темп действия',
            paragraphs: [
              'Знак Марса помогает описать, как человек начинает дело, добивается ответа и реагирует на препятствие. В отношениях это заметно в инициативе, физическом влечении и споре.',
            ],
          },
          {
            title: 'Напряжение не равно конфликту',
            paragraphs: [
              'Связи Марса могут усиливать интерес или разницу темпов. Они не заставляют людей ссориться. Поведение зависит от того, как оба говорят о согласии, отказе, злости и личных границах.',
            ],
          },
        ],
        shortAnswer: 'Марс описывает инициативу и действие в паре, но не предсказывает ссоры.',
      },
      en: {
        title: 'Mars in relationships',
        summary: 'Mars concerns initiative, direct desire, protection of boundaries, and how someone acts during disagreement.',
        sections: [
          {
            title: 'Pace of action',
            paragraphs: [
              'Mars’s sign helps describe how someone starts, pursues a response, and meets an obstacle. In relationships, this can be visible in initiative, physical attraction, and disagreement.',
            ],
          },
          {
            title: 'Tension is not the same as conflict',
            paragraphs: [
              'Mars contacts can intensify interest or differences in pace. They do not force people to argue. Behavior depends on how both people discuss consent, refusal, anger, and personal boundaries.',
            ],
          },
        ],
        shortAnswer: 'Mars describes initiative and action in a couple; it does not predict arguments.',
      },
    },
    relatedTopicIds: ['venus-in-relationships', 'mercury-in-relationships', 'interchart-aspects'],
  },
  {
    id: 'mercury-in-relationships',
    category: 'compatibility',
    aliases: {
      ru: ['меркурий в отношениях', 'совместимость по меркурию', 'меркурий в синастрии'],
      en: ['mercury in relationships', 'mercury compatibility', 'mercury in synastry'],
    },
    keywords: {
      ru: ['общение', 'понимание', 'обсуждение', 'формулировка мысли'],
      en: ['communication', 'understanding', 'discussion', 'wording thoughts'],
    },
    copy: {
      ru: {
        title: 'Меркурий в отношениях',
        summary: 'Меркурий помогает сравнить способы думать, задавать вопросы, объяснять и слышать ответ.',
        sections: [
          {
            title: 'Разные языки разговора',
            paragraphs: [
              'Один человек говорит коротко и прямо, другой сначала собирает детали или проверяет оттенки смысла. Положение Меркурия помогает назвать такие различия без вывода, что один способ умнее другого.',
            ],
          },
          {
            title: 'Связи между картами',
            paragraphs: [
              'Аспекты к Меркурию показывают, какие планеты другого человека легче включаются в разговор. Это может облегчать понимание или требовать больше уточнений. Умение слушать и проверять договорённости остаётся реальным навыком, а не свойством аспекта.',
            ],
          },
        ],
        shortAnswer: 'Меркурий описывает стиль общения в паре, но не определяет, умеют ли люди договариваться.',
      },
      en: {
        title: 'Mercury in relationships',
        summary: 'Mercury helps compare ways of thinking, asking questions, explaining, and hearing a reply.',
        sections: [
          {
            title: 'Different languages of conversation',
            paragraphs: [
              'One person speaks briefly and directly, while another first gathers details or checks shades of meaning. Mercury helps name these differences without claiming that one approach is more intelligent.',
            ],
          },
          {
            title: 'Links between charts',
            paragraphs: [
              'Aspects to Mercury show which parts of another person’s chart enter the conversation more readily. They may ease understanding or call for more clarification. Listening and checking agreements remain learned skills, not properties of an aspect.',
            ],
          },
        ],
        shortAnswer: 'Mercury describes communication style in a couple; it does not decide whether people can reach agreement.',
      },
    },
    relatedTopicIds: ['moon-in-relationships', 'mars-in-relationships', 'interchart-aspects'],
  },
  {
    id: 'interchart-aspects',
    category: 'compatibility',
    aliases: {
      ru: ['межкартовые аспекты', 'аспекты в синастрии', 'аспекты между двумя картами'],
      en: ['inter-chart aspects', 'synastry aspects', 'aspects between two charts'],
    },
    keywords: {
      ru: ['соединение', 'секстиль', 'квадрат', 'трин', 'оппозиция', 'орбис'],
      en: ['conjunction', 'sextile', 'square', 'trine', 'opposition', 'orb'],
    },
    copy: {
      ru: {
        title: 'Аспекты между двумя картами',
        summary: 'Межкартовый аспект связывает планету одного человека с планетой другого и описывает одну связь между двумя показателями карт.',
        sections: [
          {
            title: 'Что именно сравнивают',
            paragraphs: [
              'Расчёт измеряет угловое расстояние между двумя планетами. Значение зависит от типа аспекта, орбиса и самих планет. Например, связь Луны и Меркурия читается иначе, чем связь Марса и Венеры.',
            ],
          },
          {
            title: 'Один аспект не равен всей паре',
            paragraphs: [
              'Точный аспект может быть заметным, но его читают рядом с другими связями и отдельными натальными картами. Нельзя делать вывод о любви, разрыве или длительности отношений по одной линии.',
            ],
          },
        ],
        shortAnswer: 'Межкартовый аспект описывает одну связь между двумя людьми, а не отношения целиком.',
      },
      en: {
        title: 'Aspects between two charts',
        summary: 'An inter-chart aspect links one person’s planet with another person’s planet and describes one specific line of interaction.',
        sections: [
          {
            title: 'What is compared',
            paragraphs: [
              'The calculation measures the angular distance between two planets. Meaning depends on the aspect type, orb, and functions of both planets. A Moon–Mercury contact, for example, reads differently from a Mars–Venus contact.',
            ],
          },
          {
            title: 'One aspect is not the whole couple',
            paragraphs: [
              'An exact aspect can be noticeable, but it is read alongside other links and both individual natal charts. One contact cannot establish love, separation, or the duration of a relationship.',
            ],
          },
        ],
        shortAnswer: 'An inter-chart aspect describes one connection between two people, not the whole relationship.',
      },
    },
    relatedTopicIds: ['synastry', 'planet-aspects', 'two-chart-compatibility'],
  },
  {
    id: 'compatibility-not-fate',
    category: 'compatibility',
    aliases: {
      ru: ['совместимость не судьба', 'можно ли верить совместимости', 'приговор совместимости'],
      en: ['compatibility is not fate', 'can compatibility be trusted', 'compatibility verdict'],
    },
    keywords: {
      ru: ['выбор', 'поведение', 'договорённости', 'не гарантия'],
      en: ['choice', 'behavior', 'agreements', 'not a guarantee'],
    },
    copy: {
      ru: {
        title: 'Совместимость не решает судьбу пары',
        summary: 'Карта может описать различия и точки контакта, но итог отношений зависит от поведения, выбора и обстоятельств.',
        sections: [
          {
            title: 'Что даёт сравнение',
            paragraphs: [
              'Совместимость помогает точнее назвать, где люди легко понимают друг друга, а где пользуются разными способами общения и действия. Это язык для наблюдения, а не оценка того, стоит ли быть вместе.',
            ],
          },
          {
            title: 'Что важнее расчёта',
            paragraphs: [
              'Уважение, согласие, безопасность, честность и готовность обсуждать разногласия проверяются поступками. Лёгкая карта не заменяет этих условий, а сложная сама по себе не мешает отношениям.',
            ],
          },
        ],
        shortAnswer: 'Совместимость описывает отдельные сходства и различия, но решения и качество отношений остаются за людьми.',
      },
      en: {
        title: 'Compatibility does not decide a couple’s fate',
        summary: 'A chart can describe differences and points of contact, but a relationship’s outcome depends on behavior, choices, and circumstances.',
        sections: [
          {
            title: 'What comparison provides',
            paragraphs: [
              'Compatibility can name where two people understand each other easily and where they use different ways of communicating and acting. It is a language for observation, not a judgment about whether they should stay together.',
            ],
          },
          {
            title: 'What matters more than a calculation',
            paragraphs: [
              'Respect, consent, safety, honesty, and willingness to discuss disagreements are tested through behavior. An easy chart cannot replace these conditions, while a difficult one does not prevent people from building a mature relationship.',
            ],
          },
        ],
        shortAnswer: 'Compatibility describes dynamics, while the decisions and quality of a relationship remain with the people involved.',
      },
    },
    relatedTopicIds: ['sign-compatibility', 'two-chart-compatibility', 'synastry'],
  },
] satisfies readonly KnowledgeTopicSource[];
