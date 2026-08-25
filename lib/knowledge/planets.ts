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
        summary: 'В натальной карте отмечают, где находились Солнце, Луна и планеты в момент рождения. В астрологии каждое небесное тело связывают с отдельной группой вопросов.',
        sections: [
          {
            title: 'Что в карте называют планетами',
            paragraphs: [
              'Для удобства в карте к планетам относят и Солнце с Луной. Солнце связывают с осознанным выбором, Луну с привычными реакциями, а Меркурий с мышлением и речью. Это язык астрологической интерпретации, а не утверждение, что небесные тела физически управляют характером.',
            ],
          },
          {
            title: 'Как читать положение',
            paragraphs: [
              'Знак зодиака описывает, как выражается значение планеты. Дом, одна из двенадцати частей круга карты, указывает на связанные с ней жизненные вопросы. Аспекты, то есть связи между точками карты, показывают, как значения разных планет сочетаются. Одно положение не описывает человека целиком.',
            ],
          },
        ],
        shortAnswer: 'Планета обозначает определённую группу вопросов; знак описывает, как выражается её значение, дом указывает на область жизни, а аспекты связывают её с другими планетами.',
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
        summary: 'В натальной карте отмечают, где находилось Солнце в момент рождения. В астрологии его положение связывают с осознанным выбором, личными целями и готовностью отвечать за свои решения.',
        sections: [
          {
            title: 'Что читают по Солнцу',
            paragraphs: [
              'Положение Солнца используют, чтобы обсуждать, как человек выбирает направление, выражает собственную позицию и отличает важные для себя цели от чужих ожиданий. Знак, в котором находится Солнце, обычно и называют знаком зодиака человека. Он не описывает всю личность.',
            ],
          },
          {
            title: 'Что уточняет положение',
            paragraphs: [
              'Знак Солнца описывает привычный способ принимать решения. Дом, одна из двенадцати частей круга карты, показывает, в каких жизненных вопросах эта тема заметнее. Аспекты, то есть связи Солнца с другими планетами и точками карты, добавляют к чтению другие темы.',
            ],
          },
        ],
        shortAnswer: 'Солнце в натальной карте связывают с личными целями, осознанным выбором и собственной позицией человека.',
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
  },
  {
    id: 'planet-moon',
    category: 'planets',
    aliases: {
      ru: ['луна', 'луна в карте', 'лунный знак', 'спутник земли'],
      en: ['moon in the chart', 'moon sign'],
    },
    keywords: {
      ru: ['луна', 'лунный знак', 'привычки', 'реакции', 'забота'],
      en: ['moon', 'moon sign', 'habits', 'responses', 'care'],
    },
    copy: {
      ru: {
        title: 'Луна',
        summary: 'Луна — естественный спутник Земли. В астрологической карте записывают её положение на зодиакальном круге; в западной традиции Луну связывают с привычными эмоциональными реакциями, памятью, заботой и повседневным ритмом.',
        sections: [
          {
            title: 'Что это на самом деле',
            kind: 'fact',
            paragraphs: [
              'Луна обращается вокруг Земли и отражает солнечный свет. Она не является планетой в астрономической классификации. В астрологическом интерфейсе её часто ставят в общий список «планет» вместе с Солнцем ради удобства чтения карты; Солнце и Луну при этом также называют светилами.',
            ],
          },
          {
            title: 'Как определяется положение',
            kind: 'calculation',
            paragraphs: [
              'Для выбранного момента эфемериды дают эклиптическую долготу Луны. Она быстро проходит зодиак и меняет знак примерно каждые два с половиной дня, поэтому для натального положения важны дата и время. Дом Луны дополнительно зависит от места и системы домов.',
            ],
          },
          {
            title: 'Почему у Луны есть фазы',
            kind: 'mechanism',
            paragraphs: [
              'Солнце всегда освещает примерно половину Луны. Пока Луна движется вокруг Земли, мы видим разную долю этой освещённой половины. Так возникают новолуние, четверти и полнолуние; сама Луна не меняет форму.',
            ],
          },
          {
            title: 'Что означает Луна в астрологии',
            kind: 'astrology',
            paragraphs: [
              'По Луне обсуждают непосредственную реакцию на происходящее, привычки, чувство знакомого и способы давать или принимать заботу. Знак описывает форму отклика, дом — область вопросов, аспекты — связи с другими функциями карты. Это символическая трактовка, а не астрономический вывод о характере.',
            ],
          },
          {
            title: 'Часто путают',
            kind: 'confusion',
            paragraphs: [
              'Лунный знак — положение Луны в момент рождения. Текущая фаза — геометрия Солнца, Земли и Луны сегодня. Это разные параметры. Луна в полнолуние не обязательно находилась в том же знаке, что натальная Луна.',
            ],
          },
        ],
        shortAnswer: 'Астрономически Луна — спутник Земли. В астрологии её положение используют как символический язык привычных реакций и потребности в заботе.',
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
    relatedTopicIds: ['lunar-cycle', 'moon-phase', 'full-moon', 'planet-sun', 'aspects-overview', 'chart-point-object'],
    diagram: 'moon-phases',
    sourceIds: ['nasa-moon-phases'],
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
        summary: 'Меркурий — планета в натальной карте, которую в астрологии связывают с мышлением, речью, обучением и обменом информацией.',
        sections: [
          {
            title: 'Что читают по Меркурию',
            paragraphs: [
              'Положение Меркурия используют, чтобы обсуждать темп рассуждений, способ формулировать мысли, задавать вопросы и осваивать новые сведения. Оно не измеряет интеллект и не делит людей на способных и неспособных.',
            ],
          },
          {
            title: 'Что уточняет положение',
            paragraphs: [
              'Знак Меркурия, то есть участок зодиака, в котором он находился при рождении, описывает стиль речи и работы с информацией. Дом, одна из двенадцати частей круга карты, указывает на жизненные вопросы, к которым мысль чаще возвращается. Аспекты связывают Меркурий с другими планетами и точками карты. Ретроградная отметка означает видимое с Земли обратное движение планеты и не отменяет остальные части чтения.',
            ],
          },
        ],
        shortAnswer: 'Меркурий в натальной карте связывают с тем, как человек воспринимает сведения, строит мысль и выражает её словами.',
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
        summary: 'Венера — планета в натальной карте, которую в астрологии связывают с симпатией, близостью, вкусом и личными представлениями о ценном.',
        sections: [
          {
            title: 'Что читают по Венере',
            paragraphs: [
              'Положение Венеры используют, чтобы обсуждать, что человек ценит в отношениях, как показывает расположение и на что обращает внимание при сближении. Венера не обещает определённый исход отношений и не заменяет сравнение карт двух людей.',
            ],
          },
          {
            title: 'Что ещё относится к Венере',
            paragraphs: [
              'С Венерой также связывают вкус, удовольствие и способ договариваться о взаимности. Знак, то есть участок зодиака, в котором находилась Венера при рождении, описывает форму этих предпочтений. Дом, одна из двенадцати частей круга карты, указывает на связанные с ними жизненные вопросы, а аспекты связывают Венеру с другими планетами и точками карты.',
            ],
          },
        ],
        shortAnswer: 'Венеру в натальной карте связывают с тем, что человек ценит, как выражает симпатию и строит близость.',
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
        summary: 'Марс — планета в натальной карте, которую в астрологии связывают с инициативой, прямым действием, защитой личных границ и поведением в споре.',
        sections: [
          {
            title: 'Что читают по Марсу',
            paragraphs: [
              'Положение Марса используют, чтобы обсуждать, как человек начинает дело, добивается конкретного результата и отвечает на сопротивление. Оно не означает постоянную агрессию и не служит оценкой силы характера.',
            ],
          },
          {
            title: 'Что уточняет положение',
            paragraphs: [
              'Знак Марса, то есть участок зодиака, в котором он находился при рождении, описывает манеру действовать. Дом, одна из двенадцати частей круга карты, указывает на жизненные вопросы, где инициатива заметнее. Аспекты связывают Марс с другими планетами и помогают сопоставить действие с чувствами, речью и самоконтролем. Напряжённый аспект не означает неизбежный конфликт.',
            ],
          },
        ],
        shortAnswer: 'Марс в натальной карте связывают с тем, как человек начинает действовать, отстаивает границы и отвечает на сопротивление.',
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
        summary: 'Юпитер — планета в натальной карте, которую в астрологии связывают с расширением кругозора, убеждениями, обучением и оценкой больших возможностей.',
        sections: [
          {
            title: 'Что читают по Юпитеру',
            paragraphs: [
              'Положение Юпитера используют, чтобы обсуждать отношение к образованию, мировоззрению, доверию и целям, выходящим за рамки повседневных задач. С ним также связывают склонность переоценивать возможности, поэтому Юпитер не означает гарантированную удачу.',
            ],
          },
          {
            title: 'Что уточняет положение',
            paragraphs: [
              'Знак Юпитера, то есть участок зодиака, в котором он находился при рождении, описывает способ расширять знания и опыт. Дом, одна из двенадцати частей круга карты, указывает на жизненные вопросы, в которых человек чаще ищет более широкий выбор. Аспекты связывают Юпитер с другими планетами и помогают сопоставить большие цели с правилами и ограничениями.',
            ],
          },
        ],
        shortAnswer: 'Юпитер в натальной карте связывают с обучением, мировоззрением и тем, как человек оценивает возможности за пределами привычного опыта.',
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
        summary: 'Сатурн — планета в натальной карте, которую в астрологии связывают с правилами, ограничениями, ответственностью и долгими задачами.',
        sections: [
          {
            title: 'Что читают по Сатурну',
            paragraphs: [
              'Положение Сатурна используют, чтобы обсуждать, в каких вопросах человек особенно осторожен, требователен к себе или сосредоточен на правилах. С ним связывают и страх ошибки, и способность долго работать по установленным условиям.',
            ],
          },
          {
            title: 'Что уточняет положение',
            paragraphs: [
              'Знак Сатурна, то есть участок зодиака, в котором он находился при рождении, описывает способ обращаться с требованиями и пределами. Дом, одна из двенадцати частей круга карты, указывает на связанные с ними жизненные вопросы, а аспекты связывают Сатурн с другими планетами и точками карты. Сатурн не предсказывает наказание и не доказывает, что трудности обязательны.',
            ],
          },
        ],
        shortAnswer: 'Сатурн в натальной карте связывают с отношением к правилам, ответственности, ограничениям и долгим задачам.',
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
        summary: 'Уран — медленно движущаяся планета в натальной карте. В астрологии его связывают с независимостью, резкими переменами правил и непривычными решениями.',
        sections: [
          {
            title: 'Почему знак общий для поколения',
            paragraphs: [
              'Уран проводит в одном знаке зодиака несколько лет, поэтому люди близких лет рождения часто имеют одинаковый знак Урана. Для личного чтения смотрят также на дом, одну из двенадцати частей круга карты, и точные аспекты Урана с Солнцем, Луной и другими точками карты.',
            ],
          },
          {
            title: 'Что читают по Урану',
            paragraphs: [
              'Положение Урана используют, чтобы обсуждать отношение к самостоятельности, переменам и правилам, которые человек считает устаревшими. Оно не делает человека непредсказуемым во всех ситуациях и само по себе не предсказывает внезапное событие.',
            ],
          },
        ],
        shortAnswer: 'Уран в натальной карте связывают с отношением к независимости, переменам правил и непривычным решениям.',
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
        summary: 'Нептун — медленно движущаяся планета в натальной карте. В астрологии его связывают с воображением, идеализацией, сочувствием и различием между ожиданием и фактом.',
        sections: [
          {
            title: 'Что читают по Нептуну',
            paragraphs: [
              'Положение Нептуна используют, чтобы обсуждать воображение, восприимчивость к образам и способность сопереживать. С ним также связывают случаи, когда желаемое принимают за действительное или неясные ожидания заменяют проверенные сведения.',
            ],
          },
          {
            title: 'Почему знак общий для поколения',
            paragraphs: [
              'Нептун проводит в одном знаке зодиака много лет, поэтому его знак часто совпадает у людей одного поколения. Для более личного чтения смотрят на дом, одну из двенадцати частей круга карты, и точные аспекты Нептуна с Солнцем, Луной, Меркурием, Венерой, Марсом и углами карты.',
            ],
          },
        ],
        shortAnswer: 'Нептун в натальной карте связывают с воображением, идеализацией и тем, как человек отличает ожидание от проверенного факта.',
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
        summary: 'Плутон — карликовая планета, положение которой отмечают в натальной карте. В астрологии его связывают с контролем, сильным давлением и глубоким изменением установившегося порядка.',
        sections: [
          {
            title: 'Что читают по Плутону',
            paragraphs: [
              'Положение Плутона используют, чтобы обсуждать отношение к власти, контролю, уязвимости и ситуациям, в которых прежние правила перестают работать. Плутон не предсказывает катастрофу и не доказывает, что тяжёлый кризис обязателен.',
            ],
          },
          {
            title: 'Почему знак общий для поколения',
            paragraphs: [
              'Плутон движется медленно и проводит в одном знаке зодиака много лет, поэтому его знак часто совпадает у людей одного поколения. Для более личного чтения смотрят на дом, одну из двенадцати частей круга карты, и близкие аспекты Плутона с Солнцем, Луной и другими точками карты.',
            ],
          },
        ],
        shortAnswer: 'Плутон в натальной карте связывают с отношением к контролю, сильному давлению и переменам установившегося порядка.',
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
  },
  {
    id: 'planet-chiron',
    category: 'planets',
    aliases: {
      ru: ['хирон', 'хирон в карте', 'знак хирона', '2060 хирон', 'кентавр хирон'],
      en: ['chiron in the chart', 'chiron sign'],
    },
    keywords: {
      ru: ['хирон', 'уязвимость', 'опыт', 'обучение', 'малое тело'],
      en: ['chiron', 'vulnerability', 'experience', 'learning', 'minor body'],
    },
    copy: {
      ru: {
        title: 'Хирон',
        summary: 'Хирон, или 2060 Chiron, — реальный малый объект Солнечной системы из группы кентавров. Он движется между орбитами Сатурна и Урана; в современной астрологии его используют как дополнительный символический фактор карты.',
        sections: [
          {
            title: 'Что это на самом деле',
            kind: 'fact',
            paragraphs: [
              'Хирон обращается вокруг Солнца по вытянутой и нестабильной орбите между областями движения гигантских планет. У него наблюдалась кометная активность, поэтому объект имеет обозначения и как малая планета, и как комета. Он относится к классу кентавров.',
            ],
          },
          {
            title: 'Когда и кем он открыт',
            kind: 'history',
            paragraphs: [
              'Чарльз Коваль обнаружил объект в 1977 году. Имя дали в честь кентавра Хирона из древнегреческой мифологии — учителя и целителя. Позже название «кентавры» закрепилось за целой группой похожих объектов внешней Солнечной системы.',
            ],
          },
          {
            title: 'Когда его стали использовать астрологи',
            kind: 'history',
            depth: 'deep',
            paragraphs: [
              'Астрологические трактовки начали формироваться после открытия Хирона в конце двадцатого века. Это сравнительно новый слой западной астрологии, поэтому его роль и допустимые орбисы менее единообразны, чем у традиционных семи планет.',
            ],
          },
          {
            title: 'Что означает Хирон в астрологии',
            kind: 'astrology',
            paragraphs: [
              'В современной практике Хирон часто связывают с уязвимостью, сложным опытом, обучением через ограничения и способностью лучше понимать похожие трудности других. Это символическая интерпретация, а не медицинский диагноз и не доказательство пережитой травмы.',
            ],
          },
          {
            title: 'Как уточняют положение',
            kind: 'calculation',
            paragraphs: [
              'Хирон движется медленно, поэтому его знак часто совпадает у людей близких лет рождения. Более конкретно астрологи рассматривают дом и точные аспекты к личным планетам и углам карты.',
            ],
          },
          {
            title: 'Часто путают',
            kind: 'confusion',
            paragraphs: [
              'Хирон — не математическая точка вроде Лилит и не планета в современной астрономической классификации. Это наблюдаемый объект, которому астрология позже приписала символическое значение.',
            ],
          },
        ],
        shortAnswer: 'Хирон — реальный кентавр, открытый в 1977 году. Его астрологическая тема уязвимости появилась позже и остаётся интерпретацией.',
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
    relatedTopicIds: ['chart-point-object', 'planet-saturn', 'planet-uranus', 'aspects-overview', 'black-moon-lilith'],
    sourceIds: ['nasa-chiron'],
  },
] satisfies readonly KnowledgeTopicSource[];
