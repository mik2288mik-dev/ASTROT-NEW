import type { Locale } from './site';

export const zodiacSlugs = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'] as const;
export type ZodiacSlug = (typeof zodiacSlugs)[number];

export type ZodiacInfo = { name:string; dates:string; title:string; description:string; intro:string; strengths:string; relationships:string; work:string; note:string };

const names: Record<Locale, Record<ZodiacSlug,string>> = {
  ru:{aries:'Овен',taurus:'Телец',gemini:'Близнецы',cancer:'Рак',leo:'Лев',virgo:'Дева',libra:'Весы',scorpio:'Скорпион',sagittarius:'Стрелец',capricorn:'Козерог',aquarius:'Водолей',pisces:'Рыбы'},
  en:{aries:'Aries',taurus:'Taurus',gemini:'Gemini',cancer:'Cancer',leo:'Leo',virgo:'Virgo',libra:'Libra',scorpio:'Scorpio',sagittarius:'Sagittarius',capricorn:'Capricorn',aquarius:'Aquarius',pisces:'Pisces'},
  es:{aries:'Aries',taurus:'Tauro',gemini:'Géminis',cancer:'Cáncer',leo:'Leo',virgo:'Virgo',libra:'Libra',scorpio:'Escorpio',sagittarius:'Sagitario',capricorn:'Capricornio',aquarius:'Acuario',pisces:'Piscis'},
};
const dates: Record<Locale, Record<ZodiacSlug,string>> = {
  ru:{aries:'21 марта — 19 апреля',taurus:'20 апреля — 20 мая',gemini:'21 мая — 20 июня',cancer:'21 июня — 22 июля',leo:'23 июля — 22 августа',virgo:'23 августа — 22 сентября',libra:'23 сентября — 22 октября',scorpio:'23 октября — 21 ноября',sagittarius:'22 ноября — 21 декабря',capricorn:'22 декабря — 19 января',aquarius:'20 января — 18 февраля',pisces:'19 февраля — 20 марта'},
  en:{aries:'March 21 — April 19',taurus:'April 20 — May 20',gemini:'May 21 — June 20',cancer:'June 21 — July 22',leo:'July 23 — August 22',virgo:'August 23 — September 22',libra:'September 23 — October 22',scorpio:'October 23 — November 21',sagittarius:'November 22 — December 21',capricorn:'December 22 — January 19',aquarius:'January 20 — February 18',pisces:'February 19 — March 20'},
  es:{aries:'21 de marzo — 19 de abril',taurus:'20 de abril — 20 de mayo',gemini:'21 de mayo — 20 de junio',cancer:'21 de junio — 22 de julio',leo:'23 de julio — 22 de agosto',virgo:'23 de agosto — 22 de septiembre',libra:'23 de septiembre — 22 de octubre',scorpio:'23 de octubre — 21 de noviembre',sagittarius:'22 de noviembre — 21 de diciembre',capricorn:'22 de diciembre — 19 de enero',aquarius:'20 de enero — 18 de febrero',pisces:'19 de febrero — 20 de marzo'},
};

