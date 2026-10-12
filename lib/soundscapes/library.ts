/**
 * The sound library of «Звуки»: real CC0 / public-domain recordings streamed
 * from the server and cached on the device, plus the synthesized sounds that
 * work offline. Sources and licences are listed in public/audio/LICENSES.md.
 */
import type { MusicPiece, Soundscape } from './synth';
import type { VideoBackgroundId } from '../videoBackgrounds';

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

export const SOUND_VIDEOS: Record<SoundGroup, VideoBackgroundId> = {
  rain: 'sounds-rain', forest: 'sounds-forest', stream: 'sounds-stream',
  sea: 'sounds-sea', fire: 'sounds-fire', cafe: 'sounds-cafe', night: 'sounds-night',
};

export const SOUND_GROUP_LABELS: Record<SoundGroup, { ru: string; en: string }> = {
  rain: { ru: 'Дождь', en: 'Rain' },
  forest: { ru: 'Лес', en: 'Forest' },
  stream: { ru: 'Ручей', en: 'Stream' },
  sea: { ru: 'Море', en: 'Sea' },
  fire: { ru: 'Костёр', en: 'Campfire' },
  cafe: { ru: 'Кафе', en: 'Café' },
  night: { ru: 'Ночь', en: 'Night' },
};

const bigSoundBank = (page: string, author = 'Joseph SARDIN'): TrackSource => ({ author, url: `https://bigsoundbank.com/${page}.html`, license: 'CC0 1.0' });

export const AMBIENT_TRACKS: readonly AmbientTrack[] = [
  { id: 'rain-roof', group: 'rain', kind: 'file', file: 'rain-roof-hq-v2.mp3', title: { ru: 'Дождь по стеклу', en: 'Rain on glass' }, source: bigSoundBank('rain-on-car-windshield-s1295') },
  { id: 'rain-drip', group: 'rain', kind: 'file', file: 'rain-drip-hq-v2.mp3', title: { ru: 'Летний дождь', en: 'Summer rain' }, source: bigSoundBank('summer-rain-on-terrace-s1019') },
  { id: 'rain-forest', group: 'rain', kind: 'file', file: 'rain-forest-hq-v2.mp3', title: { ru: 'Дождь по палатке', en: 'Rain on a tent' }, source: bigSoundBank('rain-and-storm-in-a-tent-s0820') },
  { id: 'rain-storm', group: 'rain', kind: 'file', file: 'rain-storm-hq-v2.mp3', title: { ru: 'Гроза', en: 'Thunderstorm' }, source: bigSoundBank('rain-and-storm-2-s0740') },
  { id: 'rain-synth', group: 'rain', kind: 'synth', synth: 'rain', title: { ru: 'Ровный дождь, без интернета', en: 'Even rain, offline' } },
  { id: 'forest-dawn', group: 'forest', kind: 'file', file: 'forest-dawn-hq-v2.mp3', title: { ru: 'Птицы на рассвете', en: 'Dawn chorus' }, source: bigSoundBank('birds-waking-4-s1906') },
  { id: 'forest-spring', group: 'forest', kind: 'file', file: 'forest-spring-hq-v2.mp3', title: { ru: 'Весенний лес', en: 'Spring woods' }, source: bigSoundBank('forest-2-s1348') },
  { id: 'forest-afternoon', group: 'forest', kind: 'file', file: 'forest-afternoon-hq-v2.mp3', title: { ru: 'Лес и ветер', en: 'Forest and wind' }, source: bigSoundBank('forest-4-s2749') },
  { id: 'forest-rain-birds', group: 'forest', kind: 'file', file: 'forest-rain-birds-hq-v2.mp3', title: { ru: 'На опушке леса', en: 'At the forest edge' }, source: bigSoundBank('forest-on-the-edge-s0905') },
  { id: 'forest-synth', group: 'forest', kind: 'synth', synth: 'forest', title: { ru: 'Ветер и птицы, без интернета', en: 'Wind and birds, offline' } },
  { id: 'stream-wyre', group: 'stream', kind: 'file', file: 'stream-wyre-hq-v2.mp3', title: { ru: 'Лесной ручей', en: 'Forest stream' }, source: bigSoundBank('mountain-stream-1-s2754') },
  { id: 'stream-small', group: 'stream', kind: 'file', file: 'stream-small-hq-v2.mp3', title: { ru: 'Маленький ручеёк', en: 'A small brook' }, source: bigSoundBank('small-stream-s0823') },
  { id: 'sea-calm', group: 'sea', kind: 'file', file: 'sea-calm-hq-v2.mp3', title: { ru: 'Спокойный прибой', en: 'Calm surf' }, source: bigSoundBank('small-waves-and-beach-1-s1446') },
  { id: 'sea-beach', group: 'sea', kind: 'file', file: 'sea-beach-hq-v2.mp3', title: { ru: 'Волны на пляже', en: 'Beach waves' }, source: bigSoundBank('sea-of-the-beach-of-dellec-2-s2565') },
  { id: 'sea-waves', group: 'sea', kind: 'file', file: 'sea-waves-hq-v2.mp3', title: { ru: 'Волны у камней', en: 'Waves by the rocks' }, source: bigSoundBank('small-waves-rocks-and-beach-s1445') },
  { id: 'sea-synth', group: 'sea', kind: 'synth', synth: 'sea', title: { ru: 'Медленные волны, без интернета', en: 'Slow waves, offline' } },
  { id: 'fire-campfire', group: 'fire', kind: 'file', file: 'fire-campfire-hq-v2.mp3', title: { ru: 'Костёр', en: 'Campfire' }, source: bigSoundBank('big-branching-fire-3-s0989') },
  { id: 'fire-fireplace', group: 'fire', kind: 'file', file: 'fire-fireplace-hq-v2.mp3', title: { ru: 'Камин', en: 'Fireplace' }, source: bigSoundBank('fireplace-3-s2855') },
  { id: 'fire-lit', group: 'fire', kind: 'file', file: 'fire-lit-hq-v2.mp3', title: { ru: 'Потрескивание дров', en: 'Crackling logs' }, source: bigSoundBank('fireplace-4-s2856') },
  { id: 'fire-synth', group: 'fire', kind: 'synth', synth: 'fire', title: { ru: 'Огонь, без интернета', en: 'Fire, offline' } },
  { id: 'cafe-coffee', group: 'cafe', kind: 'file', file: 'cafe-coffee-hq-v2.mp3', title: { ru: 'Кофейня', en: 'Coffee shop' }, source: bigSoundBank('atmosphere-bar-2-s0480', 'DavidGreck') },
  { id: 'cafe-chatter', group: 'cafe', kind: 'file', file: 'cafe-chatter-hq-v2.mp3', title: { ru: 'Разговоры за столиками', en: 'Table chatter' }, source: bigSoundBank('small-restaurant-conversations-s3542', 'Joseph SARDIN & Axeline T.') },
  { id: 'cafe-synth', group: 'cafe', kind: 'synth', synth: 'cafe', title: { ru: 'Гул кафе, без интернета', en: 'Café hum, offline' } },
  { id: 'night-porch', group: 'night', kind: 'file', file: 'night-porch-hq-v2.mp3', title: { ru: 'Ночь со сверчками', en: 'Night with crickets' }, source: bigSoundBank('campaign-at-night-4-s1880') },
  { id: 'night-crickets', group: 'night', kind: 'file', file: 'night-crickets-hq-v2.mp3', title: { ru: 'Вечерние птицы', en: 'Evening birds' }, source: bigSoundBank('evening-birds-s1859') },
];

