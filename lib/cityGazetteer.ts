/**
 * Офлайн-справочник координат городов.
 *
 * Зачем: построение натальной карты не должно зависеть от внешнего геокодера.
 * Онлайн-сервисы (Open-Meteo / Nominatim) с серверного IP периодически лимитят
 * или банят запросы — и тогда карта не строилась у всех новых пользователей.
 * Для самых частых городов RU/СНГ/мира координаты зашиты локально, что делает
 * расчёт мгновенным и стопроцентно надёжным. Точность центра города (~1 км)
 * более чем достаточна для натальной карты (знаки, дома, аспекты).
 *
 * Часовой пояс не храним — он определяется офлайн по координатам через tz-lookup.
 */

type GazetteerEntry = { lat: number; lon: number; aliases: string[] };

// Координаты — центр города. Псевдонимы перечисляют распространённые написания
// (рус./лат./исторические/разговорные), всё сравнивается в нормализованном виде.
const CITIES: GazetteerEntry[] = [
  // ——— Россия ———
  { lat: 55.7558, lon: 37.6173, aliases: ['москва', 'moscow', 'moskva'] },
  { lat: 59.9311, lon: 30.3609, aliases: ['санкт-петербург', 'санкт петербург', 'петербург', 'питер', 'спб', 'saint petersburg', 'st petersburg', 'st. petersburg', 'leningrad', 'ленинград'] },
  { lat: 55.0084, lon: 82.9357, aliases: ['новосибирск', 'novosibirsk'] },
  { lat: 56.8389, lon: 60.6057, aliases: ['екатеринбург', 'yekaterinburg', 'ekaterinburg', 'свердловск'] },
  { lat: 55.7963, lon: 49.1088, aliases: ['казань', 'kazan'] },
  { lat: 56.2965, lon: 43.9361, aliases: ['нижний новгород', 'nizhny novgorod', 'горький'] },
  { lat: 55.1644, lon: 61.4368, aliases: ['челябинск', 'chelyabinsk'] },
  { lat: 53.1959, lon: 50.1002, aliases: ['самара', 'samara'] },
  { lat: 54.9885, lon: 73.3242, aliases: ['омск', 'omsk'] },
  { lat: 47.2357, lon: 39.7015, aliases: ['ростов-на-дону', 'ростов на дону', 'rostov-on-don', 'rostov'] },
  { lat: 54.7388, lon: 55.9721, aliases: ['уфа', 'ufa'] },
  { lat: 56.0153, lon: 92.8932, aliases: ['красноярск', 'krasnoyarsk'] },
  { lat: 51.6720, lon: 39.1843, aliases: ['воронеж', 'voronezh'] },
  { lat: 58.0105, lon: 56.2502, aliases: ['пермь', 'perm'] },
  { lat: 48.7080, lon: 44.5133, aliases: ['волгоград', 'volgograd', 'сталинград'] },
  { lat: 45.0355, lon: 38.9753, aliases: ['краснодар', 'krasnodar'] },
  { lat: 51.5331, lon: 46.0342, aliases: ['саратов', 'saratov'] },
  { lat: 57.1530, lon: 65.5343, aliases: ['тюмень', 'tyumen'] },
  { lat: 53.5078, lon: 49.4204, aliases: ['тольятти', 'tolyatti'] },
  { lat: 56.8526, lon: 53.2045, aliases: ['ижевск', 'izhevsk'] },
  { lat: 53.3548, lon: 83.7698, aliases: ['барнаул', 'barnaul'] },
  { lat: 54.3142, lon: 48.4031, aliases: ['ульяновск', 'ulyanovsk'] },
  { lat: 52.2870, lon: 104.3050, aliases: ['иркутск', 'irkutsk'] },
  { lat: 48.4827, lon: 135.0838, aliases: ['хабаровск', 'khabarovsk'] },
  { lat: 57.6261, lon: 39.8845, aliases: ['ярославль', 'yaroslavl'] },
  { lat: 43.1198, lon: 131.8869, aliases: ['владивосток', 'vladivostok'] },
  { lat: 42.9849, lon: 47.5047, aliases: ['махачкала', 'makhachkala'] },
  { lat: 56.4846, lon: 84.9476, aliases: ['томск', 'tomsk'] },
  { lat: 51.7682, lon: 55.0969, aliases: ['оренбург', 'orenburg'] },
  { lat: 55.3331, lon: 86.0833, aliases: ['кемерово', 'kemerovo'] },
  { lat: 53.7596, lon: 87.1216, aliases: ['новокузнецк', 'novokuznetsk'] },
  { lat: 54.6269, lon: 39.6916, aliases: ['рязань', 'ryazan'] },
  { lat: 46.3479, lon: 48.0336, aliases: ['астрахань', 'astrakhan'] },
  { lat: 55.7436, lon: 52.3958, aliases: ['набережные челны', 'naberezhnye chelny'] },
  { lat: 53.1959, lon: 45.0183, aliases: ['пенза', 'penza'] },
  { lat: 52.6031, lon: 39.5708, aliases: ['липецк', 'lipetsk'] },
  { lat: 58.6036, lon: 49.6680, aliases: ['киров', 'kirov'] },
  { lat: 56.1439, lon: 47.2489, aliases: ['чебоксары', 'cheboksary'] },
  { lat: 54.1961, lon: 37.6182, aliases: ['тула', 'tula'] },
  { lat: 54.7104, lon: 20.4522, aliases: ['калининград', 'kaliningrad', 'кёнигсберг'] },
  { lat: 51.7373, lon: 36.1873, aliases: ['курск', 'kursk'] },
  { lat: 45.0428, lon: 41.9734, aliases: ['ставрополь', 'stavropol'] },
  { lat: 43.5855, lon: 39.7231, aliases: ['сочи', 'sochi'] },
  { lat: 57.0000, lon: 40.9739, aliases: ['иваново', 'ivanovo'] },
  { lat: 53.2434, lon: 34.3641, aliases: ['брянск', 'bryansk'] },
  { lat: 50.5957, lon: 36.5873, aliases: ['белгород', 'belgorod'] },
  { lat: 61.2540, lon: 73.3962, aliases: ['сургут', 'surgut'] },
  { lat: 56.1290, lon: 40.4070, aliases: ['владимир', 'vladimir'] },
  { lat: 64.5401, lon: 40.5433, aliases: ['архангельск', 'arkhangelsk'] },
  { lat: 52.0340, lon: 113.4994, aliases: ['чита', 'chita'] },
  { lat: 54.5293, lon: 36.2754, aliases: ['калуга', 'kaluga'] },
  { lat: 54.7818, lon: 32.0401, aliases: ['смоленск', 'smolensk'] },
  { lat: 62.0339, lon: 129.7331, aliases: ['якутск', 'yakutsk'] },
  { lat: 54.1838, lon: 45.1749, aliases: ['саранск', 'saransk'] },
  { lat: 59.1269, lon: 37.9094, aliases: ['череповец', 'cherepovets'] },
  { lat: 59.2181, lon: 39.8886, aliases: ['вологда', 'vologda'] },
  { lat: 52.9685, lon: 36.0692, aliases: ['орёл', 'орел', 'oryol', 'orel'] },
  { lat: 68.9585, lon: 33.0827, aliases: ['мурманск', 'murmansk'] },
  { lat: 52.7218, lon: 41.4523, aliases: ['тамбов', 'tambov'] },
  { lat: 43.3169, lon: 45.6928, aliases: ['грозный', 'grozny'] },
  { lat: 61.7849, lon: 34.3469, aliases: ['петрозаводск', 'petrozavodsk'] },
  { lat: 57.7665, lon: 40.9266, aliases: ['кострома', 'kostroma'] },
  { lat: 44.7239, lon: 37.7708, aliases: ['новороссийск', 'novorossiysk'] },
  { lat: 56.6388, lon: 47.8908, aliases: ['йошкар-ола', 'йошкар ола', 'yoshkar-ola'] },
  { lat: 51.2917, lon: 37.8344, aliases: ['старый оскол', 'stary oskol'] },
  { lat: 44.9521, lon: 34.1024, aliases: ['симферополь', 'simferopol'] },
  { lat: 44.6166, lon: 33.5254, aliases: ['севастополь', 'sevastopol'] },
  { lat: 48.7860, lon: 44.7797, aliases: ['волжский', 'volzhsky'] },
  { lat: 60.9344, lon: 76.5531, aliases: ['нижневартовск', 'nizhnevartovsk'] },
  { lat: 53.6884, lon: 88.0707, aliases: ['прокопьевск', 'prokopyevsk'] },

  // ——— Украина ———
  { lat: 50.4501, lon: 30.5234, aliases: ['киев', 'kyiv', 'kiev'] },
  { lat: 49.9935, lon: 36.2304, aliases: ['харьков', 'kharkiv', 'kharkov'] },
  { lat: 46.4825, lon: 30.7233, aliases: ['одесса', 'odesa', 'odessa'] },
  { lat: 48.4647, lon: 35.0462, aliases: ['днепр', 'днепропетровск', 'dnipro', 'dnepropetrovsk'] },
  { lat: 48.0159, lon: 37.8028, aliases: ['донецк', 'donetsk'] },
  { lat: 49.8397, lon: 24.0297, aliases: ['львов', 'lviv', 'lvov'] },
  { lat: 47.8388, lon: 35.1396, aliases: ['запорожье', 'zaporizhzhia', 'zaporozhye'] },
  { lat: 47.9105, lon: 33.3918, aliases: ['кривой рог', 'kryvyi rih', 'krivoy rog'] },
  { lat: 46.9750, lon: 31.9946, aliases: ['николаев', 'mykolaiv', 'nikolaev'] },
  { lat: 49.2331, lon: 28.4682, aliases: ['винница', 'vinnytsia', 'vinnitsa'] },
  { lat: 48.9226, lon: 24.7111, aliases: ['ивано-франковск', 'ivano-frankivsk'] },
  { lat: 50.7472, lon: 25.3254, aliases: ['луцк', 'lutsk'] },
  { lat: 48.5740, lon: 39.3078, aliases: ['луганск', 'luhansk', 'lugansk'] },

  // ——— Беларусь ———
  { lat: 53.9006, lon: 27.5590, aliases: ['минск', 'minsk'] },
  { lat: 52.4345, lon: 30.9754, aliases: ['гомель', 'gomel'] },
  { lat: 53.9007, lon: 30.3313, aliases: ['могилёв', 'могилев', 'mogilev', 'mahilyow'] },
  { lat: 55.1904, lon: 30.2049, aliases: ['витебск', 'vitebsk'] },
  { lat: 53.6694, lon: 23.8131, aliases: ['гродно', 'grodno', 'hrodna'] },
  { lat: 52.0976, lon: 23.7341, aliases: ['брест', 'brest'] },

  // ——— Казахстан ———
  { lat: 43.2220, lon: 76.8512, aliases: ['алматы', 'алма-ата', 'almaty', 'alma-ata'] },
  { lat: 51.1694, lon: 71.4491, aliases: ['астана', 'нур-султан', 'astana', 'nur-sultan', 'целиноград'] },
  { lat: 42.3417, lon: 69.5901, aliases: ['шымкент', 'shymkent', 'чимкент'] },
  { lat: 49.8047, lon: 73.1094, aliases: ['караганда', 'karaganda'] },
  { lat: 50.2839, lon: 57.1670, aliases: ['актобе', 'aktobe', 'актюбинск'] },
  { lat: 42.9000, lon: 71.3667, aliases: ['тараз', 'taraz', 'джамбул'] },
  { lat: 52.2873, lon: 76.9674, aliases: ['павлодар', 'pavlodar'] },
  { lat: 49.9787, lon: 82.6014, aliases: ['усть-каменогорск', 'oskemen', 'ust-kamenogorsk'] },
  { lat: 47.1167, lon: 51.8833, aliases: ['атырау', 'atyrau'] },

  // ——— Узбекистан ———
  { lat: 41.2995, lon: 69.2401, aliases: ['ташкент', 'tashkent'] },
  { lat: 39.6270, lon: 66.9750, aliases: ['самарканд', 'samarkand'] },
  { lat: 40.9983, lon: 71.6726, aliases: ['наманган', 'namangan'] },
  { lat: 40.7821, lon: 72.3442, aliases: ['андижан', 'andijan'] },
  { lat: 39.7680, lon: 64.4556, aliases: ['бухара', 'bukhara'] },
  { lat: 40.5283, lon: 70.9425, aliases: ['фергана', 'fergana'] },

  // ——— Остальное СНГ / Закавказье ———
  { lat: 40.4093, lon: 49.8671, aliases: ['баку', 'baku'] },
  { lat: 40.1792, lon: 44.4991, aliases: ['ереван', 'yerevan'] },
  { lat: 41.7151, lon: 44.8271, aliases: ['тбилиси', 'tbilisi'] },
  { lat: 42.8746, lon: 74.5698, aliases: ['бишкек', 'bishkek', 'фрунзе'] },
  { lat: 38.5598, lon: 68.7870, aliases: ['душанбе', 'dushanbe'] },
  { lat: 37.9601, lon: 58.3261, aliases: ['ашхабад', 'ashgabat'] },
  { lat: 47.0105, lon: 28.8638, aliases: ['кишинёв', 'кишинев', 'chisinau', 'kishinev'] },
  { lat: 41.6168, lon: 41.6367, aliases: ['батуми', 'batumi'] },

  // ——— Европа ———
  { lat: 51.5074, lon: -0.1278, aliases: ['лондон', 'london'] },
  { lat: 48.8566, lon: 2.3522, aliases: ['париж', 'paris'] },
  { lat: 52.5200, lon: 13.4050, aliases: ['берлин', 'berlin'] },
  { lat: 48.1351, lon: 11.5820, aliases: ['мюнхен', 'munich', 'munchen'] },
  { lat: 40.4168, lon: -3.7038, aliases: ['мадрид', 'madrid'] },
  { lat: 41.3851, lon: 2.1734, aliases: ['барселона', 'barcelona'] },
  { lat: 41.9028, lon: 12.4964, aliases: ['рим', 'rome', 'roma'] },
  { lat: 45.4642, lon: 9.1900, aliases: ['милан', 'milan', 'milano'] },
  { lat: 52.3676, lon: 4.9041, aliases: ['амстердам', 'amsterdam'] },
  { lat: 48.2082, lon: 16.3738, aliases: ['вена', 'vienna', 'wien'] },
  { lat: 50.0755, lon: 14.4378, aliases: ['прага', 'prague', 'praha'] },
  { lat: 52.2297, lon: 21.0122, aliases: ['варшава', 'warsaw', 'warszawa'] },
  { lat: 47.4979, lon: 19.0402, aliases: ['будапешт', 'budapest'] },
  { lat: 37.9838, lon: 23.7275, aliases: ['афины', 'athens'] },
  { lat: 60.1699, lon: 24.9384, aliases: ['хельсинки', 'helsinki'] },
  { lat: 59.3293, lon: 18.0686, aliases: ['стокгольм', 'stockholm'] },
  { lat: 59.9139, lon: 10.7522, aliases: ['осло', 'oslo'] },
  { lat: 55.6761, lon: 12.5683, aliases: ['копенгаген', 'copenhagen'] },
  { lat: 50.8503, lon: 4.3517, aliases: ['брюссель', 'brussels'] },
  { lat: 38.7223, lon: -9.1393, aliases: ['лиссабон', 'lisbon', 'lisboa'] },
  { lat: 47.3769, lon: 8.5417, aliases: ['цюрих', 'zurich'] },
  { lat: 53.3498, lon: -6.2603, aliases: ['дублин', 'dublin'] },
  { lat: 56.9496, lon: 24.1052, aliases: ['рига', 'riga'] },
  { lat: 54.6872, lon: 25.2797, aliases: ['вильнюс', 'vilnius'] },
  { lat: 59.4370, lon: 24.7536, aliases: ['таллин', 'таллинн', 'tallinn'] },

  // ——— Ближний Восток / Азия / Америка / Океания ———
  { lat: 41.0082, lon: 28.9784, aliases: ['стамбул', 'istanbul'] },
  { lat: 39.9334, lon: 32.8597, aliases: ['анкара', 'ankara'] },
  { lat: 36.8969, lon: 30.7133, aliases: ['анталия', 'анталья', 'antalya'] },
  { lat: 25.2048, lon: 55.2708, aliases: ['дубай', 'dubai'] },
  { lat: 32.0853, lon: 34.7818, aliases: ['тель-авив', 'тель авив', 'tel aviv'] },
  { lat: 31.7683, lon: 35.2137, aliases: ['иерусалим', 'jerusalem'] },
  { lat: 30.0444, lon: 31.2357, aliases: ['каир', 'cairo'] },
  { lat: 39.9042, lon: 116.4074, aliases: ['пекин', 'beijing'] },
  { lat: 31.2304, lon: 121.4737, aliases: ['шанхай', 'shanghai'] },
  { lat: 35.6762, lon: 139.6503, aliases: ['токио', 'tokyo'] },
  { lat: 37.5665, lon: 126.9780, aliases: ['сеул', 'seoul'] },
  { lat: 28.7041, lon: 77.1025, aliases: ['дели', 'delhi', 'нью-дели', 'new delhi'] },
  { lat: 19.0760, lon: 72.8777, aliases: ['мумбаи', 'mumbai', 'бомбей'] },
  { lat: 13.7563, lon: 100.5018, aliases: ['бангкок', 'bangkok'] },
  { lat: 1.3521, lon: 103.8198, aliases: ['сингапур', 'singapore'] },
  { lat: 40.7128, lon: -74.0060, aliases: ['нью-йорк', 'нью йорк', 'new york'] },
  { lat: 34.0522, lon: -118.2437, aliases: ['лос-анджелес', 'лос анджелес', 'los angeles'] },
  { lat: 41.8781, lon: -87.6298, aliases: ['чикаго', 'chicago'] },
  { lat: 25.7617, lon: -80.1918, aliases: ['майами', 'miami'] },
  { lat: 43.6532, lon: -79.3832, aliases: ['торонто', 'toronto'] },
  { lat: -33.8688, lon: 151.2093, aliases: ['сидней', 'sydney'] },
  { lat: -37.8136, lon: 144.9631, aliases: ['мельбурн', 'melbourne'] },
];

