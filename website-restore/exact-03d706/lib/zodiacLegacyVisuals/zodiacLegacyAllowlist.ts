export const ZODIAC_LEGACY_CATEGORIES = [
  'psychedelic',
  'funny-animal',
] as const;

export type ZodiacLegacyCategory = (typeof ZODIAC_LEGACY_CATEGORIES)[number];

export type ZodiacLegacyAllowlistEntry = {
  id: `main-humor-${string}`;
  fileName: `main-humor-${string}.webp`;
  category: ZodiacLegacyCategory;
};

/**
 * Manually reviewed, intentionally small subset of the retired newspaper
 * library. This is the only legacy allowlist used by the application or its
 * manifest generator. Entries are explicit so a folder name, keyword search,
 * or catalog regex can never expand the Zodiac pool.
 */
export const ZODIAC_LEGACY_ALLOWLIST = [
  { id: 'main-humor-002', fileName: 'main-humor-002-groza-v-prachechnoi.webp', category: 'psychedelic' },
  { id: 'main-humor-003', fileName: 'main-humor-003-lift-na-ulitsu.webp', category: 'psychedelic' },
  { id: 'main-humor-004', fileName: 'main-humor-004-avtobus-vyraschivaet-ostanovku.webp', category: 'psychedelic' },
  { id: 'main-humor-017', fileName: 'main-humor-017-shkaf-s-zapasnym-letom.webp', category: 'psychedelic' },
  { id: 'main-humor-022', fileName: 'main-humor-022-alarm-clock-chases-train.webp', category: 'psychedelic' },
  { id: 'main-humor-026', fileName: 'main-humor-026-tramvai-vyazhet-marshrut.webp', category: 'psychedelic' },
  { id: 'main-humor-029', fileName: 'main-humor-029-taksi-vezet-sobstvennuyu-kryshu.webp', category: 'psychedelic' },
  { id: 'main-humor-037', fileName: 'main-humor-037-metro-vyraschivaet-vetki.webp', category: 'psychedelic' },
  { id: 'main-humor-041', fileName: 'main-humor-041-kater-vezet-perekrestok.webp', category: 'psychedelic' },
  { id: 'main-humor-043', fileName: 'main-humor-043-koleso-obozreniya-sbezhalo.webp', category: 'psychedelic' },
  { id: 'main-humor-047', fileName: 'main-humor-047-samolet-zhdet-zelenyi.webp', category: 'psychedelic' },
  { id: 'main-humor-077', fileName: 'main-humor-077-derevo-menyaet-sezon.webp', category: 'psychedelic' },
  { id: 'main-humor-078', fileName: 'main-humor-078-luna-sushitsya-na-verevke.webp', category: 'psychedelic' },
  { id: 'main-humor-089', fileName: 'main-humor-089-vodopad-idet-v-kran.webp', category: 'psychedelic' },
  { id: 'main-humor-093', fileName: 'main-humor-093-pole-zastegnuto-na-molniyu.webp', category: 'psychedelic' },
  { id: 'main-humor-105', fileName: 'main-humor-105-kapusta-hranit-arhiv.webp', category: 'psychedelic' },
  { id: 'main-humor-121', fileName: 'main-humor-121-tort-sdaet-etazhi.webp', category: 'psychedelic' },
  { id: 'main-humor-147', fileName: 'main-humor-147-kinoekran-smotrit-zal.webp', category: 'psychedelic' },
  { id: 'main-humor-215', fileName: 'main-humor-215-bridge-folds-like-accordion.webp', category: 'psychedelic' },
  { id: 'main-humor-218', fileName: 'main-humor-218-cinema-screen-opens-to-sea.webp', category: 'psychedelic' },
  { id: 'main-humor-243', fileName: 'main-humor-243-tunnel-returns-upside-down-square.webp', category: 'psychedelic' },
  { id: 'main-humor-244', fileName: 'main-humor-244-roundabout-becomes-record-player.webp', category: 'psychedelic' },
  { id: 'main-humor-269', fileName: 'main-humor-269-lampshade-projects-midnight-daylight.webp', category: 'psychedelic' },
  { id: 'main-humor-299', fileName: 'main-humor-299-doorways-stack-vertical-street.webp', category: 'psychedelic' },

  { id: 'main-humor-051', fileName: 'main-humor-051-golubi-provodyat-soveschanie.webp', category: 'funny-animal' },
  { id: 'main-humor-052', fileName: 'main-humor-052-station-cat-checks-map.webp', category: 'funny-animal' },
  { id: 'main-humor-054', fileName: 'main-humor-054-loshad-zvonit-v-domofon.webp', category: 'funny-animal' },
  { id: 'main-humor-059', fileName: 'main-humor-059-krolik-reguliruet-dvizhenie.webp', category: 'funny-animal' },
  { id: 'main-humor-060', fileName: 'main-humor-060-bear-cinema-ticket.webp', category: 'funny-animal' },
  { id: 'main-humor-063', fileName: 'main-humor-063-ezh-perevozit-oblako.webp', category: 'funny-animal' },
  { id: 'main-humor-065', fileName: 'main-humor-065-lisa-menyaet-vyveski.webp', category: 'funny-animal' },
  { id: 'main-humor-066', fileName: 'main-humor-066-octopus-eight-radios.webp', category: 'funny-animal' },
  { id: 'main-humor-068', fileName: 'main-humor-068-cash-register-orchestra-pelican.webp', category: 'funny-animal' },
  { id: 'main-humor-069', fileName: 'main-humor-069-sova-chinit-polden.webp', category: 'funny-animal' },
  { id: 'main-humor-070', fileName: 'main-humor-070-pes-vozvraschaet-hozyaina.webp', category: 'funny-animal' },
  { id: 'main-humor-073', fileName: 'main-humor-073-petuh-vyklyuchaet-rassvet.webp', category: 'funny-animal' },
  { id: 'main-humor-075', fileName: 'main-humor-075-bobr-perekryvaet-ofis.webp', category: 'funny-animal' },
  { id: 'main-humor-152', fileName: 'main-humor-152-raccoon-sorts-umbrellas-by-weather.webp', category: 'funny-animal' },
  { id: 'main-humor-156', fileName: 'main-humor-156-donkey-tunes-hay-radio.webp', category: 'funny-animal' },
  { id: 'main-humor-157', fileName: 'main-humor-157-llamas-queue-at-photo-booth.webp', category: 'funny-animal' },
  { id: 'main-humor-158', fileName: 'main-humor-158-frogs-conduct-fountain-jets.webp', category: 'funny-animal' },
  { id: 'main-humor-166', fileName: 'main-humor-166-hedgehog-orders-cafe-cups.webp', category: 'funny-animal' },
  { id: 'main-humor-170', fileName: 'main-humor-170-sheep-reserve-bus-seats.webp', category: 'funny-animal' },
  { id: 'main-humor-173', fileName: 'main-humor-173-boar-chooses-records.webp', category: 'funny-animal' },
  { id: 'main-humor-181', fileName: 'main-humor-181-lemur-operates-photo-booth.webp', category: 'funny-animal' },
  { id: 'main-humor-196', fileName: 'main-humor-196-monkeys-hold-banana-council.webp', category: 'funny-animal' },
  { id: 'main-humor-205', fileName: 'main-humor-205-hamster-turns-ferris-clock.webp', category: 'funny-animal' },
  { id: 'main-humor-311', fileName: 'main-humor-311-capybaras-host-tea-timetable.webp', category: 'funny-animal' },
] as const satisfies readonly ZodiacLegacyAllowlistEntry[];