const commons = (author: string, page: string, license: TrackSource['license']): TrackSource => ({ author, url: page, license });

export const MUSIC_TRACKS: readonly MusicTrack[] = [
  { id: 'music-satie-gymnopedie-1', kind: 'file', file: 'music-satie-gymnopedie-1.mp3', title: { ru: 'Сати, Гимнопедия № 1', en: 'Satie, Gymnopédie No. 1' }, note: { ru: 'фортепиано, очень спокойно', en: 'piano, very calm' }, source: commons('Teknopazzo', 'https://commons.wikimedia.org/wiki/File:Gymnopedie_No._1..ogg', 'CC0 1.0') },
  { id: 'music-satie-gnossienne-1', kind: 'file', file: 'music-satie-gnossienne-1.mp3', title: { ru: 'Сати, Гносьенна № 1', en: 'Satie, Gnossienne No. 1' }, note: { ru: 'фортепиано, задумчиво', en: 'piano, pensive' }, source: commons('La Pianista', 'https://commons.wikimedia.org/wiki/File:Satie_-_Gnossienne_1.ogg', 'Public domain') },
  { id: 'music-chopin-op9-2', kind: 'file', file: 'music-chopin-op9-2.mp3', title: { ru: 'Шопен, Ноктюрн ми-бемоль мажор', en: 'Chopin, Nocturne in E-flat' }, note: { ru: 'фортепиано, нежно', en: 'piano, tender' }, source: commons('Peter Johnston', 'https://commons.wikimedia.org/wiki/File:Chopin_Nocturne_No._2_in_E_Flat_Major,_Op._9.ogg', 'CC0 1.0') },
  { id: 'music-chopin-op72', kind: 'file', file: 'music-chopin-op72.mp3', title: { ru: 'Шопен, Ноктюрн ми минор', en: 'Chopin, Nocturne in E minor' }, note: { ru: 'фортепиано, вечернее', en: 'piano, evening' }, source: commons('Musopen', 'https://commons.wikimedia.org/wiki/File:Chopin_Nocturne_in_Em,_Op._posth._72.ogg', 'CC0 1.0') },
  { id: 'music-chopin-21', kind: 'file', file: 'music-chopin-21.mp3', title: { ru: 'Шопен, Ноктюрн до минор', en: 'Chopin, Nocturne in C minor' }, note: { ru: 'фортепиано, для засыпания', en: 'piano, for falling asleep' }, source: commons('Diana Hughes', 'https://commons.wikimedia.org/wiki/File:Chopin_Nocturne_21_in_C_minor_Posthumous_Diana_Hughes.ogg', 'CC0 1.0') },
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

/** Installed clients can still request the previous names without retaining old assets. */
export const LEGACY_AMBIENT_FILES: ReadonlyMap<string, string> = new Map(
  AMBIENT_TRACKS.flatMap((track) => track.kind === 'file' ? [[`${track.id}.mp3`, track.file] as const] : []),
);

export function resolveLibraryFile(name: string): string | null {
  return LIBRARY_FILES.has(name) ? name : LEGACY_AMBIENT_FILES.get(name) ?? null;
}
