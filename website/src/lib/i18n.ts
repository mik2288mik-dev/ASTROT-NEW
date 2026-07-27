import type { Locale } from './site';

export type Dictionary = typeof dictionaries.ru;

const dictionaries = {
  ru: {
    nav: { features: 'Что внутри', zodiac: 'Знаки', guides: 'Разборы', faq: 'Вопросы', support: 'Поддержка' },
    hero: {
      eyebrow: 'Твой Гороскоп',
      title: 'Личный гороскоп, натальная карта и совместимость',
      body: 'Посмотри, что происходит сейчас, и разберись в том, что правда волнует.',
      primary: 'Посмотреть приложение',
      secondary: 'Начать со знака',
    },
    sections: {
      personal: { title: 'Личный прогноз', body: 'Сегодня, неделя, месяц и год — с акцентом на то, что важно именно тебе.' },
      natal: { title: 'Натальная карта', body: 'Сильные стороны, привычные реакции и истории, которые повторяются.' },
      compatibility: { title: 'Совместимость', body: 'Где вам легко, где начинаются сложности и почему один и тот же спор возвращается.' },
      zodiac: { title: 'Гороскоп по знаку', body: 'Быстрый способ посмотреть общий прогноз без длинной анкеты.' },
      questions: { title: 'Свои вопросы', body: 'Работа, деньги, отношения, переезд, новая профессия или большое решение.' },
    },
    home: {
      whyTitle: 'Не общий текст на всех',
      whyBody: 'Можно начать со знака, а можно добавить данные рождения и получить более личный разбор.',
      contentTitle: 'Разборы и статьи',
      contentBody: 'Понятные материалы о натальной карте, совместимости, асценденте и популярных вопросах об астрологии.',
      finalTitle: 'Начни с того, что сейчас не даёт покоя',
      finalBody: 'Любовь, работа, деньги, совместимость или просто твой знак — выбирай, с чего зайти.',
    },
    common: { readMore: 'Смотреть дальше', allGuides: 'Все разборы', allSigns: 'Все знаки', comingSoon: 'Скоро в магазинах', home: 'Главная', guides: 'Разборы', zodiac: 'Знаки зодиака', horoscopes: 'Гороскопы', updated: 'Обновлено' },
    footer: { text: 'Информационно-развлекательный сервис. Решения всё равно остаются за тобой.', privacy: 'Конфиденциальность', terms: 'Условия', deleteAccount: 'Удаление аккаунта', support: 'Поддержка' },
  },
  en: {
    nav: { features: 'Inside', zodiac: 'Zodiac', guides: 'Guides', faq: 'Questions', support: 'Support' },
    hero: {
      eyebrow: 'Your Horoscope',
      title: 'Personal horoscope, natal chart, and compatibility',
      body: 'See what is happening now and explore what is actually on your mind.',
      primary: 'Explore the app',
      secondary: 'Start with your sign',
    },
    sections: {
      personal: { title: 'Personal forecast', body: 'Today, week, month, and year — focused on what matters to you.' },
      natal: { title: 'Natal chart', body: 'Strengths, familiar reactions, and stories that keep repeating.' },
      compatibility: { title: 'Compatibility', body: 'Where things feel easy, where they get difficult, and why the same argument returns.' },
      zodiac: { title: 'Zodiac horoscope', body: 'A quick general forecast without a long questionnaire.' },
      questions: { title: 'Your questions', body: 'Work, money, relationships, relocation, a new career, or a major decision.' },
    },
    home: {
      whyTitle: 'Not one generic text for everyone',
      whyBody: 'Start with your sign or add birth details for a more personal reading.',
      contentTitle: 'Guides and articles',
      contentBody: 'Clear reading about natal charts, compatibility, rising signs, and popular astrology questions.',
      finalTitle: 'Start with whatever is on your mind right now',
      finalBody: 'Love, work, money, compatibility, or simply your sign — choose where to begin.',
    },
    common: { readMore: 'Keep exploring', allGuides: 'All guides', allSigns: 'All signs', comingSoon: 'Coming to stores', home: 'Home', guides: 'Guides', zodiac: 'Zodiac signs', horoscopes: 'Horoscopes', updated: 'Updated' },
    footer: { text: 'An informational and entertainment service. Your choices remain your own.', privacy: 'Privacy', terms: 'Terms', deleteAccount: 'Delete account', support: 'Support' },
  },
  es: {
    nav: { features: 'Dentro', zodiac: 'Signos', guides: 'Guías', faq: 'Preguntas', support: 'Ayuda' },
    hero: {
      eyebrow: 'Tu Horóscopo',
      title: 'Horóscopo personal, carta natal y compatibilidad',
      body: 'Mira qué está pasando ahora y explora lo que de verdad te preocupa.',
      primary: 'Ver la app',
      secondary: 'Empezar por mi signo',
    },
    sections: {
      personal: { title: 'Pronóstico personal', body: 'Hoy, semana, mes y año, con foco en lo que importa para ti.' },
      natal: { title: 'Carta natal', body: 'Fortalezas, reacciones habituales e historias que se repiten.' },
      compatibility: { title: 'Compatibilidad', body: 'Dónde todo fluye, dónde se complica y por qué vuelve la misma discusión.' },
      zodiac: { title: 'Horóscopo por signo', body: 'Un pronóstico general rápido, sin formularios largos.' },
      questions: { title: 'Tus preguntas', body: 'Trabajo, dinero, relaciones, mudanza, nueva profesión o una decisión importante.' },
    },
    home: {
      whyTitle: 'No un texto genérico para todos',
      whyBody: 'Empieza por tu signo o añade tus datos de nacimiento para una lectura más personal.',
      contentTitle: 'Guías y artículos',
      contentBody: 'Lecturas claras sobre carta natal, compatibilidad, ascendente y preguntas populares de astrología.',
      finalTitle: 'Empieza por lo que ahora mismo no te deja tranquilo',
      finalBody: 'Amor, trabajo, dinero, compatibilidad o simplemente tu signo: elige por dónde entrar.',
    },
    common: { readMore: 'Seguir viendo', allGuides: 'Todas las guías', allSigns: 'Todos los signos', comingSoon: 'Próximamente en tiendas', home: 'Inicio', guides: 'Guías', zodiac: 'Signos del zodiaco', horoscopes: 'Horóscopos', updated: 'Actualizado' },
    footer: { text: 'Servicio informativo y de entretenimiento. Tus decisiones siguen siendo tuyas.', privacy: 'Privacidad', terms: 'Condiciones', deleteAccount: 'Eliminar cuenta', support: 'Ayuda' },
  },
} as const;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] as Dictionary;
}
