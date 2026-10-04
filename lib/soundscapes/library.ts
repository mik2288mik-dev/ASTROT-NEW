/**
 * The sound library of «Звуки»: real CC0 / public-domain recordings streamed
 * from the server and cached on the device, plus the synthesized sounds that
 * work offline. Sources and licences are listed in public/audio/LICENSES.md.
 */
import type { MusicPiece, Soundscape } from './synth';

export type SoundGroup = 'rain' | 'forest' | 'stream' | 'sea' | 'fire' | 'cafe' | 'night';
export type TrackSource = { author: string; url: string; license: 'CC0 1.0' | 'Public domain' };

export type AmbientTrack = {
  id: string;
  group: SoundGroup;
  title: { ru: string; en: string };
} & ({ kind: 'file'; file: string; source: TrackSource } | { kind: 'synth'; synth: Soundscape });

export type MusicTrack = {
  id: string;
  title: { ru: string; en: string };
  note: { ru: string; en: string };
} & ({ kind: 'file'; file: string; source: TrackSource } | { kind: 'synth'; synth: MusicPiece });

export const SOUND_GROUPS: readonly SoundGroup[] = ['rain', 'forest', 'stream', 'sea', 'fire', 'cafe', 'night'];

export const SOUND_GROUP_LABELS: Record<SoundGroup, { ru: string; en: string }> = {
  rain: { ru: 'Дождь', en: 'Rain' },
  forest: { ru: 'Лес', en: 'Forest' },
  stream: { ru: 'Ручей', en: 'Stream' },
  sea: { ru: 'Море', en: 'Sea' },
  fire: { ru: 'Камин', en: 'Fireplace' },
  cafe: { ru: 'Кафе', en: 'Café' },
  night: { ru: 'Ночь', en: 'Night' },
};

const fs = (author: string, id: number): TrackSource => ({ author, url: `https://freesound.org/people/${author}/sounds/${id}/`, license: 'CC0 1.0' });

export const AMBIENT_TRACKS: readonly AmbientTrack[] = [
  { id: 'rain-roof', group: 'rain', kind: 'file', file: 'rain-roof.mp3', title: { ru: 'Дождь по мансардному окну', en: 'Rain on a roof window' }, source: fs('Metadex', 235827) },
  { id: 'rain-drip', group: 'rain', kind: 'file', file: 'rain-drip.mp3', title: { ru: 'Тихая капель', en: 'Soft dripping rain' }, source: fs('florianreichelt', 459983) },
  { id: 'rain-forest', group: 'rain', kind: 'file', file: 'rain-forest.mp3', title: { ru: 'Дождь в тропическом лесу', en: 'Rain in a rainforest' }, source: fs('INNORECORDS', 457447) },
  { id: 'rain-storm', group: 'rain', kind: 'file', file: 'rain-storm.mp3', title: { ru: 'Гроза', en: 'Thunderstorm' }, source: fs('regosss', 238295) },
  { id: 'rain-synth', group: 'rain', kind: 'synth', synth: 'rain', title: { ru: 'Ровный дождь — без интернета', en: 'Even rain — offline' } },
  { id: 'forest-dawn', group: 'forest', kind: 'file', file: 'forest-dawn.mp3', title: { ru: 'Птицы на рассвете', en: 'Dawn chorus' }, source: fs('squashy555', 573080) },
  { id: 'forest-spring', group: 'forest', kind: 'file', file: 'forest-spring.mp3', title: { ru: 'Весенний лес', en: 'Spring woods' }, source: fs('BurghRecords', 463903) },
  { id: 'forest-afternoon', group: 'forest', kind: 'file', file: 'forest-afternoon.mp3', title: { ru: 'Лес после обеда', en: 'Forest in the afternoon' }, source: fs('bajko', 385280) },
  { id: 'forest-rain-birds', group: 'forest', kind: 'file', file: 'forest-rain-birds.mp3', title: { ru: 'Птицы под дождём', en: 'Birds in the rain' }, source: fs('BurghRecords', 521360) },
  { id: 'forest-synth', group: 'forest', kind: 'synth', synth: 'forest', title: { ru: 'Ветер и птицы — без интернета', en: 'Wind and birds — offline' } },
  { id: 'stream-wyre', group: 'stream', kind: 'file', file: 'stream-wyre.mp3', title: { ru: 'Лесной ручей', en: 'Forest stream' }, source: fs('turbostream', 220528) },
  { id: 'stream-small', group: 'stream', kind: 'file', file: 'stream-small.mp3', title: { ru: 'Маленький ручеёк', en: 'A small brook' }, source: fs('Yuval', 197023) },
  { id: 'sea-calm', group: 'sea', kind: 'file', file: 'sea-calm.mp3', title: { ru: 'Спокойный прибой', en: 'Calm surf' }, source: fs('craiggroshek', 176617) },
  { id: 'sea-beach', group: 'sea', kind: 'file', file: 'sea-beach.mp3', title: { ru: 'Волны на пляже', en: 'Beach waves' }, source: fs('DylanTheFish', 463250) },
  { id: 'sea-waves', group: 'sea', kind: 'file', file: 'sea-waves.mp3', title: { ru: 'Морские волны', en: 'Sea waves' }, source: fs('haldigital97', 241824) },
  { id: 'sea-synth', group: 'sea', kind: 'synth', synth: 'sea', title: { ru: 'Медленные волны — без интернета', en: 'Slow waves — offline' } },
  { id: 'fire-fireplace', group: 'fire', kind: 'file', file: 'fire-fireplace.mp3', title: { ru: 'Камин', en: 'Fireplace' }, source: fs('martats', 138018) },
  { id: 'fire-campfire', group: 'fire', kind: 'file', file: 'fire-campfire.mp3', title: { ru: 'Костёр', en: 'Campfire' }, source: fs('Spandau', 40699) },
  { id: 'fire-lit', group: 'fire', kind: 'file', file: 'fire-lit.mp3', title: { ru: 'Потрескивание дров', en: 'Crackling logs' }, source: fs('lurpsis', 444127) },
  { id: 'fire-synth', group: 'fire', kind: 'synth', synth: 'fire', title: { ru: 'Огонь — без интернета', en: 'Fire — offline' } },
  { id: 'cafe-coffee', group: 'cafe', kind: 'file', file: 'cafe-coffee.mp3', title: { ru: 'Кофейня', en: 'Coffee shop' }, source: fs('waweee', 370973) },
  { id: 'cafe-chatter', group: 'cafe', kind: 'file', file: 'cafe-chatter.mp3', title: { ru: 'Разговоры за столиками', en: 'Table chatter' }, source: fs('oliverbrotzman', 125247) },
  { id: 'cafe-synth', group: 'cafe', kind: 'synth', synth: 'cafe', title: { ru: 'Гул кафе — без интернета', en: 'Café hum — offline' } },
  { id: 'night-porch', group: 'night', kind: 'file', file: 'night-porch.mp3', title: { ru: 'Сверчки у крыльца', en: 'Crickets by the porch' }, source: fs('hdfreema', 333221) },
  { id: 'night-crickets', group: 'night', kind: 'file', file: 'night-crickets.mp3', title: { ru: 'Летняя ночь', en: 'Summer night' }, source: fs('Defelozedd94', 522299) },
];

