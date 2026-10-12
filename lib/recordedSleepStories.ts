import type { SleepStory } from './sleepStories';
import type { VideoBackgroundId } from './videoBackgrounds';

/** Existing Russian readings, streamed from private server assets without TTS. */
export type RecordedSleepStory = Pick<SleepStory, 'id' | 'free' | 'title' | 'teaser' | 'voiceLabel'> & {
  durationSec: number;
  video: VideoBackgroundId;
};

export const RECORDED_SLEEP_STORIES: readonly RecordedSleepStory[] = [
  {
    id: 'librivox-steppe', free: true, durationSec: 113.998, video: 'onboarding-day',
    title: { ru: 'Степь', en: 'The Steppe' },
    teaser: { ru: 'Григорий Данилевский · просторы, травы и степной ветер', en: 'Grigory Danilevsky · open country, grass and the steppe wind' },
    voiceLabel: { ru: 'Читает Анастасия Солоха', en: 'Russian · Anastasiia Solokha' },
  },
  {
    id: 'librivox-wonder-teapot', free: false, durationSec: 193.045, video: 'sounds-cafe',
    title: { ru: 'Диковинный чайник', en: 'The Wonderful Teapot' },
    teaser: { ru: 'Японская сказка о необычном чайнике', en: 'A Japanese tale about an unusual teapot' },
    voiceLabel: { ru: 'Читает Анастасия Солоха', en: 'Russian · Anastasiia Solokha' },
  },
  {
    id: 'librivox-japanese-children', free: false, durationSec: 295.471, video: 'onboarding-future',
    title: { ru: 'Японские дети', en: 'Japanese Children' },
    teaser: { ru: 'Из сборника японских народных сказок', en: 'From a collection of Japanese folk tales' },
    voiceLabel: { ru: 'Читает Анастасия Солоха', en: 'Russian · Anastasiia Solokha' },
  },
  {
    id: 'librivox-frog-princess', free: true, durationSec: 585.273, video: 'sounds-stream',
    title: { ru: 'Царевна-лягушка', en: 'The Frog Princess' },
    teaser: { ru: 'Иван-царевич, Василиса Премудрая и стрела у болота', en: 'Ivan Tsarevich, Vasilisa the Wise and an arrow in the marsh' },
    voiceLabel: { ru: 'Читает Лена Сухая', en: 'Russian · Lena Sukhaya' },
  },
  {
    id: 'librivox-mouse-house', free: true, durationSec: 105.352, video: 'sleep-garden-rain',
    title: { ru: 'Теремок мышки', en: 'The Mouse’s Little House' },
    teaser: { ru: 'Короткая русская народная сказка из сборника Афанасьева', en: 'A short Russian folk tale collected by Afanasyev' },
    voiceLabel: { ru: 'Читает Лена Сухая', en: 'Russian · Lena Sukhaya' },
  },
  {
    id: 'librivox-ivan-the-fool', free: false, durationSec: 460.539, video: 'story-quiet-lane',
    title: { ru: 'Иван-дурак', en: 'Ivan the Fool' },
    teaser: { ru: 'Русская народная сказка из сборника Афанасьева', en: 'A Russian folk tale collected by Afanasyev' },
    voiceLabel: { ru: 'Читает Лена Сухая', en: 'Russian · Lena Sukhaya' },
  },
  {
    id: 'librivox-young-lady-peasant', free: false, durationSec: 2263.510, video: 'onboarding-people',
    title: { ru: 'Барышня-крестьянка', en: 'The Young Lady Peasant' },
    teaser: { ru: 'Александр Пушкин · тайные встречи и знакомство под чужим именем', en: 'Alexander Pushkin · secret meetings and an assumed identity' },
    voiceLabel: { ru: 'Читает Xenium5', en: 'Russian · Xenium5' },
  },
  {
    id: 'librivox-blizzard', free: false, durationSec: 1596.343, video: 'sleep-night-train',
    title: { ru: 'Метель', en: 'The Blizzard' },
    teaser: { ru: 'Александр Пушкин · зимняя дорога, тайное венчание и неожиданная встреча', en: 'Alexander Pushkin · a winter journey, a secret wedding and an unexpected meeting' },
    voiceLabel: { ru: 'Читает Xenium5', en: 'Russian · Xenium5' },
  },
  {
    id: 'librivox-forest-steppe', free: false, durationSec: 1001.535, video: 'onboarding-choice',
    title: { ru: 'Лес и степь', en: 'Forest and Steppe' },
    teaser: { ru: 'Иван Тургенев · лесные тропы, простор полей и смена времён года', en: 'Ivan Turgenev · woodland paths, open fields and the changing seasons' },
    voiceLabel: { ru: 'Читает tovarisch', en: 'Russian · tovarisch' },
  },
  {
    id: 'librivox-bezhin-meadow', free: false, durationSec: 2939.220, video: 'onboarding-day',
    title: { ru: 'Бежин луг', en: 'Bezhin Meadow' },
    teaser: { ru: 'Иван Тургенев · летняя ночь, костёр и рассказы мальчиков на лугу', en: 'Ivan Turgenev · a summer night, a campfire and boys telling stories in a meadow' },
    voiceLabel: { ru: 'Читает tovarisch', en: 'Russian · tovarisch' },
  },
  {
    id: 'librivox-rejuvenating-apples', free: false, durationSec: 1541.355, video: 'sleep-garden-rain',
    title: { ru: 'Молодильные яблоки и живая вода', en: 'Rejuvenating Apples and Living Water' },
    teaser: { ru: 'Русская народная сказка о путешествии Ивана-царевича к чудесному саду', en: 'A Russian folk tale about Ivan Tsarevich’s journey to a wondrous garden' },
    voiceLabel: { ru: 'Читает Mark Chulsky', en: 'Russian · Mark Chulsky' },
  },
  {
    id: 'librivox-koschei', free: false, durationSec: 1368.816, video: 'onboarding-choice',
    title: { ru: 'Кощей Бессмертный', en: 'Koschei the Deathless' },
    teaser: { ru: 'Русская народная сказка о Кощее, пленённой царевне и поиске спрятанной смерти', en: 'A Russian folk tale about Koschei, a captive princess and his hidden death' },
    voiceLabel: { ru: 'Читает Mark Chulsky', en: 'Russian · Mark Chulsky' },
  },
  {
    id: 'librivox-katigoroshek', free: false, durationSec: 2294.622, video: 'mood-week',
    title: { ru: 'Катигорошек', en: 'Katigoroshek' },
    teaser: { ru: 'Народная сказка из сборника Афанасьева о богатыре и его удивительных спутниках', en: 'A folk tale collected by Afanasyev about a hero and his extraordinary companions' },
    voiceLabel: { ru: 'Читает Ханна Пономаренко', en: 'Russian · Hanna Ponomarenko' },
  },
  {
    id: 'librivox-ivan-marfa', free: false, durationSec: 978.860, video: 'sounds-stream',
    title: { ru: 'Иван-царевич и Марфа-царевна', en: 'Ivan Tsarevich and Marfa Tsarevna' },
    teaser: { ru: 'Русская народная сказка о спасении царевны и битве со змеями', en: 'A Russian folk tale about rescuing a princess and battling serpents' },
    voiceLabel: { ru: 'Читает Лена Сухая', en: 'Russian · Lena Sukhaya' },
  },
];

export function findRecordedSleepStory(id: string): RecordedSleepStory | null {
  return RECORDED_SLEEP_STORIES.find((story) => story.id === id) ?? null;
}

export function recordedStoryDuration(durationSec: number): string {
  const seconds = Math.round(durationSec);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
