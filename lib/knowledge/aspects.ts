import type { KnowledgeTopicSource } from './types';

export const ASPECT_TOPICS = [
  {
    id: 'aspects-overview',
    category: 'aspects',
    aliases: {
      ru: ['аспекты в натальной карте', 'что такое аспекты'],
      en: ['aspects in the natal chart', 'what are aspects'],
    },
    keywords: {
      ru: ['аспекты', 'соединение', 'секстиль', 'квадрат', 'трин', 'оппозиция', 'угол', 'планеты', 'натальная карта', 'связи'],
      en: ['aspects', 'conjunction', 'sextile', 'square', 'trine', 'opposition', 'angle', 'planets', 'natal chart', 'connections'],
    },
    copy: {
      ru: {
        title: 'Аспекты',
        summary: 'Аспект — это угловое расстояние между двумя точками карты, которому в астрологии придают отдельное значение.',
        sections: [
          {
            title: 'Что измеряется',
            paragraphs: [
              'Для каждой пары планет вычисляют разницу долгот. Если она близка к одному из основных углов — 0°, 60°, 90°, 120° или 180° — программа отмечает соответствующий аспект.',
            ],
          },
          {
            title: 'Как читать аспект',
            paragraphs: [
              'Планеты показывают, какие две части карты связаны, тип аспекта — как именно, а орб — насколько точен угол. Вывод делают вместе со знаками, домами и остальными аспектами, а не по одной линии карты.',
            ],
          },
        ],
        shortAnswer: 'Аспекты — это рассчитанные углы между планетами. По ним смотрят, как значения двух планет связаны между собой.',
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
    relatedTopicIds: ['aspect-orb', 'aspect-conjunction', 'aspect-square', 'aspect-applying-separating'],
  },
  {
    id: 'aspect-orb',
    category: 'aspects',
    aliases: {
      ru: ['орб аспекта', 'орбис'],
      en: ['aspect orb', 'orb allowance'],
    },
    keywords: {
      ru: ['орб', 'орбис', 'точность аспекта', 'градусы', 'допуск'],
      en: ['orb', 'aspect precision', 'degrees', 'allowance'],
    },
    copy: {
      ru: {
        title: 'Орб аспекта',
        summary: 'Орб показывает, на сколько градусов фактическое расстояние отличается от точного угла аспекта.',
        sections: [
          {
            title: 'Допуск к точному углу',
            paragraphs: [
              'Точное соединение равно 0°, квадрат — 90°, тригон — 120°. На практике аспект учитывают и рядом с этим значением; допустимое отклонение называют орбом.',
            ],
          },
          {
            title: 'Почему орб важен',
            paragraphs: [
              'Чем меньше отклонение, тем точнее аспект. Широкий орб требует осторожного чтения, а допустимые пределы могут различаться в разных астрологических школах и программах.',
            ],
          },
        ],
        shortAnswer: 'Орб — это отклонение от точного угла; меньший орб означает более точный аспект.',
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
        summary: 'Соединение возникает, когда две планеты находятся рядом по долготе, около угла 0°.',
        sections: [
          {
            title: 'Две планеты рядом',
            paragraphs: [
              'В трактовке значения двух планет читают вместе, потому что их трудно отделить друг от друга. Итог зависит от самих планет: соединение Венеры с Юпитером и соединение Марса с Сатурном означает не одно и то же.',
            ],
          },
          {
            title: 'Не только лёгкость или трудность',
            paragraphs: [
              'Соединение усиливает взаимное участие двух показателей, но само по себе не считается однозначно благоприятным или напряжённым. Важны орб, знак, дом и другие аспекты.',
            ],
          },
        ],
        shortAnswer: 'Соединение связывает две планеты почти в одной точке и заставляет читать их темы вместе.',
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
        summary: 'Секстиль — аспект около 60°, который связывают с возможностью наладить сотрудничество между двумя частями карты.',
        sections: [
          {
            title: 'Возможность, а не гарантия',
            paragraphs: [
              'Секстиль обычно читают как связь, которой сравнительно легко воспользоваться, если человек делает конкретный шаг. Он не обещает результат без участия и выбора.',
            ],
          },
          {
            title: 'Что уточнять',
            paragraphs: [
              'Планеты показывают, какие темы могут поддерживать друг друга, а дома — где это заметно. Точный орб делает связь весомее в общей картине.',
            ],
          },
        ],
        shortAnswer: 'Секстиль — угол 60°, который описывает доступную возможность согласовать две темы карты.',
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
        summary: 'Квадрат — аспект около 90°, который описывает столкновение требований двух планет и необходимость искать рабочее согласование.',
        sections: [
          {
            title: 'Напряжение между задачами',
            paragraphs: [
              'В квадрате одна часть карты часто мешает действовать привычным способом другой. Это может требовать больше решений и повторных попыток, но не означает постоянную проблему или неудачу.',
            ],
          },
          {
            title: 'Как читать точнее',
            paragraphs: [
              'Важно назвать обе планеты и понять, чего требует каждая из них. Дом, знак и орб помогают увидеть, где противоречие конкретно, а где вывод был бы слишком общим.',
            ],
          },
        ],
        shortAnswer: 'Квадрат — угол 90°, который показывает противоречие между двумя задачами и требует их согласовать.',
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
        summary: 'Трин — аспект около 120°. В астрологии он означает, что значения двух планет обычно легко сочетаются.',
        sections: [
          {
            title: 'То, что даётся привычно',
            paragraphs: [
              'В трине две темы чаще не спорят друг с другом и могут работать совместно без долгой настройки. Из-за этой привычности человек иногда недооценивает собственную способность или пользуется ею неосознанно.',
            ],
          },
          {
            title: 'Не обещание успеха',
            paragraphs: [
              'Трин описывает лёгкость связи, а не гарантированный результат. Планеты, дома, орб и реальные действия человека всё равно определяют, какое место аспект займёт в общей картине.',
            ],
          },
        ],
        shortAnswer: 'Трин — угол 120°, который описывает сравнительно лёгкое согласование двух тем карты.',
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
        summary: 'Оппозиция — аспект около 180°, при котором две планеты стоят на противоположных сторонах круга.',
        sections: [
          {
            title: 'Два полюса',
            paragraphs: [
              'В трактовке две темы могут поочерёдно перетягивать внимание или восприниматься через отношения с другим человеком. Задача состоит не в выборе одного полюса навсегда, а в поиске способа учитывать оба.',
            ],
          },
          {
            title: 'Не обязательный конфликт',
            paragraphs: [
              'Оппозиция делает различие заметным, но не предписывает разрыв или борьбу. Планеты, дома, знаки и орб показывают, о каком именно различии идёт речь.',
            ],
          },
        ],
        shortAnswer: 'Оппозиция — угол 180°, который ставит две темы на разные полюса и предлагает учитывать обе.',
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
        summary: 'Фаза аспекта показывает, приближается ли пара планет к точному углу или уже удаляется от него.',
        sections: [
          {
            title: 'Как определяется фаза',
            paragraphs: [
              'Программа сравнивает угловое расстояние в соседние моменты. Если отклонение от точного угла уменьшается, аспект сходящийся; если растёт — расходящийся. В момент минимального отклонения он считается точным.',
            ],
          },
          {
            title: 'Что это добавляет',
            paragraphs: [
              'В астрологическом чтении сходящуюся связь часто считают набирающей значимость, а расходящуюся — уже знакомой по опыту. Это дополнительная характеристика: тип аспекта, орб и сами планеты остаются важнее одного названия фазы.',
            ],
          },
        ],
        shortAnswer: 'Сходящийся аспект движется к точному углу, расходящийся уже отдаляется от него.',
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