const commons = (author: string, page: string, license: TrackSource['license']): TrackSource => ({ author, url: page, license });

export const MUSIC_TRACKS: readonly MusicTrack[] = [
  { id: 'music-satie-gymnopedie-1', kind: 'file', file: 'music-satie-gymnopedie-1.mp3', title: { ru: 'Сати — Гимнопедия № 1', en: 'Satie — Gymnopédie No. 1' }, note: { ru: 'фортепиано, очень спокойно', en: 'piano, very calm' }, source: commons('Teknopazzo', 'https://commons.wikimedia.org/wiki/File:Gymnopedie_No._1..ogg', 'CC0 1.0') },
  { id: 'music-satie-gnossienne-1', kind: 'file', file: 'music-satie-gnossienne-1.mp3', title: { ru: 'Сати — Гносьенна № 1', en: 'Satie — Gnossienne No. 1' }, note: { ru: 'фортепиано, задумчиво', en: 'piano, pensive' }, source: commons('La Pianista', 'https://commons.wikimedia.org/wiki/File:Satie_-_Gnossienne_1.ogg', 'Public domain') },
  { id: 'music-chopin-op9-2', kind: 'file', file: 'music-chopin-op9-2.mp3', title: { ru: 'Шопен — Ноктюрн ми-бемоль мажор', en: 'Chopin — Nocturne in E-flat' }, note: { ru: 'фортепиано, нежно', en: 'piano, tender' }, source: commons('Peter Johnston', 'https://commons.wikimedia.org/wiki/File:Chopin_Nocturne_No._2_in_E_Flat_Major,_Op._9.ogg', 'CC0 1.0') },
  { id: 'music-chopin-op72', kind: 'file', file: 'music-chopin-op72.mp3', title: { ru: 'Шопен — Ноктюрн ми минор', en: 'Chopin — Nocturne in E minor' }, note: { ru: 'фортепиано, вечернее', en: 'piano, evening' }, source: commons('Musopen', 'https://commons.wikimedia.org/wiki/File:Chopin_Nocturne_in_Em,_Op._posth._72.ogg', 'CC0 1.0') },
  { id: 'music-chopin-21', kind: 'file', file: 'music-chopin-21.mp3', title: { ru: 'Шопен — Ноктюрн до минор', en: 'Chopin — Nocturne in C minor' }, note: { ru: 'фортепиано, для засыпания', en: 'piano, for falling asleep' }, source: commons('Diana Hughes', 'https://commons.wikimedia.org/wiki/File:Chopin_Nocturne_21_in_C_minor_Posthumous_Diana_Hughes.ogg', 'CC0 1.0') },
  { id: 'music-synth-morning', kind: 'synth', synth: 'morning', title: { ru: 'Тихое утро', en: 'Quiet morning' }, note: { ru: 'складывается заново, без интернета', en: 'composed anew, offline' } },
  { id: 'music-synth-evening', kind: 'synth', synth: 'evening', title: { ru: 'Вечерний свет', en: 'Evening light' }, note: { ru: 'складывается заново, без интернета', en: 'composed anew, offline' } },
  { id: 'music-synth-waves', kind: 'synth', synth: 'waves', title: { ru: 'Медленные волны', en: 'Slow waves' }, note: { ru: 'складывается заново, без интернета', en: 'composed anew, offline' } },
];

export function tracksOfGroup(group: SoundGroup): AmbientTrack[] {
  return AMBIENT_TRACKS.filter((track) => track.group === group);
}

export function findAmbientTrack(id: string): AmbientTrack | null {
  return AMBIENT_TRACKS.find((track) => track.id === id) ?? null;
}

export function findMusicTrack(id: string): MusicTrack | null {
  return MUSIC_TRACKS.find((track) => track.id === id) ?? null;
}

/** File names that the server may serve from public/audio/library. */
export const LIBRARY_FILES: ReadonlySet<string> = new Set([
  ...AMBIENT_TRACKS.flatMap((track) => (track.kind === 'file' ? [track.file] : [])),
  ...MUSIC_TRACKS.flatMap((track) => (track.kind === 'file' ? [track.file] : [])),
]);
