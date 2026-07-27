import type { Locale } from './site';

export type Dictionary = typeof dictionaries.ru;

const dictionaries = {
  ru: {
    nav: { features: 'Возможности', zodiac: 'Знаки', guides: 'Разборы', faq: 'Вопросы', support: 'Поддержка' },
    hero: {
      eyebrow: 'Твой Гороскоп',
      title: 'Гороскоп без тумана. Разбор — по делу.',
      body: 'Личные прогнозы, натальная карта, совместимость и гороскопы по знакам в одном приложении.',
      primary: 'Посмотреть возможности',
      secondary: 'Читать разборы',
    },
    sections: {
      personal: { title: 'Личный прогноз', body: 'Сегодня, неделя, месяц и год — с учётом данных рождения и реальных расчётов.' },
      natal: { title: 'Натальная карта', body: 'Понятный разбор сильных сторон, повторяющихся сценариев и особенностей характера.' },
      compatibility: { title: 'Совместимость', body: 'Не “идеальная пара”, а честный разбор общения, притяжения и сложных мест.' },
      zodiac: { title: 'Гороскоп по знаку', body: 'Быстрый вход для тех, кто хочет начать с общего прогноза.' },
      questions: { title: 'Ответы на вопросы', body: 'Персональные ответы по карте и выбранному периоду — без чатовой воды.' },
    },
    home: {
      whyTitle: 'Почему это не очередной гороскоп',
      whyBody: 'Приложение разделяет общий прогноз по знаку и персональный разбор. Там, где расчёт не даёт оснований для громкого вывода, мы не придумываем событие ради эффекта.',
      contentTitle: 'Читайте полезные разборы',
      contentBody: 'Мы публикуем материалы о натальной карте, совместимости, времени рождения, асценденте и популярных астрологических темах — без паники и псевдонаучных обещаний.',
      finalTitle: 'Начните со своего формата',
      finalBody: 'Можно открыть гороскоп по знаку или добавить данные рождения и получить личный разбор.',
    },
    common: { readMore: 'Читать дальше', allGuides: 'Все разборы', allSigns: 'Все знаки', comingSoon: 'Скоро в магазинах', home: 'Главная', guides: 'Разборы', zodiac: 'Знаки зодиака', horoscopes: 'Гороскопы', updated: 'Обновлено' },
    footer: { text: 'Информационно-развлекательный сервис. Не заменяет медицинскую, юридическую или финансовую консультацию.', privacy: 'Конфиденциальность', terms: 'Условия', deleteAccount: 'Удаление аккаунта', support: 'Поддержка' },
  },
  en: {
    nav: { features: 'Features', zodiac: 'Zodiac', guides: 'Guides', faq: 'FAQ', support: 'Support' },
    hero: {
      eyebrow: 'Your Horoscope',
      title: 'A horoscope that gets to the point.',
      body: 'Personal forecasts, natal chart, compatibility, and zodiac horoscopes in one app.',
      primary: 'Explore features',
      secondary: 'Read guides',
    },
    sections: {
      personal: { title: 'Personal forecast', body: 'Today, week, month, and year — based on birth data and calculated factors.' },
      natal: { title: 'Natal chart', body: 'A clear look at strengths, repeating patterns, and personality traits.' },
      compatibility: { title: 'Compatibility', body: 'Not “perfect match” claims — a grounded look at communication, attraction, and friction.' },
      zodiac: { title: 'Zodiac horoscope', body: 'A quick way to start with a general sign-based forecast.' },
      questions: { title: 'Personal answers', body: 'Answers based on your chart and selected period, without chat filler.' },
    },
    home: {
      whyTitle: 'Why this is not just another horoscope',
      whyBody: 'The app separates sign-based content from personal readings. When the calculation does not support a dramatic conclusion, we do not invent one for effect.',
      contentTitle: 'Read useful astrology guides',
      contentBody: 'We publish practical material about natal charts, compatibility, birth time, rising signs, and popular astrology topics without panic or pseudo-scientific guarantees.',
      finalTitle: 'Start with the format that suits you',
      finalBody: 'Open a zodiac horoscope or add birth data for a personal reading.',
    },
    common: { readMore: 'Read more', allGuides: 'All guides', allSigns: 'All signs', comingSoon: 'Coming to stores', home: 'Home', guides: 'Guides', zodiac: 'Zodiac signs', horoscopes: 'Horoscopes', updated: 'Updated' },
    footer: { text: 'An informational and entertainment service. It is not medical, legal, or financial advice.', privacy: 'Privacy', terms: 'Terms', deleteAccount: 'Delete account', support: 'Support' },
  },
  es: {
    nav: { features: 'Funciones', zodiac: 'Signos', guides: 'Guías', faq: 'Preguntas', support: 'Ayuda' },
    hero: {
      eyebrow: 'Tu Horóscopo',
      title: 'Un horóscopo que va al grano.',
      body: 'Pronósticos personales, carta natal, compatibilidad y horóscopos por signo en una sola app.',
      primary: 'Ver funciones',
      secondary: 'Leer guías',
    },
    sections: {
      personal: { title: 'Pronóstico personal', body: 'Hoy, semana, mes y año, con datos de nacimiento y cálculos reales.' },
      natal: { title: 'Carta natal', body: 'Una explicación clara de fortalezas, patrones repetidos y rasgos personales.' },
      compatibility: { title: 'Compatibilidad', body: 'Sin promesas de “pareja perfecta”: comunicación, atracción y puntos de fricción.' },
      zodiac: { title: 'Horóscopo por signo', body: 'Una forma rápida de empezar con un pronóstico general.' },
      questions: { title: 'Respuestas personales', body: 'Respuestas basadas en tu carta y el período elegido, sin relleno de chat.' },
    },
    home: {
      whyTitle: 'Por qué no es otro horóscopo más',
      whyBody: 'La app separa el contenido general por signo de las lecturas personales. Si el cálculo no sostiene una conclusión llamativa, no inventamos un evento para impresionar.',
      contentTitle: 'Lee guías útiles',
      contentBody: 'Publicamos contenidos sobre carta natal, compatibilidad, hora de nacimiento, ascendente y temas populares de astrología sin alarmismo ni falsas garantías.',
      finalTitle: 'Empieza por el formato que prefieras',
      finalBody: 'Abre el horóscopo de tu signo o añade tus datos de nacimiento para una lectura personal.',
    },
    common: { readMore: 'Leer más', allGuides: 'Todas las guías', allSigns: 'Todos los signos', comingSoon: 'Próximamente en tiendas', home: 'Inicio', guides: 'Guías', zodiac: 'Signos del zodiaco', horoscopes: 'Horóscopos', updated: 'Actualizado' },
    footer: { text: 'Servicio informativo y de entretenimiento. No sustituye asesoramiento médico, legal o financiero.', privacy: 'Privacidad', terms: 'Condiciones', deleteAccount: 'Eliminar cuenta', support: 'Ayuda' },
  },
} as const;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] as Dictionary;
}
