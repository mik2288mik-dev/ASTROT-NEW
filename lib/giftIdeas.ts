/**
 * «Что подарить?»: real, buyable gift ideas picked by the person's Sun and
 * Venus elements, their role in your life and the budget. Free for everyone.
 */

export type GiftElement = 'fire' | 'earth' | 'air' | 'water';
export type GiftRole = 'partner' | 'friend' | 'family' | 'colleague';
export type GiftBudget = 'low' | 'mid' | 'high';
export type GiftGender = 'female' | 'male' | 'unspecified';

export type GiftIdea = {
  id: string;
  title: string;
  why: string;
  price: string;
  budget: GiftBudget;
  elements: GiftElement[];
  roles: GiftRole[];
  gender: 'any' | 'female' | 'male';
  /** Picture under `/assets/gift/`. */
  image: string;
};

const ALL_ROLES: GiftRole[] = ['partner', 'friend', 'family', 'colleague'];
const CLOSE: GiftRole[] = ['partner', 'friend', 'family'];

export const GIFT_IDEAS: GiftIdea[] = [
  // Огонь — яркое, впечатления, движение
  { id: 'concert', title: 'Билеты на концерт или стендап', why: 'Живые эмоции и вечер, который запомнится.', price: '3 000–8 000 ₽', budget: 'high', elements: ['fire', 'air'], roles: CLOSE, gender: 'any', image: 'photo' },
  { id: 'quest', title: 'Квест или картинг на двоих', why: 'Азарт и немного соревнования — то, что заряжает.', price: '3 000–6 000 ₽', budget: 'mid', elements: ['fire'], roles: ['partner', 'friend'], gender: 'any', image: 'games' },
  { id: 'photo-session', title: 'Сертификат на фотосессию', why: 'Побыть в центре кадра и получить красивые фото.', price: 'от 4 000 ₽', budget: 'mid', elements: ['fire', 'air'], roles: CLOSE, gender: 'any', image: 'photo' },
  { id: 'sneakers', title: 'Яркие кроссовки или спортивная форма', why: 'Для тех, кто любит движение и выглядеть заметно.', price: '5 000–12 000 ₽', budget: 'high', elements: ['fire'], roles: ['partner', 'family'], gender: 'any', image: 'sport' },
  { id: 'smart-band', title: 'Фитнес-браслет', why: 'Считает шаги и тренировки — приятно видеть свой прогресс.', price: '2 500–5 000 ₽', budget: 'mid', elements: ['fire', 'earth'], roles: CLOSE, gender: 'any', image: 'watch' },
  { id: 'sunglasses', title: 'Стильные солнцезащитные очки', why: 'Заметная деталь образа на каждый день.', price: '2 000–6 000 ₽', budget: 'mid', elements: ['fire', 'air'], roles: ['partner', 'friend'], gender: 'any', image: 'accessories' },
  { id: 'board-game', title: 'Настольная игра для компании', why: 'Повод собраться вместе и посмеяться.', price: '1 500–4 000 ₽', budget: 'low', elements: ['fire', 'air'], roles: ALL_ROLES, gender: 'any', image: 'games' },
  // Земля — качество, польза, комфорт
  { id: 'cashmere-scarf', title: 'Кашемировый шарф глубокого цвета', why: 'Качественная вещь, которую носят годами.', price: '3 000–6 000 ₽', budget: 'mid', elements: ['earth', 'water'], roles: CLOSE, gender: 'any', image: 'accessories' },
  { id: 'leather-planner', title: 'Ежедневник в коже с гравировкой', why: 'Персональная и полезная вещь на каждый день.', price: '2 000–3 500 ₽', budget: 'mid', elements: ['earth', 'air'], roles: ALL_ROLES, gender: 'any', image: 'books' },
  { id: 'coffee-set', title: 'Хороший кофе и турка или френч-пресс', why: 'Маленький ежедневный ритуал удовольствия.', price: '1 500–4 000 ₽', budget: 'low', elements: ['earth'], roles: ALL_ROLES, gender: 'any', image: 'coffee' },
  { id: 'thermo-mug', title: 'Термокружка от хорошего бренда', why: 'Практично: горячий чай в дороге весь день.', price: '1 500–3 000 ₽', budget: 'low', elements: ['earth'], roles: ALL_ROLES, gender: 'any', image: 'coffee' },
  { id: 'watch', title: 'Классические наручные часы', why: 'Надёжная красивая вещь, которой пользуются каждый день.', price: 'от 7 000 ₽', budget: 'high', elements: ['earth'], roles: ['partner', 'family'], gender: 'any', image: 'watch' },
  { id: 'spa', title: 'Сертификат в СПА или на массаж', why: 'Отдых для тела — то, что ценят без лишних слов.', price: '4 000–8 000 ₽', budget: 'high', elements: ['earth', 'water'], roles: CLOSE, gender: 'any', image: 'care' },
  { id: 'plant', title: 'Красивое комнатное растение в кашпо', why: 'Живое и уютное, радует каждый день.', price: '1 500–4 000 ₽', budget: 'low', elements: ['earth', 'water'], roles: ALL_ROLES, gender: 'any', image: 'home' },
  { id: 'bag', title: 'Кожаная сумка или рюкзак', why: 'Вещь на каждый день, которая служит долго.', price: 'от 6 000 ₽', budget: 'high', elements: ['earth'], roles: ['partner', 'family'], gender: 'any', image: 'bags' },
  // Воздух — общение, новое, идеи
  { id: 'books', title: 'Пара книг в любимом жанре', why: 'Новые идеи и повод обсудить прочитанное.', price: '1 000–2 500 ₽', budget: 'low', elements: ['air', 'water'], roles: ALL_ROLES, gender: 'any', image: 'books' },
  { id: 'masterclass', title: 'Мастер-класс: керамика, кулинария или рисование', why: 'Попробовать новое своими руками — и вдвоём веселее.', price: '3 000–6 000 ₽', budget: 'mid', elements: ['air', 'earth'], roles: CLOSE, gender: 'any', image: 'photo' },
  { id: 'headphones', title: 'Беспроводные наушники', why: 'Музыка, подкасты и звонки — всегда под рукой.', price: '4 000–15 000 ₽', budget: 'high', elements: ['air'], roles: CLOSE, gender: 'any', image: 'gadgets' },
  { id: 'trip', title: 'Поездка на выходные в новый город', why: 'Новые места и впечатления — лучший подарок для любопытных.', price: 'от 10 000 ₽', budget: 'high', elements: ['air', 'fire'], roles: ['partner', 'family'], gender: 'any', image: 'bags' },
  { id: 'course', title: 'Подписка на онлайн-курс или язык', why: 'Для тех, кто любит учиться и узнавать новое.', price: '1 500–5 000 ₽', budget: 'mid', elements: ['air'], roles: ALL_ROLES, gender: 'any', image: 'tech' },
  { id: 'speaker', title: 'Портативная колонка', why: 'Музыка в дорогу, на природу и для компании.', price: '3 000–7 000 ₽', budget: 'mid', elements: ['air', 'fire'], roles: CLOSE, gender: 'any', image: 'gadgets' },
  { id: 'museum', title: 'Абонемент в музей или театр', why: 'Красивые вечера и темы для разговоров.', price: '2 000–5 000 ₽', budget: 'mid', elements: ['air', 'water'], roles: CLOSE, gender: 'any', image: 'photo' },
  // Вода — забота, уют, память
  { id: 'candle', title: 'Ароматическая свеча из натурального воска', why: 'Тёплый уютный вечер дома.', price: '1 000–3 000 ₽', budget: 'low', elements: ['water', 'earth'], roles: ALL_ROLES, gender: 'any', image: 'aroma' },
  { id: 'blanket', title: 'Мягкий плед', why: 'Забота, которую чувствуешь каждый вечер.', price: '2 500–6 000 ₽', budget: 'mid', elements: ['water', 'earth'], roles: CLOSE, gender: 'any', image: 'home' },
  { id: 'photo-book', title: 'Фотокнига ваших общих моментов', why: 'Память, которую хочется пересматривать.', price: '2 000–4 000 ₽', budget: 'mid', elements: ['water'], roles: ['partner', 'family', 'friend'], gender: 'any', image: 'books' },
  { id: 'perfume', title: 'Парфюм или нишевый аромат', why: 'Личный и запоминающийся подарок — выбирайте по вкусу человека.', price: 'от 5 000 ₽', budget: 'high', elements: ['water', 'fire'], roles: ['partner'], gender: 'any', image: 'aroma' },
  { id: 'care-set', title: 'Набор хорошего ухода для кожи', why: 'Немного заботы о себе каждый день.', price: '2 000–5 000 ₽', budget: 'mid', elements: ['water', 'earth'], roles: CLOSE, gender: 'female', image: 'care' },
  { id: 'grooming-set', title: 'Набор для ухода за бородой и кожей', why: 'Практичная забота о себе.', price: '2 000–4 000 ₽', budget: 'mid', elements: ['earth', 'water'], roles: CLOSE, gender: 'male', image: 'care' },
  { id: 'jewelry', title: 'Украшение из серебра', why: 'Небольшая красивая вещь, которую носят каждый день.', price: '3 000–8 000 ₽', budget: 'mid', elements: ['water', 'fire'], roles: ['partner', 'family'], gender: 'female', image: 'accessories' },
  { id: 'tea-set', title: 'Набор хорошего чая и красивая чашка', why: 'Спокойный уютный ритуал.', price: '1 000–2 500 ₽', budget: 'low', elements: ['water', 'earth'], roles: ALL_ROLES, gender: 'any', image: 'coffee' },
  { id: 'letter', title: 'Письмо от руки и любимые сладости', why: 'Бесценно для тех, кто ценит внимание больше вещей.', price: 'до 1 000 ₽', budget: 'low', elements: ['water'], roles: CLOSE, gender: 'any', image: 'books' },
  { id: 'gadget-camera', title: 'Камера моментальной печати', why: 'Фото сразу в руках — весело на любой встрече.', price: '7 000–12 000 ₽', budget: 'high', elements: ['water', 'air'], roles: ['partner', 'friend'], gender: 'any', image: 'photo' },
];