const traits: Record<ZodiacSlug,{ru:string;en:string;es:string}> = {
  aries:{ru:'быстро переходит от идеи к действию и не любит бесконечную подготовку',en:'moves quickly from idea to action and dislikes endless preparation',es:'pasa rápido de la idea a la acción y no disfruta de la preparación interminable'},
  taurus:{ru:'ищет устойчивость, качество и понятный результат',en:'looks for stability, quality, and a tangible result',es:'busca estabilidad, calidad y un resultado tangible'},
  gemini:{ru:'быстро связывает идеи и видит несколько маршрутов сразу',en:'connects ideas quickly and sees several possible routes',es:'conecta ideas con rapidez y ve varias rutas posibles'},
  cancer:{ru:'тонко замечает атмосферу и защищает то, что считает своим',en:'reads atmosphere carefully and protects what feels important',es:'percibe el ambiente y protege lo que considera importante'},
  leo:{ru:'хочет проявляться заметно и понимать ценность своего вклада',en:'wants to contribute visibly and understand why that contribution matters',es:'quiere expresarse con claridad y sentir que su aporte importa'},
  virgo:{ru:'замечает детали и естественно ищет способ улучшить систему',en:'spots details and naturally looks for ways to improve a system',es:'detecta detalles y busca mejorar el sistema'},
  libra:{ru:'ищет баланс, пропорцию и рабочий способ договориться',en:'looks for balance, proportion, and a workable form of cooperation',es:'busca equilibrio, proporción y una forma justa de colaborar'},
  scorpio:{ru:'идёт глубже поверхности и не доверяет слишком простым объяснениям',en:'goes beneath the surface and resists shallow explanations',es:'va al fondo y desconfía de explicaciones superficiales'},
  sagittarius:{ru:'ищет свободу, перспективу и более широкий смысл',en:'looks for freedom, perspective, and a larger meaning',es:'busca libertad, perspectiva y un sentido más amplio'},
  capricorn:{ru:'думает результатами, сроками и конструкциями, которые должны выдержать время',en:'thinks in terms of results, timing, and durable structure',es:'piensa en resultados, plazos y estructuras duraderas'},
  aquarius:{ru:'видит необычные связи и защищает независимость мышления',en:'spots unusual connections and protects independence of thought',es:'detecta conexiones poco habituales y protege su independencia mental'},
  pisces:{ru:'улавливает тонкие настроения и часто думает через образы и чувства',en:'picks up subtle moods and often thinks through images and feeling',es:'percibe matices emocionales y suele pensar mediante imágenes o sensaciones'},
};

export function getZodiacInfo(locale: Locale, slug: ZodiacSlug): ZodiacInfo {
  const name = names[locale][slug];
  const range = dates[locale][slug];
  const trait = traits[slug][locale];
  if (locale === 'ru') return {
    name, dates:range, title:`${name}: характеристика знака`, description:`${name}: даты, характер, отношения, работа и отличие общего гороскопа от личного.`,
    intro:`${name} — солнечный знак для периода ${range}. Это только один слой карты, а не полный портрет человека.`,
    strengths:`В типичном проявлении ${name} ${trait}. Реальный характер также зависит от всей карты, среды и опыта.`,
    relationships:`В отношениях этому знаку особенно важны честные договорённости и понятный способ проявлять близость. Совместимость нельзя свести к одной цифре.`,
    work:`В работе сильнее проявляется там, где природный стиль можно превратить в конкретный навык. Профессию нельзя выбирать только по солнечному знаку.`,
    note:'Гороскоп по знаку даёт общий ориентир. Личный прогноз учитывает дату, время, место рождения и расчёты периода.',
  };
  if (locale === 'es') return {
    name, dates:range, title:`${name}: características del signo`, description:`${name}: fechas, personalidad, relaciones, trabajo y diferencia entre horóscopo general y lectura personal.`,
    intro:`${name} es el signo solar del período ${range}. Es una sola capa de la carta, no un retrato completo.`,
    strengths:`En una expresión típica, ${name} ${trait}. También influyen el resto de la carta, el entorno y la experiencia.`,
    relationships:'En relaciones importan los acuerdos claros y una forma comprensible de expresar cercanía. La compatibilidad no se reduce a una cifra.',
    work:'En el trabajo destaca cuando convierte su estilo natural en una habilidad concreta. La profesión no debe elegirse solo por el signo solar.',
    note:'El horóscopo por signo ofrece una orientación general. El pronóstico personal añade fecha, hora, lugar y cálculos del período.',
  };
  return {
    name, dates:range, title:`${name}: zodiac sign profile`, description:`${name}: dates, personality, relationships, work, and the difference between a general horoscope and a personal reading.`,
    intro:`${name} is the Sun sign for ${range}. It is one layer of a chart, not a complete personality portrait.`,
    strengths:`In a typical expression, ${name} ${trait}. The rest of the chart, environment, and experience also matter.`,
    relationships:'Clear agreements and an understandable way of showing closeness matter more than a single compatibility score.',
    work:'This sign tends to do best when its natural style becomes a practical skill. A profession should not be chosen from the Sun sign alone.',
    note:'A zodiac horoscope gives a general orientation. A personal forecast adds birth date, time, place, and period calculations.',
  };
}
