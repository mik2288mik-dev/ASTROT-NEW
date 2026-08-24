import type { KnowledgeTopicSource } from './types';

export const PLANET_TOPICS = [
  {
    id: 'planets-overview',
    category: 'planets',
    aliases: {
      ru: ['планеты в натальной карте', 'что означают планеты'],
      en: ['planets in the natal chart', 'what planets mean'],
    },
    keywords: {
      ru: ['планеты', 'натальная карта', 'роль планет', 'астрология'],
      en: ['planets', 'natal chart', 'planet roles', 'astrology'],
    },
    copy: {
      ru: {
        title: 'Планеты в натальной карте',
        summary: 'Планеты отвечают на вопрос «что именно», а знак, дом и аспекты уточняют, как и где это читается в карте.',
        sections: [
          {
            title: 'Роль планеты',
            paragraphs: [
              'В астрологическом чтении каждая планета связана со своей группой тем: Солнце — с выбором направления, Луна — с привычными реакциями, Меркурий — с мышлением и речью. Это условный язык интерпретации, а не описание физического влияния небесных тел.',
            ],
          },
          {
            title: 'Как читать положение',
            paragraphs: [
              'Сначала смотрят на планету, затем на её знак, дом и аспекты. Один показатель не даёт полного вывода: значение складывается из нескольких частей карты и их взаимосвязей.',
            ],
          },
        ],
        shortAnswer: 'Планета задаёт тему, знак описывает способ действия, дом — область жизни, а аспекты — связи с другими частями карты.',
      },
      en: {
        title: 'Planets in the natal chart',
        summary: 'Planets answer “what,” while signs, houses, and aspects describe how and where that subject is read in a chart.',
        sections: [
          {
            title: 'A planet’s role',
            paragraphs: [
              'In astrological interpretation, each planet is linked with a group of subjects: the Sun with direction and choice, the Moon with familiar responses, and Mercury with thought and speech. This is a symbolic language, not a claim of physical influence from celestial bodies.',
            ],
          },
          {
            title: 'How to read a placement',
            paragraphs: [
              'Start with the planet, then consider its sign, house, and aspects. No single placement gives a complete conclusion; meaning comes from several parts of the chart and their connections.',
            ],
          },
        ],
        shortAnswer: 'A planet names the subject, its sign describes the style, its house the life area, and its aspects the connections.',
      },
    },
    relatedTopicIds: ['planet-sun', 'planet-moon', 'planet-mercury', 'aspects-overview'],
  },
  {
    id: 'planet-sun',
    category: 'planets',
    aliases: {
      ru: ['солнце в карте', 'солнечный знак'],
      en: ['sun in the chart', 'sun sign'],
    },
    keywords: {
      ru: ['солнце', 'солнечный знак', 'воля', 'направление'],
      en: ['sun', 'sun sign', 'will', 'direction'],
    },
    copy: {
      ru: {
        title: 'Солнце',
        summary: 'Солнце в натальной карте связывают с тем, как человек осознанно выбирает цели и принимает важные решения.',
        sections: [
          {
            title: 'Что описывает Солнце',
            paragraphs: [
              'Его положение помогает читать, как человек принимает важные решения, заявляет о себе и собирает разные стороны характера вокруг главной цели. Это не весь характер и не готовый портрет личности.',
            ],
          },
          {
            title: 'Знак, дом и аспекты',
            paragraphs: [
              'Знак Солнца уточняет привычный стиль выбора, дом — область важных личных решений, а аспекты — связи Солнца с другими планетами.',
            ],
          },
        ],
        shortAnswer: 'Солнце описывает, как человек выбирает личные цели и принимает важные решения.',
      },
      en: {
        title: 'The Sun',
        summary: 'In a natal chart, the Sun is associated with conscious choice, authorship, and the direction a person recognizes as their own.',
        sections: [
          {
            title: 'What the Sun describes',
            paragraphs: [
              'Its placement helps interpret how a person makes important choices, takes a visible position, and organizes different traits around a central aim. It is not the whole character or a complete personality portrait.',
            ],
          },
          {
            title: 'Sign, house, and aspects',
            paragraphs: [
              'The Sun’s sign refines the style of choice, its house points to the life area where authorship matters most, and its aspects show how this direction connects with the rest of the chart.',
            ],
          },
        ],
        shortAnswer: 'The Sun describes the conscious self: how a person chooses direction and takes ownership of decisions.',
      },
    },
    relatedTopicIds: ['planet-moon', 'planet-saturn', 'aspects-overview'],
    personalizationKind: { type: 'planet', key: 'sun', questionKind: 'sign' },
  },
  {
    id: 'planet-moon',
    category: 'planets',
    aliases: {
      ru: ['луна в карте', 'лунный знак'],
      en: ['moon in the chart', 'moon sign'],
    },
    keywords: {
      ru: ['луна', 'лунный знак', 'привычки', 'реакции', 'забота'],
      en: ['moon', 'moon sign', 'habits', 'responses', 'care'],
    },
    copy: {
      ru: {
        title: 'Луна',
        summary: 'Луна описывает привычные эмоциональные реакции, потребность в заботе и способы возвращаться к знакомому ритму.',
        sections: [
          {
            title: 'Что описывает Луна',
            paragraphs: [
              'По Луне читают автоматические реакции, бытовые привычки и то, что помогает чувствовать себя спокойно рядом с другими. Она чаще говорит о непосредственном отклике, чем о заранее принятом решении.',
            ],
          },
          {
            title: 'Контекст карты',
            paragraphs: [
              'Знак уточняет форму эмоционального отклика, дом — привычную область внимания, аспекты — связь Луны с волей, мышлением и близостью. Поэтому одинаковый лунный знак у двух людей может читаться по-разному.',
            ],
          },
        ],
        shortAnswer: 'Луна показывает привычные реакции, способы заботиться и условия, в которых человеку проще расслабиться.',
      },
      en: {
        title: 'The Moon',
        summary: 'The Moon describes familiar emotional responses, needs around care, and ways of returning to a known rhythm.',
        sections: [
          {
            title: 'What the Moon describes',
            paragraphs: [
              'The Moon is read for automatic responses, everyday habits, and what helps a person feel settled with others. It usually speaks more to an immediate response than to a deliberate decision.',
            ],
          },
          {
            title: 'Chart context',
            paragraphs: [
              'Its sign refines the form of emotional response, its house the familiar area of attention, and its aspects the Moon’s links with will, thought, and closeness. Two people with the same Moon sign can therefore read quite differently.',
            ],
          },
        ],
        shortAnswer: 'The Moon shows familiar responses, ways of giving care, and conditions in which a person can settle.',
      },
    },
    relatedTopicIds: ['planet-sun', 'planet-venus', 'aspects-overview'],
    personalizationKind: { type: 'planet', key: 'moon', questionKind: 'sign' },
  },
  {
    id: 'planet-mercury',
    category: 'planets',
    aliases: {
      ru: ['меркурий в карте', 'знак меркурия'],
      en: ['mercury in the chart', 'mercury sign'],
    },
    keywords: {
      ru: ['меркурий', 'мышление', 'речь', 'обучение', 'общение'],
      en: ['mercury', 'thinking', 'speech', 'learning', 'communication'],
    },
    copy: {
      ru: {
        title: 'Меркурий',
        summary: 'Меркурий связывают с мышлением, речью, обучением и обменом информацией.',
        sections: [
          {
            title: 'Как человек думает и говорит',
            paragraphs: [
              'Положение Меркурия помогает описать темп рассуждений, способ формулировать мысли и подход к новым сведениям. Оно не определяет интеллект и не делит людей на способных и неспособных.',
            ],
          },
          {
            title: 'Что уточняет карту',
            paragraphs: [
              'Знак задаёт стиль общения, дом — темы, к которым ум часто возвращается, а аспекты связывают мышление с чувствами, решениями и воображением. Ретроградная отметка добавляет отдельную деталь, но не отменяет остальные показатели.',
            ],
          },
        ],
        shortAnswer: 'Меркурий описывает, как человек воспринимает сведения, строит мысль и выражает её словами.',
      },
      en: {
        title: 'Mercury',
        summary: 'Mercury is associated with thinking, speech, learning, and the exchange of information.',
        sections: [
          {
            title: 'How a person thinks and speaks',
            paragraphs: [
              'Mercury’s placement helps describe the pace of reasoning, the way thoughts are phrased, and an approach to new information. It does not measure intelligence or divide people into capable and incapable groups.',
            ],
          },
          {
            title: 'What adds detail',
            paragraphs: [
              'Its sign gives communication style, its house the subjects the mind often returns to, and its aspects connect thought with feeling, decisions, and imagination. A retrograde marker adds one detail but does not replace the rest of the chart.',
            ],
          },
        ],
        shortAnswer: 'Mercury describes how a person takes in information, builds a thought, and puts it into words.',
      },
    },
    relatedTopicIds: ['retrograde-mercury', 'planet-moon', 'aspects-overview'],
    personalizationKind: { type: 'planet', key: 'mercury', questionKind: 'sign' },
  },
  {
    id: 'planet-venus',
    category: 'planets',
    aliases: {
      ru: ['венера в карте', 'знак венеры'],
      en: ['venus in the chart', 'venus sign'],
    },
    keywords: {
      ru: ['венера', 'отношения', 'любовь', 'симпатия', 'вкус', 'ценности'],
      en: ['venus', 'relationships', 'attraction', 'taste', 'values'],
    },
    copy: {
      ru: {
        title: 'Венера',
        summary: 'Венера описывает предпочтения в близости, способы выражать симпатию и личные критерии приятного и ценного.',
        sections: [
          {
            title: 'Близость и выбор',
            paragraphs: [
              'По Венере читают, что человек ценит в отношениях, как показывает расположение и на что обращает внимание при сближении. Она не обещает определённую судьбу пары и не заменяет сравнение двух карт.',
            ],
          },
          {
            title: 'Не только романтика',
            paragraphs: [
              'Венера также связана со вкусом, удовольствием и способом договариваться о взаимности. Знак, дом и аспекты уточняют эти темы и помогают не сводить трактовку к одному ярлыку.',
            ],
          },
        ],
        shortAnswer: 'Венера показывает, что человек ценит, как выражает симпатию и какой формат близости считает естественным.',
      },
      en: {
        title: 'Venus',
        summary: 'Venus describes preferences in closeness, ways of expressing affection, and personal standards of what feels pleasing and valuable.',
        sections: [
          {
            title: 'Closeness and choice',
            paragraphs: [
              'Venus is read for what a person values in relationships, how affection is shown, and what draws attention when closeness develops. It does not promise a couple a fixed outcome or replace a comparison of both charts.',
            ],
          },
          {
            title: 'Beyond romance',
            paragraphs: [
              'Venus is also linked with taste, enjoyment, and ways of negotiating mutuality. Its sign, house, and aspects refine these subjects and keep the interpretation from becoming a single label.',
            ],
          },
        ],
        shortAnswer: 'Venus shows what a person values, how affection is expressed, and what kind of closeness feels natural.',
      },
    },
    relatedTopicIds: ['planet-mars', 'planet-moon', 'aspects-overview'],
    personalizationKind: { type: 'planet', key: 'venus', questionKind: 'relationships' },
  },
  {
    id: 'planet-mars',
    category: 'planets',
    aliases: {
      ru: ['марс в карте', 'знак марса'],
      en: ['mars in the chart', 'mars sign'],
    },
    keywords: {
      ru: ['марс', 'действие', 'инициатива', 'границы', 'конфликт'],
      en: ['mars', 'action', 'initiative', 'boundaries', 'conflict'],
    },
    copy: {
      ru: {
        title: 'Марс',
        summary: 'Марс связывают с инициативой, прямым действием, защитой границ и способом входить в спор.',
        sections: [
          {
            title: 'Способ действовать',
            paragraphs: [
              'Положение Марса помогает описать, как человек начинает дело, добивается конкретного результата и реагирует на препятствие. Оно не означает постоянную агрессию и не оценивает силу характера.',
            ],
          },
          {
            title: 'Как читать детали',
            paragraphs: [
              'Знак уточняет манеру действия, дом — область частой инициативы, аспекты — связь Марса с самоконтролем, желаниями и речью. Напряжённый аспект говорит о необходимости согласовать разные импульсы, а не о неизбежном конфликте.',
            ],
          },
        ],
        shortAnswer: 'Марс описывает, как человек начинает действовать, отстаивает границы и справляется с сопротивлением.',
      },
      en: {
        title: 'Mars',
        summary: 'Mars is associated with initiative, direct action, boundaries, and the way a person enters disagreement.',
        sections: [
          {
            title: 'A way of acting',
            paragraphs: [
              'Mars’s placement helps describe how a person starts, pursues a concrete result, and responds to an obstacle. It does not mean constant aggression or grade the strength of someone’s character.',
            ],
          },
          {
            title: 'Reading the details',
            paragraphs: [
              'Its sign refines the manner of action, its house the area of frequent initiative, and its aspects connect Mars with restraint, desire, and speech. A tense aspect suggests different impulses need coordination, not that conflict is inevitable.',
            ],
          },
        ],
        shortAnswer: 'Mars describes how a person starts acting, defends boundaries, and handles resistance.',
      },
    },
    relatedTopicIds: ['planet-venus', 'planet-saturn', 'aspect-square'],
    personalizationKind: { type: 'planet', key: 'mars', questionKind: 'sign' },
  },
  {
    id: 'planet-jupiter',
    category: 'planets',
    aliases: {
      ru: ['юпитер в карте', 'знак юпитера'],
      en: ['jupiter in the chart', 'jupiter sign'],
    },
    keywords: {
      ru: ['юпитер', 'рост', 'убеждения', 'обучение', 'масштаб'],
      en: ['jupiter', 'growth', 'beliefs', 'learning', 'scope'],
    },
    copy: {
      ru: {
        title: 'Юпитер',
        summary: 'Юпитер описывает стремление расширять кругозор, искать смысл и видеть возможности шире текущих границ.',
        sections: [
          {
            title: 'Рост и убеждения',
            paragraphs: [
              'По Юпитеру читают отношение к обучению, мировоззрению, доверию и большим целям. Он может указывать и на склонность переоценивать возможности, поэтому его положение не равно автоматической удаче.',
            ],
          },
          {
            title: 'Масштаб в контексте',
            paragraphs: [
              'Знак уточняет способ расширять опыт, дом — область, где хочется большего, аспекты — насколько это стремление согласуется с дисциплиной и реальными ограничениями.',
            ],
          },
        ],
        shortAnswer: 'Юпитер показывает, как человек расширяет опыт, строит убеждения и оценивает большие возможности.',
      },
      en: {
        title: 'Jupiter',
        summary: 'Jupiter describes the drive to broaden perspective, seek meaning, and see possibilities beyond current limits.',
        sections: [
          {
            title: 'Growth and beliefs',
            paragraphs: [
              'Jupiter is read for attitudes to learning, worldview, trust, and large aims. It can also point to overestimating possibilities, so its placement is not a guarantee of automatic luck.',
            ],
          },
          {
            title: 'Scale in context',
            paragraphs: [
              'Its sign refines how experience is expanded, its house the area where more is sought, and its aspects how that drive works with discipline and practical limits.',
            ],
          },
        ],
        shortAnswer: 'Jupiter shows how a person broadens experience, forms beliefs, and assesses larger possibilities.',
      },
    },
    relatedTopicIds: ['planet-saturn', 'aspect-trine', 'aspects-overview'],
    personalizationKind: { type: 'planet', key: 'jupiter', questionKind: 'sign' },
  },
  {
    id: 'planet-saturn',
    category: 'planets',
    aliases: {
      ru: ['сатурн в карте', 'знак сатурна'],
      en: ['saturn in the chart', 'saturn sign'],
    },
    keywords: {
      ru: ['сатурн', 'границы', 'дисциплина', 'ответственность', 'время'],
      en: ['saturn', 'limits', 'discipline', 'responsibility', 'time'],
    },
    copy: {
      ru: {
        title: 'Сатурн',
        summary: 'Сатурн связывают с ограничениями, ответственностью, временем и умением строить устойчивый порядок.',
        sections: [
          {
            title: 'Границы и зрелость',
            paragraphs: [
              'Положение Сатурна помогает читать, где человек особенно серьёзен, осторожен или требователен к себе. Оно может описывать страх ошибки, но также способность выдерживать долгую работу и соблюдать договорённости.',
            ],
          },
          {
            title: 'Не знак наказания',
            paragraphs: [
              'Сатурн не предсказывает наказание. Его знак, дом и аспекты показывают, в какой форме встречаются правила и пределы и как человек учится обращаться с ними со временем.',
            ],
          },
        ],
        shortAnswer: 'Сатурн описывает отношение к правилам, ответственности, ограничениям и долгим задачам.',
      },
      en: {
        title: 'Saturn',
        summary: 'Saturn is associated with limits, responsibility, time, and the ability to build a durable structure.',
        sections: [
          {
            title: 'Limits and maturity',
            paragraphs: [
              'Saturn’s placement helps interpret where a person is especially serious, cautious, or demanding of themselves. It can describe fear of error as well as the ability to stay with long work and honor agreements.',
            ],
          },
          {
            title: 'Not a mark of punishment',
            paragraphs: [
              'Saturn does not predict punishment. Its sign, house, and aspects show the form that rules and limits take and how a person learns to handle them over time.',
            ],
          },
        ],
        shortAnswer: 'Saturn describes a person’s relationship with rules, responsibility, limits, and long-term tasks.',
      },
    },
    relatedTopicIds: ['planet-jupiter', 'planet-mars', 'aspect-square'],
    personalizationKind: { type: 'planet', key: 'saturn', questionKind: 'sign' },
  },
  {
    id: 'planet-uranus',
    category: 'planets',
    aliases: {
      ru: ['уран в карте', 'знак урана'],
      en: ['uranus in the chart', 'uranus sign'],
    },
    keywords: {
      ru: ['уран', 'перемены', 'независимость', 'новое', 'поколение'],
      en: ['uranus', 'change', 'independence', 'innovation', 'generation'],
    },
    copy: {
      ru: {
        title: 'Уран',
        summary: 'Уран связывают с независимостью, резким обновлением правил и готовностью искать непривычный ход.',
        sections: [
          {
            title: 'Личное и поколенческое',
            paragraphs: [
              'Уран движется медленно, поэтому многие ровесники имеют его в одном знаке. Для личного чтения особенно важны дом и точные аспекты Урана к Солнцу, Луне, углам и другим быстрым точкам карты.',
            ],
          },
          {
            title: 'Свобода без ярлыка',
            paragraphs: [
              'Сильный Уран не делает человека непредсказуемым во всём. Он помогает описать конкретные области, где тесные правила быстро становятся неудобными и требуется больше самостоятельности.',
            ],
          },
        ],
        shortAnswer: 'Уран описывает отношение к свободе, обновлению правил и непривычным решениям.',
      },
      en: {
        title: 'Uranus',
        summary: 'Uranus is associated with independence, abrupt revision of rules, and a willingness to try an unfamiliar approach.',
        sections: [
          {
            title: 'Personal and generational',
            paragraphs: [
              'Uranus moves slowly, so many peers share its sign. For a personal reading, its house and close aspects to the Sun, Moon, angles, and other faster chart points carry more detail.',
            ],
          },
          {
            title: 'Freedom without a label',
            paragraphs: [
              'A prominent Uranus does not make someone unpredictable in every area. It helps identify particular subjects where tight rules quickly become uncomfortable and more independence is sought.',
            ],
          },
        ],
        shortAnswer: 'Uranus describes a person’s relationship with freedom, revised rules, and unconventional solutions.',
      },
    },
    relatedTopicIds: ['planet-saturn', 'planet-neptune', 'aspects-overview'],
    personalizationKind: { type: 'planet', key: 'uranus', questionKind: 'sign' },
  },
  {
    id: 'planet-neptune',
    category: 'planets',
    aliases: {
      ru: ['нептун в карте', 'знак нептуна'],
      en: ['neptune in the chart', 'neptune sign'],
    },
    keywords: {
      ru: ['нептун', 'воображение', 'идеализация', 'неясность', 'поколение'],
      en: ['neptune', 'imagination', 'idealization', 'ambiguity', 'generation'],
    },
    copy: {
      ru: {
        title: 'Нептун',
        summary: 'Нептун связывают с воображением, идеализацией, тонким восприятием и границей между мечтой и фактом.',
        sections: [
          {
            title: 'Воображение и неясность',
            paragraphs: [
              'По Нептуну читают способность увлекаться образом, сопереживать и допускать несколько значений сразу. Та же тема может давать путаницу, если ожидания принимаются за проверенные сведения.',
            ],
          },
          {
            title: 'Медленная планета',
            paragraphs: [
              'Знак Нептуна часто общий для поколения. В личной карте больше деталей дают дом и точные аспекты, особенно к личным планетам и углам.',
            ],
          },
        ],
        shortAnswer: 'Нептун описывает воображение, идеализацию и то, как человек различает впечатление и факт.',
      },
      en: {
        title: 'Neptune',
        summary: 'Neptune is associated with imagination, idealization, subtle perception, and the boundary between a dream and a fact.',
        sections: [
          {
            title: 'Imagination and ambiguity',
            paragraphs: [
              'Neptune is read for the ability to be moved by an image, empathize, and hold several meanings at once. The same subject can bring confusion when expectations are treated as verified information.',
            ],
          },
          {
            title: 'A slow-moving planet',
            paragraphs: [
              'Neptune’s sign is often shared by a generation. In a personal chart, its house and close aspects—especially to personal planets and angles—carry more detail.',
            ],
          },
        ],
        shortAnswer: 'Neptune describes imagination, idealization, and how a person distinguishes an impression from a fact.',
      },
    },
    relatedTopicIds: ['planet-uranus', 'planet-pluto', 'aspects-overview'],
    personalizationKind: { type: 'planet', key: 'neptune', questionKind: 'sign' },
  },
  {
    id: 'planet-pluto',
    category: 'planets',
    aliases: {
      ru: ['плутон в карте', 'знак плутона'],
      en: ['pluto in the chart', 'pluto sign'],
    },
    keywords: {
      ru: ['плутон', 'влияние', 'контроль', 'кризис', 'перемены'],
      en: ['pluto', 'influence', 'control', 'crisis', 'change'],
    },
    copy: {
      ru: {
        title: 'Плутон',
        summary: 'Плутон в астрологии связывают с контролем, сильным давлением и переменами, после которых прежний порядок уже не подходит.',
        sections: [
          {
            title: 'Интенсивность и влияние',
            paragraphs: [
              'Положение Плутона помогает читать отношение к власти, уязвимости и необходимости менять привычный порядок. Это не предсказание катастрофы и не знак того, что кризис обязателен.',
            ],
          },
          {
            title: 'Поколение и личная карта',
            paragraphs: [
              'Плутон очень медленный, поэтому его знак обычно описывает поколенческий фон. Личное значение точнее раскрывают дом и близкие аспекты к личным планетам и углам.',
            ],
          },
        ],
        shortAnswer: 'Плутон описывает отношение к контролю, сильным переменам и ситуациям, где старый порядок уже не работает.',
      },
      en: {
        title: 'Pluto',
        summary: 'Pluto is associated with control, intense pressure, and deep change after a point of no return.',
        sections: [
          {
            title: 'Intensity and influence',
            paragraphs: [
              'Pluto’s placement helps interpret a person’s relationship with power, vulnerability, and the need to change an established order. It is not a prediction of disaster or a sign that crisis is required.',
            ],
          },
          {
            title: 'Generation and personal chart',
            paragraphs: [
              'Pluto moves very slowly, so its sign usually describes a generational background. Its house and close aspects to personal planets and angles provide more personal detail.',
            ],
          },
        ],
        shortAnswer: 'Pluto describes a relationship with control, major change, and situations where an old order no longer works.',
      },
    },
    relatedTopicIds: ['planet-neptune', 'planet-saturn', 'aspects-overview'],
    personalizationKind: { type: 'planet', key: 'pluto', questionKind: 'sign' },
  },
  {
    id: 'planet-chiron',
    category: 'planets',
    aliases: {
      ru: ['хирон в карте', 'знак хирона'],
      en: ['chiron in the chart', 'chiron sign'],
    },
    keywords: {
      ru: ['хирон', 'уязвимость', 'опыт', 'обучение', 'малое тело'],
      en: ['chiron', 'vulnerability', 'experience', 'learning', 'minor body'],
    },
    copy: {
      ru: {
        title: 'Хирон',
        summary: 'Хирон — малое небесное тело, положение которого в астрологии используют для обсуждения чувствительных тем и реакции на них.',
        sections: [
          {
            title: 'Что читают по Хирону',
            paragraphs: [
              'Хирон используют как дополнительную точку карты. Его положение трактуют как чувствительную тему, но не как диагноз или доказательство травмы.',
            ],
          },
          {
            title: 'Когда значение заметнее',
            paragraphs: [
              'Для личной трактовки особенно важны дом Хирона и его точные аспекты к личным планетам или углам. Один знак Хирона часто разделяют люди близких лет рождения, поэтому его недостаточно для отдельного вывода.',
            ],
          },
        ],
        shortAnswer: 'Хирон — малое тело, которое в астрологии используют как дополнительную точку для чтения чувствительных тем.',
      },
      en: {
        title: 'Chiron',
        summary: 'Chiron is a minor celestial body whose astrological placement is associated with vulnerable experience and knowledge gained through it.',
        sections: [
          {
            title: 'What astrologers read from Chiron',
            paragraphs: [
              'Chiron is used as an additional chart point to discuss subjects where sensitivity sits beside a careful understanding of other people’s difficulties. It is not a diagnosis or a claim that trauma is required.',
            ],
          },
          {
            title: 'When its meaning is more specific',
            paragraphs: [
              'For a personal interpretation, Chiron’s house and close aspects to personal planets or angles matter most. People born in nearby years often share its sign, so the sign alone is not enough for a separate conclusion.',
            ],
          },
        ],
        shortAnswer: 'Chiron is a minor body used in chart reading for vulnerable experience and knowledge developed through it.',
      },
    },
    relatedTopicIds: ['planets-overview', 'aspects-overview', 'planet-saturn'],
    personalizationKind: { type: 'planet', key: 'chiron', questionKind: 'default' },
  },
] satisfies readonly KnowledgeTopicSource[];