const SIGN_ELEMENT: Record<string, GiftElement> = {
  aries: 'fire', leo: 'fire', sagittarius: 'fire',
  taurus: 'earth', virgo: 'earth', capricorn: 'earth',
  gemini: 'air', libra: 'air', aquarius: 'air',
  cancer: 'water', scorpio: 'water', pisces: 'water',
};

export const ELEMENT_TASTE: Record<GiftElement, string> = {
  fire: 'любит яркое, впечатления и движение',
  earth: 'ценит качество, пользу и комфорт',
  air: 'любит новое, общение и идеи',
  water: 'ценит заботу, уют и память о хорошем',
};

export function elementOfSign(sign: string | null | undefined): GiftElement | null {
  return sign ? SIGN_ELEMENT[sign.trim().toLowerCase()] ?? null : null;
}

export function pickGiftIdeas(input: {
  sunElement: GiftElement | null;
  venusElement: GiftElement | null;
  role: GiftRole;
  budget: GiftBudget;
  gender: GiftGender;
  limit?: number;
}): GiftIdea[] {
  const scored = GIFT_IDEAS
    .filter((gift) => gift.roles.includes(input.role))
    .filter((gift) => gift.gender === 'any' || gift.gender === input.gender)
    .map((gift) => {
      let score = 0;
      if (input.venusElement && gift.elements.includes(input.venusElement)) score += 3;
      if (input.sunElement && gift.elements.includes(input.sunElement)) score += 2;
      if (gift.budget === input.budget) score += 3;
      else if ((input.budget === 'mid' && gift.budget === 'low') || (input.budget === 'high' && gift.budget === 'mid')) score += 1;
      else score -= 2;
      return { gift, score };
    })
    .sort((a, b) => b.score - a.score || a.gift.id.localeCompare(b.gift.id));
  return scored.slice(0, input.limit ?? 5).map((item) => item.gift);
}