/** Нормализует название города: регистр, ё→е, дефисы/пробелы, отбрасывает регион после запятой. */
function normalizeCityName(raw: string): string {
  return String(raw || '')
    .split(',')[0] // "Москва, Россия" → "Москва"
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/^г[.\s]+/u, '') // "г. Москва" → "москва"
    .replace(/\bгород\b/gu, '')
    .replace(/[‐‑‒–—]/g, '-') // разные тире → обычный дефис
    .replace(/[^\p{L}\s-]/gu, ' ') // убираем прочую пунктуацию
    .replace(/\s+/g, ' ')
    .trim();
}

const INDEX: Map<string, { lat: number; lon: number }> = (() => {
  const map = new Map<string, { lat: number; lon: number }>();
  for (const city of CITIES) {
    for (const alias of city.aliases) {
      map.set(normalizeCityName(alias), { lat: city.lat, lon: city.lon });
    }
  }
  return map;
})();

/**
 * Координаты города из локального справочника, либо null если города нет.
 * Возвращает только lat/lon — часовой пояс вызывающий код определяет офлайн
 * по координатам (tz-lookup), чтобы не дублировать данные.
 */
export function lookupCityCoordinates(placeName: string): { lat: number; lon: number } | null {
  const key = normalizeCityName(placeName);
  if (!key) return null;
  return INDEX.get(key) || null;
}
