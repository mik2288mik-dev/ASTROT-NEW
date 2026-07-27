import type { Locale } from './site';

export type Dictionary = typeof dictionaries.ru;

const dictionaries = {
  ru: {
    nav: { features: 'Что внутри', zodiac: 'Знаки', guides: 'Разборы', faq: 'Вопросы', support: 'Поддержка' },
    hero: {
      eyebrow: 'Твой Гороскоп',
      title: 'Что у тебя сейчас — и куда всё движется.',
      body: 'Личный прогноз, натальная карта, совместимость и гороскопы по знакам — в одном приложении.',
      primary: 'Показать приложение',
      secondary: 'Почитать разборы',
    },
    sections: {
      personal: { title: 'Личный прогноз', body: 'Главное про сегодня, а дальше — любовь, работа, деньги, неделя, месяц и год.' },
      natal: { title: 'Натальная карта', body: 'Сильные стороны, привычные реакции и истории, которые у тебя повторяются.' },
      compatibility: { title: 'Совместимость', body: 'Где вы легко понимаете друг друга, а где разговор быстро идёт не туда.' },
      zodiac: { title: 'Гороскоп по знаку', body: 'Самый быстрый способ заглянуть в прогноз и начать без лишних шагов.' },
      questions: { title: 'Свои вопросы', body: 'Работа, деньги, отношения, переезд и решения, которые давно крутятся в голове.' },
    },
    home: {
      whyTitle: 'Не общий текст на всех',
      whyBody: 'Можно начать со знака, а можно добавить дату рождения и получить разбор именно про себя.',
      contentTitle: 'Разборы без занудства',
      contentBody: 'Натальная карта, совместимость, асцендент, время рождения и другие темы — простым человеческим языком.',
      finalTitle: 'Начни с того, что волнует тебя сегодня',
      finalBody: 'Любовь, деньги, работа, совместимость или просто свой знак — выбирай, с чего зайти.',
    },
    common: { readMore: 'Посмотреть', allGuides: 'Все разборы', allSigns: 'Все знаки', comingSoon: 'Скоро в магазинах', home: 'Главная', guides: 'Разборы', zodiac: 'Знаки зодиака', horoscopes: 'Гороскопы', updated: 'Обновлено' },
    footer: { text: 'Информационно-развлекательный сервис. Не заменяет медицинскую, юридическую или финансовую консультацию.', privacy: 'Конфиденциальность', terms: 'Условия', deleteAccount: 'Удаление аккаунта', support: 'Поддержка' },
  },
  en: {
    nav: { features: 'Inside the app', zodiac: 'Zodiac', guides: 'Guides', faq: 'Questions', support: 'Support' },
    hero: {
      eyebrow: 'Your Horoscope',
      title: 'See what is happening now — and where it is going.',
      body: 'Personal forecasts, natal chart, compatibility, and zodiac horoscopes in one app.',
      primary: 'Explore the app',
      secondary: 'Read the guides',
    },
    sections: {
      personal: { title: 'Personal forecast', body: 'The main thing about today, followed by love, work, money, week, month, and year.' },
      natal: { title: 'Natal chart', body: 'Strengths, familiar reactions, and stories that keep repeating in your life.' },
      compatibility: { title: 'Compatibility', body: 'Where you understand each other easily — and where the conversation starts going wrong.' },
      zodiac: { title: 'Zodiac horoscope', body: 'The quickest way to check a forecast and start without extra steps.' },
      questions: { title: 'Your questions', body: 'Work, money, relationships, relocation, and the decisions that keep circling in your head.' },
    },
    home: {
      whyTitle: 'Not one generic text for everyone',
      whyBody: 'Start with your zodiac sign, or add your birth details for a reading built around you.',
      contentTitle: 'Guides without the lecture',
      contentBody: 'Natal charts, compatibility, rising signs, birth time, and more — explained like a real person would explain it.',
      finalTitle: 'Start with whatever is on your mind today',
      finalBody: 'Love, money, work, compatibility, or simply your sign — choose where to begin.',
    },
    common: { readMore: 'Explore', allGuides: 'All guides', allSigns: 'All signs', comingSoon: 'Coming to stores', home: 'Home', guides: 'Guides', zodiac: 'Zodiac signs', horoscopes: 'Horoscopes', updated: 'Updated' },
    footer: { text: 'An informational and entertainment service. It is not medical, legal, or financial advice.', privacy: 'Privacy', terms: 'Terms', deleteAccount: 'Delete account', support: 'Support' },
  },
  es: {
    nav: { features: 'Dentro de la app', zodiac: 'Signos', guides: 'Guías', faq: 'Preguntas', support: 'Ayuda' },
    hero: {
      eyebrow: 'Tu Horóscopo',
      title: 'Mira qué está pasando ahora y hacia dónde va.',
      body: 'Pronóstico personal, carta natal, compatibilidad y horóscopos por signo en una sola app.',
      primary: 'Ver la app',
      secondary: 'Leer las guías',
    },
    sections: {
      personal: { title: 'Pronóstico personal', body: 'Lo más importante de hoy y, después, amor, trabajo, dinero, semana, mes y año.' },
      natal: { title: 'Carta natal', body: 'Fortalezas, reacciones habituales e historias que se repiten en tu vida.' },
      compatibility: { title: 'Compatibilidad', body: 'Dónde os entendéis con facilidad y dónde la conversación empieza a torcerse.' },
      zodiac: { title: 'Horóscopo por signo', body: 'La forma más rápida de mirar el pronóstico y empezar sin pasos de más.' },
      questions: { title: 'Tus preguntas', body: 'Trabajo, dinero, relaciones, mudanzas y decisiones que no dejan de darte vueltas.' },
    },
    home: {
      whyTitle: 'No un texto genérico para todos',
      whyBody: 'Empieza por tu signo o añade tus datos de nacimiento para una lectura hecha para ti.',
      contentTitle: 'Guías sin sermones',
      contentBody: 'Carta natal, compatibilidad, ascendente, hora de nacimiento y otros temas explicados con naturalidad.',
      finalTitle: 'Empieza por lo que te preocupa hoy',
      finalBody: 'Amor, dinero, trabajo, compatibilidad o simplemente tu signo: elige por dónde entrar.',
    },
    common: { readMore: 'Ver', allGuides: 'Todas las guías', allSigns: 'Todos los signos', comingSoon: 'Próximamente en tiendas', home: 'Inicio', guides: 'Guías', zodiac: 'Signos del zodiaco', horoscopes: 'Horóscopos', updated: 'Actualizado' },
    footer: { text: 'Servicio informativo y de entretenimiento. No sustituye asesoramiento médico, legal o financiero.', privacy: 'Privacidad', terms: 'Condiciones', deleteAccount: 'Eliminar cuenta', support: 'Ayuda' },
  },
} as const;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] as Dictionary;
}
