import {
  hasAppVoiceCliche,
  hasAppVoiceMysticism,
  hasAppVoiceViolation,
  getPersonalForecastVoiceViolationCodes,
  hasPersonalForecastVoiceViolation,
} from '../lib/appVoice';

describe('app voice validation', () => {
  it.each([
    'Сегодня лучше замедлиться и прислушаться к себе.',
    'Позволь себе отпустить контроль.',
    'Побереги внутренний ресурс.',
    'Сегодня активная тема отношений проявляется сильнее.',
    'Мы нашли повторяющиеся сценарии.',
    'Карта сложилась. Это про тебя.',
    'The active theme is your inner pattern.',
    'Allow yourself to let go of control.',
  ])('rejects empty or artificial wording: %s', (text) => {
    expect(hasAppVoiceCliche(text)).toBe(true);
    expect(hasAppVoiceViolation(text)).toBe(true);
  });

  it.each([
    'Вселенная подсказывает, куда двигаться.',
    'Это часть твоего духовного пути.',
    'Trust the universe and its vibrations.',
    'Карма вернулась за старым долгом.',
  ])('rejects mystical wording: %s', (text) => {
    expect(hasAppVoiceMysticism(text)).toBe(true);
    expect(hasAppVoiceViolation(text)).toBe(true);
  });

  it.each([
    'Сегодня намёки не сработают. Нужен конкретный вопрос и такой же конкретный ответ.',
    'С деньгами слабое место — решения на эмоциях. Проверь цену и условия до оплаты.',
    'День твой. Забирай.',
    'Удача вышла на смену.',
    'The main risk is agreeing before you have checked the numbers.',
    'Теперь эта покупка тебе по карману.',
  ])('accepts direct concrete wording: %s', (text) => {
    expect(hasAppVoiceViolation(text)).toBe(false);
  });

  it.each([
    'Сегодня твоя сила — в спокойном присутствии.',
    'Сохрани внутреннюю ясность.',
    'Ищи опору внутри себя.',
    'Освободи пространство для себя и своих чувств.',
    'Рабочая стратегия требует жёстких личных границ.',
    'Внутреннее состояние просит бережного режима.',
    'Осознанность укрепит личный ресурс.',
    'Пора проработать старый психологический паттерн.',
    'Your strength is in calm presence.',
    'Protect your inner clarity and inner support.',
  ])('rejects coaching, psychology, and managerial abstractions in forecasts: %s', (text) => {
    expect(hasPersonalForecastVoiceViolation(text)).toBe(true);
  });

  it.each([
    'Старое дело получит апгрейд.',
    'Исправленная запись переведёт дело к окончательному решению.',
    'Его результат заметно продолжится.',
    'Предложение придёт от человека или команды рядом.',
    'Обсуждение перейдёт в общую папку материалов.',
    'Доведи дело до результата.',
    'Рабочий процесс получит новый формат.',
    'Появился дополнительный объём работы.',
    'Договорённость закрепится после разговора.',
    'На этой неделе денежное дело может сдвинуться.',
    'Появится возможность закрыть старый расход.',
    'Причина для дальнейших переносов исчезнет.',
    'Деньги вернутся не красиво и сразу.',
  ])('rejects machine and report-like forecast wording: %s', (text) => {
    expect(hasPersonalForecastVoiceViolation(text)).toBe(true);
  });

  it.each([
    [
      'Сегодня запланированная встреча может не состояться в назначенное время.',
      'REPORT_FORMAL_EVENT',
    ],
    [
      'В календаре появится новая дата вместо прежней.',
      'REPORT_FORMAL_EVENT',
    ],
    [
      'На экране маршрута может обнаружиться другой пункт пересадки.',
      'REPORT_IMPERSONAL_DISCOVERY',
    ],
    [
      'Расходы этой недели будут закрыты.',
      'REPORT_FORMAL_EVENT',
    ],
    [
      'Разговор состоится и закончится договорённостью.',
      'REPORT_FORMAL_EVENT',
    ],
    [
      'Эта история получит продолжение.',
      'REPORT_FORMAL_CONNECTOR',
    ],
    [
      'Нужный ответ прозвучит без долгих объяснений.',
      'REPORT_EDITED_PROSE',
    ],
    [
      'Пересадка сбежит первой.',
      'REPORT_FORCED_IMAGE',
    ],
    [
      'Деньги разобьются надвое.',
      'REPORT_FORCED_IMAGE',
    ],
    [
      'В истории операций появятся две строки.',
      'REPORT_BANK_NOTICE',
    ],
    [
      'Расходы дня закроются.',
      'REPORT_BANK_NOTICE',
    ],
    [
      'Маршрут сдастся первым.',
      'REPORT_FORCED_IMAGE',
    ],
    [
      'Намеченная поездка может начаться с лишней пересадки.',
      'REPORT_WRITTEN_TIME',
    ],
    [
      'Ехать окажется заметно короче, чем планировалось.',
      'REPORT_IMPOSSIBLE_COLLOCATION',
    ],
    [
      'Освободившееся время не растворится в ожидании транспорта.',
      'REPORT_WRITTEN_TIME',
    ],
    [
      'Дорожная возня в итоге сэкономит время.',
      'REPORT_IMPOSSIBLE_COLLOCATION',
    ],
    [
      'Обстановка быстро соберётся вокруг новой мебели.',
      'REPORT_IMPOSSIBLE_COLLOCATION',
    ],
    [
      'Интерес к твоему предложению заметно вырастет.',
      'REPORT_ABSTRACT_INTEREST',
    ],
    [
      'В сообщениях появятся варианты времени для разговора.',
      'REPORT_ABSTRACT_INTEREST',
    ],
    [
      'Идея быстро перейдёт в совместную договорённость.',
      'REPORT_ABSTRACT_INTEREST',
    ],
    [
      'После короткого обмена деталями люди договорятся о встрече.',
      'REPORT_WRITTEN_EVENT',
    ],
    [
      'Работу с капающим краном снова перенесут.',
      'REPORT_WRITTEN_EVENT',
    ],
    [
      'Мастер вернётся в ванную и закончит ремонт.',
      'REPORT_WRITTEN_EVENT',
    ],
    [
      'Водяная возня закончится без маленькой водяной драмы.',
      'REPORT_FORCED_IMAGE',
    ],
    [
      'Работы заметят за пределами привычного круга.',
      'REPORT_WRITTEN_EVENT',
    ],
    [
      'Один показ расширит круг заказчиков.',
      'REPORT_WRITTEN_EVENT',
    ],
    [
      'Останется один городской вариант.',
      'REPORT_VAGUE_PLACEHOLDER',
    ],
    [
      'Его получится пройти проще.',
      'REPORT_IMPOSSIBLE_COLLOCATION',
    ],
    [
      'Встреча передумала.',
      'REPORT_FORCED_IMAGE',
    ],
    [
      'Ответь на предложенный способ разговора.',
      'REPORT_IMPOSSIBLE_COLLOCATION',
    ],
    [
      'Сумма окажется ниже первой. Она окажется удобнее выбранной.',
      'REPORT_IMPOSSIBLE_COLLOCATION',
    ],
    [
      'В обсуждении появится новая цифра.',
      'REPORT_WRITTEN_EVENT',
    ],
    [
      'Человек с другой стороны пересмотрит сумму.',
      'REPORT_WRITTEN_EVENT',
    ],
    [
      'Договорённость о поездке изменится из-за новых обстоятельств.',
      'REPORT_BAD_COLLOCATION',
    ],
    [
      'Чек окажется приятнее ожидаемого.',
      'REPORT_FORCED_IMAGE',
    ],
    [
      'Обычная встреча продолжится новой поездкой.',
      'REPORT_IMPOSSIBLE_COLLOCATION',
    ],
    [
      'Потрать остаток с пользой.',
      'COACHING_GENERIC_ADVICE',
    ],
  ])('rejects written or machine-made Russian that people do not say aloud: %s', (text, code) => {
    expect(getPersonalForecastVoiceViolationCodes(text)).toContain(code);
    expect(hasPersonalForecastVoiceViolation(text)).toBe(true);
  });

  it.each([
    'Сегодня встречу могут перенести на другой час.',
    'В календаре может поменяться дата.',
    'В приложении может поменяться место пересадки.',
    'Этих денег может хватить на расходы недели.',
    'После разговора люди договорятся.',
    'Деньги могут прийти частями.',
    'Поездка может занять меньше времени.',
    'Новую мебель могут поставить у окна.',
    'Твоей идеей могут заинтересоваться.',
    'Тебе могут предложить несколько часов на выбор.',
    'После разговора появится общий план.',
    'После пары сообщений люди договорятся встретиться.',
    'Встреча всё же состоится.',
    'Ответ может прийти раньше, чем планировалось.',
    'Дальше будет пустой участок дороги.',
    'Кран могут починить без новой поездки в магазин.',
    'Твою идею могут показать новым людям.',
  ])('keeps the same meaning when it is said in ordinary Russian: %s', (text) => {
    expect(hasPersonalForecastVoiceViolation(text)).toBe(false);
  });

  it.each([
    'Не нервничай зря.',
    'Не переживай из-за ответа.',
    'Успокойся и расслабься.',
  ])('rejects coaching commands about feelings: %s', (text) => {
    expect(hasPersonalForecastVoiceViolation(text)).toBe(true);
  });

  it.each([
    'Сегодня можно нажать на день посильнее.',
    'Нажми и не спорь.',
    'Пора остановиться.',
    'Остановись и выдохни.',
    'Нужно выдохнуть и прислушаться к себе.',
    'Не распыляйся по мелочам.',
    'Жми, пока всё идёт.',
  ])('rejects the exact forecast filler removed from the product voice: %s', (text) => {
    expect(hasPersonalForecastVoiceViolation(text)).toBe(true);
  });

  it.each([
    'Космос сегодня на твоей стороне.',
    'Твоя аура притягивает нужных людей.',
    'Это знак свыше и подарок судьбы.',
  ])('rejects cosmic and esoteric language in personal forecasts: %s', (text) => {
    expect(hasPersonalForecastVoiceViolation(text)).toBe(true);
  });

  it.each([
    'На столе не хватает пространства для ноутбука и чашки.',
    'В разговоре оставь паузу, чтобы человек успел ответить.',
  ])('keeps concrete physical and conversational wording: %s', (text) => {
    expect(hasPersonalForecastVoiceViolation(text)).toBe(false);
  });
});
