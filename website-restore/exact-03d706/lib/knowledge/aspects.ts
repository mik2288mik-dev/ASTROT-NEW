import type { KnowledgeTopicSource } from './types';

export const ASPECT_TOPICS = [
  {
    id: 'aspects-overview',
    category: 'aspects',
    aliases: {
      ru: ['аспект', 'аспекты в натальной карте', 'что такое аспекты'],
      en: ['aspects in the natal chart', 'what are aspects'],
    },
    keywords: {
      ru: ['аспекты', 'соединение', 'секстиль', 'квадрат', 'трин', 'оппозиция', 'угол', 'планеты', 'натальная карта', 'связи'],
      en: ['aspects', 'conjunction', 'sextile', 'square', 'trine', 'opposition', 'angle', 'planets', 'natal chart', 'connections'],
    },
    copy: {
      ru: {
        title: 'Что такое аспекты',
        summary: 'Аспект — угловое расстояние между двумя планетами или точками карты. Основные аспекты получают простыми делениями круга: ноль, шестьдесят, девяносто, сто двадцать и сто восемьдесят градусов.',
        sections: [
          {
            title: 'Что измеряют',
            kind: 'calculation',
            paragraphs: [
              'Каждая точка имеет эклиптическую долготу от нуля до трёхсот шестидесяти градусов. Программа вычитает одну долготу из другой и берёт меньший угол между точками. Так получается число от нуля до ста восьмидесяти градусов.',
            ],
          },
          {
            title: 'Откуда берутся основные углы',
            kind: 'mechanism',
            paragraphs: [
              'Соединение — точки почти в одном месте, около нуля градусов. Оппозиция делит круг пополам и даёт сто восемьдесят. Тригон делит круг на три части по сто двадцать, квадрат — на четыре по девяносто, секстиль — на шесть по шестьдесят.',
            ],
          },
          {
            title: 'Что такое орбис',
            kind: 'calculation',
            paragraphs: [
              'Планеты редко стоят ровно на нужном угле. Допустимое отклонение называют орбисом. Например, расстояние в восемьдесят восемь градусов может считаться квадратом с орбисом два градуса. Школы и программы используют разные пределы.',
            ],
          },
          {
            title: 'Зачем аспекты используют в астрологии',
            kind: 'astrology',
            paragraphs: [
              'Астрологическая трактовка соединяет три слоя: какие точки участвуют, какой угол между ними и насколько он точен. Соединение объединяет функции, оппозиция ставит их друг напротив друга, квадрат подчёркивает напряжение, тригон — лёгкое взаимодействие, секстиль — возможность сотрудничества.',
            ],
          },
          {
            title: 'Часто путают',
            kind: 'confusion',
            paragraphs: [
              'Аспект не равен положению планеты в доме или знаке. Дом отвечает на вопрос «в какой части карты», знак — «в каком участке зодиака», аспект — «под каким углом к другой точке». Астрологические значения углов являются интерпретацией, а не физической силой линии на рисунке.',
            ],
          },
          {
            title: 'Почему аспект может быть сходящимся',
            kind: 'detail',
            depth: 'deep',
            paragraphs: [
              'Если более быстрая планета приближается к точному углу, аспект называют сходящимся. После точного совпадения он становится расходящимся. Для этого недостаточно одной статичной картинки: нужна скорость и направление движения точек.',
            ],
          },
        ],
        shortAnswer: 'Аспекты — геометрия круга: сначала считают угол, затем астрология приписывает разным углам разные способы связи.',
      },
      en: {
        title: 'Aspects',
        summary: 'An aspect is the angular distance between two chart points to which astrology assigns a distinct meaning.',
        sections: [
          {
            title: 'What is measured',
            paragraphs: [
              'The longitude difference is calculated for each pair of planets. If it is close to a major angle—0°, 60°, 90°, 120°, or 180°—the software records the corresponding aspect.',
            ],
          },
          {
            title: 'How to read an aspect',
            paragraphs: [
              'The planets name the two linked subjects, the aspect type describes the character of their connection, and the orb shows precision. Interpretation also considers signs, houses, and the rest of the chart rather than one line alone.',
            ],
          },
        ],
        shortAnswer: 'Aspects are calculated angles between planets that describe how two chart subjects interact.',
      },
    },
    relatedTopicIds: ['aspect-conjunction', 'aspect-sextile', 'aspect-square', 'aspect-trine', 'aspect-opposition', 'aspect-orb'],
    diagram: 'aspects',
    sourceIds: ['astro-aspects'],
  },
  {
    id: 'aspect-orb',
    category: 'aspects',
    aliases: {
      ru: ['орб', 'орб аспекта', 'орбис'],
      en: ['aspect orb', 'orb allowance'],
    },
    keywords: {
      ru: ['орб', 'орбис', 'точность аспекта', 'градусы', 'допуск'],
      en: ['orb', 'aspect precision', 'degrees', 'allowance'],
    },
    copy: {
      ru: {
        title: 'Орб аспекта',
        summary: 'Орб показывает, насколько положение двух планет отличается от точного положения для выбранного аспекта.',
        sections: [
          {
            title: 'Допуск к точному углу',
            paragraphs: [
              'У каждого вида аспекта есть точное геометрическое положение. На реальной карте планеты часто стоят немного в стороне от него. Эту разницу и называют орбом.',
            ],
          },
          {
            title: 'Почему орб важен',
            paragraphs: [
              'Чем меньше орб, тем точнее связь. Допустимая разница зависит от вида аспекта, участвующих планет и правил, по которым работает конкретная астрологическая программа.',
            ],
          },
        ],
        shortAnswer: 'Орб — это небольшая разница между точным положением аспекта и положением планет на карте; чем она меньше, тем связь точнее.',
      },
      en: {
        title: 'Aspect orb',
        summary: 'The orb shows how many degrees the actual distance differs from an aspect’s exact angle.',
        sections: [
          {
            title: 'Allowance around an exact angle',
            paragraphs: [
              'An exact conjunction is 0°, a square 90°, and a trine 120°. In practice, an aspect is also recognized near that value; the allowed deviation is called the orb.',
            ],
          },
          {
            title: 'Why the orb matters',
            paragraphs: [
              'A smaller deviation means a more exact aspect. A wide orb calls for cautious interpretation, and accepted limits can differ between astrological schools and software.',
            ],
          },
        ],
        shortAnswer: 'The orb is the deviation from an exact angle; a smaller orb means a more exact aspect.',
      },
    },
    relatedTopicIds: ['aspects-overview', 'aspect-applying-separating', 'aspect-conjunction'],
  },
  {
    id: 'aspect-conjunction',
    category: 'aspects',
    aliases: {
      ru: ['соединение планет', 'аспект соединение'],
      en: ['planetary conjunction', 'conjunction aspect'],
    },
    keywords: {
      ru: ['соединение', 'ноль градусов', 'планеты рядом'],
      en: ['conjunction', 'zero degrees', 'planets together'],
    },
    copy: {
      ru: {
        title: 'Соединение',
        summary: 'Соединение — это аспект, при котором две планеты или точки находятся очень близко друг к другу на круге карты.',
        sections: [
          {
            title: 'Две планеты рядом',
            paragraphs: [
              'В астрологии значения двух соединённых планет рассматривают вместе. Смысл зависит от самой пары: соединение Венеры с Юпитером читают иначе, чем соединение Марса с Сатурном.',
            ],
          },
          {
            title: 'Не только лёгкость или трудность',
            paragraphs: [
              'Соединение само по себе не бывает только благоприятным или только напряжённым. Для точного чтения учитывают орб, знак, дом и другие аспекты обеих планет.',
            ],
          },
        ],
        shortAnswer: 'При соединении две планеты стоят рядом, поэтому в астрологии их значения читают вместе.',
      },
      en: {
        title: 'Conjunction',
        summary: 'A conjunction occurs when two planets are close in longitude, near an angle of 0°.',
        sections: [
          {
            title: 'Two subjects together',
            paragraphs: [
              'In interpretation, the functions of both planets operate closely and are difficult to consider separately. The result depends on the planets involved: Venus with Jupiter describes a different task from Mars with Saturn.',
            ],
          },
          {
            title: 'Not simply easy or difficult',
            paragraphs: [
              'A conjunction increases the mutual involvement of two placements, but it is not automatically favorable or tense. The orb, sign, house, and other aspects all matter.',
            ],
          },
        ],
        shortAnswer: 'A conjunction places two planets near the same point, so their subjects are read together.',
      },
    },
    relatedTopicIds: ['aspects-overview', 'aspect-orb', 'aspect-opposition'],
  },
  {
    id: 'aspect-sextile',
    category: 'aspects',
    aliases: {
      ru: ['секстиль планет', 'аспект 60 градусов'],
      en: ['planetary sextile', '60 degree aspect'],
    },
    keywords: {
      ru: ['секстиль', '60 градусов', 'возможность', 'сотрудничество'],
      en: ['sextile', '60 degrees', 'opportunity', 'cooperation'],
    },
    copy: {
      ru: {
        title: 'Секстиль',
        summary: 'Секстиль — один из видов связи между двумя планетами. В астрологии его читают как возможность сравнительно легко использовать их значения вместе.',
        sections: [
          {
            title: 'Возможность, а не гарантия',
            paragraphs: [
              'Секстиль означает, что значения двух планет могут дополнять друг друга без сильного противоречия. Это возможность взаимодействия, а не автоматический результат.',
            ],
          },
          {
            title: 'Что уточнять',
            paragraphs: [
              'Планеты показывают, что именно взаимодействует, дома — в каких вопросах это заметно, а орб — насколько аспект близок к точному углу.',
            ],
          },
        ],
        shortAnswer: 'Секстиль показывает, что значения двух планет могут сравнительно легко дополнять друг друга, но сам по себе не обещает результат.',
      },
      en: {
        title: 'Sextile',
        summary: 'A sextile is an aspect near 60°, associated with an opportunity for two parts of a chart to cooperate.',
        sections: [
          {
            title: 'An opportunity, not a guarantee',
            paragraphs: [
              'A sextile is usually read as a connection that is relatively easy to use when a person takes a concrete step. It does not promise a result without participation and choice.',
            ],
          },
          {
            title: 'What to refine',
            paragraphs: [
              'The planets show which subjects may support each other, while the houses show where this is noticeable. A close orb gives the connection more weight in the overall chart.',
            ],
          },
        ],
        shortAnswer: 'A sextile is a 60° angle describing an available opportunity to coordinate two chart subjects.',
      },
    },
    relatedTopicIds: ['aspect-trine', 'aspect-orb', 'aspects-overview'],
  },
  {
    id: 'aspect-square',
    category: 'aspects',
    aliases: {
      ru: ['квадрат планет', 'квадратура', 'аспект 90 градусов'],
      en: ['planetary square', '90 degree aspect'],
    },
    keywords: {
      ru: ['квадрат', 'квадратура', '90 градусов', 'напряжение'],
      en: ['square', '90 degrees', 'tension'],
    },
    copy: {
      ru: {
        title: 'Квадрат',
        summary: 'Квадрат — это аспект между двумя планетами или точками карты. В астрологии он показывает, что их значения не всегда легко учитывать одновременно.',
        sections: [
          {
            title: 'Напряжение между задачами',
            paragraphs: [
              'Когда человек действует по одной планете, вторая может требовать другого. Например, желание ответить сразу может мешать спокойно подобрать слова. Квадрат не означает неудачу: он показывает место, где чаще приходится выбирать способ действия.',
            ],
          },
          {
            title: 'Как читать точнее',
            paragraphs: [
              'Сначала смотрят, какие планеты образуют квадрат. Потом — в каких знаках и домах они стоят и какой у аспекта орб. Без этого фраза «в карте есть квадрат» почти ничего не объясняет.',
            ],
          },
        ],
        shortAnswer: 'Квадрат показывает две части карты, которым трудно работать одновременно: одна тянет в одну сторону, другая — в другую.',
      },
      en: {
        title: 'Square',
        summary: 'A square is an aspect near 90° that describes competing demands between two planets and a need for practical coordination.',
        sections: [
          {
            title: 'Tension between tasks',
            paragraphs: [
              'In a square, one part of the chart often interrupts the other’s familiar way of operating. This can require more decisions and repeated attempts, but it does not mean a permanent problem or inevitable failure.',
            ],
          },
          {
            title: 'Reading it more precisely',
            paragraphs: [
              'Name both planets and identify what each requires. House, sign, and orb help show where the contradiction is specific and where a conclusion would be too broad.',
            ],
          },
        ],
        shortAnswer: 'A square is a 90° angle showing competing tasks that need to be coordinated.',
      },
    },
    relatedTopicIds: ['aspect-opposition', 'aspect-trine', 'aspect-orb'],
  },
  {
    id: 'aspect-trine',
    category: 'aspects',
    aliases: {
      ru: ['тригон планет', 'трин', 'аспект 120 градусов'],
      en: ['planetary trine', '120 degree aspect'],
    },
    keywords: {
      ru: ['тригон', 'трин', '120 градусов', 'согласованность'],
      en: ['trine', '120 degrees', 'coordination', 'ease'],
    },
    copy: {
      ru: {
        title: 'Трин',
        summary: 'Трин — один из видов связи между двумя планетами. В астрологии его читают как сравнительно лёгкое сочетание их значений.',
        sections: [
          {
            title: 'То, что даётся привычно',
            paragraphs: [
              'В трине значения двух планет обычно не противоречат друг другу и могут действовать одновременно. Такая связь часто кажется привычной, поэтому человек не всегда обращает на неё внимание.',
            ],
          },
          {
            title: 'Не обещание успеха',
            paragraphs: [
              'Трин описывает лёгкость связи, но не гарантирует талант, успех или конкретное событие. Смысл зависит от планет, знаков, домов, орба и остальных частей карты.',
            ],
          },
        ],
        shortAnswer: 'Трин показывает, что значения двух планет сравнительно легко сочетаются, но сам по себе не обещает талант, успех или событие.',
      },
      en: {
        title: 'Trine',
        summary: 'A trine is an aspect near 120°, associated with natural coordination between the functions of two planets.',
        sections: [
          {
            title: 'What comes familiarly',
            paragraphs: [
              'In a trine, two subjects usually do not compete and can work together without lengthy adjustment. Because this feels familiar, a person may underestimate the ability or use it without much conscious attention.',
            ],
          },
          {
            title: 'Not a promise of success',
            paragraphs: [
              'A trine describes ease of connection, not a guaranteed result. The planets, houses, orb, and a person’s actual choices still determine its place in the whole chart.',
            ],
          },
        ],
        shortAnswer: 'A trine is a 120° angle describing relatively easy coordination between two chart subjects.',
      },
    },
    relatedTopicIds: ['aspect-sextile', 'aspect-square', 'aspect-orb'],
  },
  {
    id: 'aspect-opposition',
    category: 'aspects',
    aliases: {
      ru: ['оппозиция планет', 'аспект 180 градусов'],
      en: ['planetary opposition', '180 degree aspect'],
    },
    keywords: {
      ru: ['оппозиция', '180 градусов', 'полюса', 'баланс'],
      en: ['opposition', '180 degrees', 'poles', 'balance'],
    },
    copy: {
      ru: {
        title: 'Оппозиция',
        summary: 'Оппозиция — это аспект, при котором две планеты или точки находятся на противоположных сторонах круга карты.',
        sections: [
          {
            title: 'Два полюса',
            paragraphs: [
              'В астрологии оппозиция означает, что два значения заметно различаются и могут поочерёдно выходить на первый план. Их рассматривают как два полюса одной связи, а не как выбор только одного из них.',
            ],
          },
          {
            title: 'Не обязательный конфликт',
            paragraphs: [
              'Оппозиция не означает обязательный конфликт, разрыв или борьбу. Планеты показывают, какие два значения различаются, а знаки, дома и орб помогают понять эту разницу точнее.',
            ],
          },
        ],
        shortAnswer: 'Оппозиция показывает два заметно разных значения карты, которые приходится учитывать вместе; обязательного конфликта она не означает.',
      },
      en: {
        title: 'Opposition',
        summary: 'An opposition is an aspect near 180°, with two planets placed on opposite sides of the circle.',
        sections: [
          {
            title: 'Two poles',
            paragraphs: [
              'In interpretation, two subjects may alternate in drawing attention or be encountered through another person. The task is not to choose one pole forever, but to find a way to account for both.',
            ],
          },
          {
            title: 'Not inevitable conflict',
            paragraphs: [
              'An opposition makes a difference visible, but it does not prescribe separation or struggle. The planets, houses, signs, and orb show what the particular difference concerns.',
            ],
          },
        ],
        shortAnswer: 'An opposition is a 180° angle placing two subjects at opposite poles and asking that both be considered.',
      },
    },
    relatedTopicIds: ['aspect-conjunction', 'aspect-square', 'aspect-orb'],
  },
  {
    id: 'aspect-applying-separating',
    category: 'aspects',
    aliases: {
      ru: ['сходящийся и расходящийся аспект', 'фаза аспекта'],
      en: ['applying and separating aspect', 'aspect phase'],
    },
    keywords: {
      ru: ['сходящийся аспект', 'расходящийся аспект', 'точный аспект', 'фаза'],
      en: ['applying aspect', 'separating aspect', 'exact aspect', 'phase'],
    },
    copy: {
      ru: {
        title: 'Сходящиеся и расходящиеся аспекты',
        summary: 'Сходящимся называют аспект, который становится точнее по мере движения планет. Расходящийся аспект уже прошёл самое точное положение.',
        sections: [
          {
            title: 'Как определяется фаза',
            paragraphs: [
              'Программа сравнивает положения планет в соседние моменты. Если аспект становится точнее, его называют сходящимся; если планеты уже прошли самое точное положение и связь становится менее точной — расходящимся.',
            ],
          },
          {
            title: 'Что это добавляет',
            paragraphs: [
              'В астрологии сходящийся аспект часто считают усиливающимся, а расходящийся — уже прошедшим точную фазу. Это дополнительная деталь: тип аспекта, орб и участвующие планеты важнее одной фазы.',
            ],
          },
        ],
        shortAnswer: 'Сходящийся аспект становится точнее, а расходящийся уже прошёл самое точное положение.',
      },
      en: {
        title: 'Applying and separating aspects',
        summary: 'Aspect phase shows whether a pair of planets is moving toward the exact angle or already moving away from it.',
        sections: [
          {
            title: 'How phase is determined',
            paragraphs: [
              'The software compares angular distance at adjacent moments. If the deviation from the exact angle is decreasing, the aspect is applying; if it is increasing, the aspect is separating. At minimum deviation it is exact.',
            ],
          },
          {
            title: 'What phase adds',
            paragraphs: [
              'In astrological reading, an applying connection is often treated as gaining importance, while a separating one is treated as already familiar through experience. Phase is an extra detail: aspect type, orb, and the planets themselves remain more important than the phase label alone.',
            ],
          },
        ],
        shortAnswer: 'An applying aspect moves toward the exact angle; a separating aspect has already begun to move away.',
      },
    },
    relatedTopicIds: ['aspects-overview', 'aspect-orb', 'aspect-conjunction'],
  },
] satisfies readonly KnowledgeTopicSource[];
