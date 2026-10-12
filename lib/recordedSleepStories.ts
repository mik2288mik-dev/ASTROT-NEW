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
    id: 'librivox-may-night', free: false, durationSec: 1208.163, video: 'onboarding-birth',
    title: { ru: 'Сон в майскую ночь', en: 'A Dream on a May Night' },
    teaser: { ru: 'Григорий Данилевский · рассказ из «Степных сказок»', en: 'Grigory Danilevsky · a story from Steppe Tales' },
    voiceLabel: { ru: 'Читает Анастасия Солоха', en: 'Russian · Anastasiia Solokha' },
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
];

export function findRecordedSleepStory(id: string): RecordedSleepStory | null {
  return RECORDED_SLEEP_STORIES.find((story) => story.id === id) ?? null;
}

export function recordedStoryDuration(durationSec: number): string {
  const seconds = Math.round(durationSec);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
