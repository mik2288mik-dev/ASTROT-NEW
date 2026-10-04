# Audio in NEBO: sources and licences

All audio in NEBO is either our own work or free of copyright (CC0 1.0 / public domain). No attribution is legally required for these licences; authors are credited here anyway.

## Recordings in `public/audio/library/`

Streamed by `/api/audio/library/<file>`, cached on the device after the first play, excluded from the APK by `scripts/build-mobile.mjs`. Processed for the app: mono, 32 kHz / 64 kbps (sounds, trimmed to a seamless loop of up to 3 minutes with a 4-second crossfade) or 44.1 kHz / 96 kbps (music), loudness levelled.

| File | In the app | Author | Source | Licence |
|---|---|---|---|---|
| `rain-roof.mp3` | Дождь по мансардному окну | Metadex | https://freesound.org/people/Metadex/sounds/235827/ | CC0 1.0 |
| `rain-drip.mp3` | Тихая капель | florianreichelt | https://freesound.org/people/florianreichelt/sounds/459983/ | CC0 1.0 |
| `rain-forest.mp3` | Дождь в тропическом лесу | INNORECORDS | https://freesound.org/people/INNORECORDS/sounds/457447/ | CC0 1.0 |
| `rain-storm.mp3` | Гроза | regosss | https://freesound.org/people/regosss/sounds/238295/ | CC0 1.0 |
| `forest-dawn.mp3` | Птицы на рассвете | squashy555 | https://freesound.org/people/squashy555/sounds/573080/ | CC0 1.0 |
| `forest-spring.mp3` | Весенний лес | BurghRecords | https://freesound.org/people/BurghRecords/sounds/463903/ | CC0 1.0 |
| `forest-afternoon.mp3` | Лес после обеда | bajko | https://freesound.org/people/bajko/sounds/385280/ | CC0 1.0 |
| `forest-rain-birds.mp3` | Птицы под дождём | BurghRecords | https://freesound.org/people/BurghRecords/sounds/521360/ | CC0 1.0 |
| `stream-wyre.mp3` | Лесной ручей | turbostream | https://freesound.org/people/turbostream/sounds/220528/ | CC0 1.0 |
| `stream-small.mp3` | Маленький ручеёк | Yuval | https://freesound.org/people/Yuval/sounds/197023/ | CC0 1.0 |
| `sea-calm.mp3` | Спокойный прибой | craiggroshek | https://freesound.org/people/craiggroshek/sounds/176617/ | CC0 1.0 |
| `sea-beach.mp3` | Волны на пляже | DylanTheFish | https://freesound.org/people/DylanTheFish/sounds/463250/ | CC0 1.0 |
| `sea-waves.mp3` | Морские волны | haldigital97 | https://freesound.org/people/haldigital97/sounds/241824/ | CC0 1.0 |
| `fire-fireplace.mp3` | Камин | martats | https://freesound.org/people/martats/sounds/138018/ | CC0 1.0 |
| `fire-campfire.mp3` | Костёр | Spandau | https://freesound.org/people/Spandau/sounds/40699/ | CC0 1.0 |
| `fire-lit.mp3` | Потрескивание дров | lurpsis | https://freesound.org/people/lurpsis/sounds/444127/ | CC0 1.0 |
| `cafe-coffee.mp3` | Кофейня | waweee | https://freesound.org/people/waweee/sounds/370973/ | CC0 1.0 |
| `cafe-chatter.mp3` | Разговоры за столиками | oliverbrotzman | https://freesound.org/people/oliverbrotzman/sounds/125247/ | CC0 1.0 |
| `night-porch.mp3` | Сверчки у крыльца | hdfreema | https://freesound.org/people/hdfreema/sounds/333221/ | CC0 1.0 |
| `night-crickets.mp3` | Летняя ночь | Defelozedd94 | https://freesound.org/people/Defelozedd94/sounds/522299/ | CC0 1.0 |
| `music-satie-gymnopedie-1.mp3` | Сати — Гимнопедия № 1 | Teknopazzo | https://commons.wikimedia.org/wiki/File:Gymnopedie_No._1..ogg | CC0 1.0 |
| `music-satie-gnossienne-1.mp3` | Сати — Гносьенна № 1 | La Pianista | https://commons.wikimedia.org/wiki/File:Satie_-_Gnossienne_1.ogg | Public domain |
| `music-chopin-op9-2.mp3` | Шопен — Ноктюрн ми-бемоль мажор | Peter Johnston | https://commons.wikimedia.org/wiki/File:Chopin_Nocturne_No._2_in_E_Flat_Major,_Op._9.ogg | CC0 1.0 |
| `music-chopin-op72.mp3` | Шопен — Ноктюрн ми минор | Musopen | https://commons.wikimedia.org/wiki/File:Chopin_Nocturne_in_Em,_Op._posth._72.ogg | CC0 1.0 |
| `music-chopin-21.mp3` | Шопен — Ноктюрн до минор | Diana Hughes | https://commons.wikimedia.org/wiki/File:Chopin_Nocturne_21_in_C_minor_Posthumous_Diana_Hughes.ogg | CC0 1.0 |

## Made in the app

| What | Source | Licence |
|---|---|---|
| Offline sounds: rain, forest, sea, fireplace, café | Synthesized at playback time (`lib/soundscapes/synth.ts`, Web Audio API) | Own work of the NEBO project |
| Generative music: «Тихое утро», «Вечерний свет», «Медленные волны» | Generated at playback time (`lib/soundscapes/synth.ts`) | Own work of the NEBO project |
| Sleep stories | Texts written for NEBO (`lib/sleepStories.ts`), voiced by OpenAI TTS and cached in `tts_audio` | Texts — own work; generated audio belongs to the account owner under the OpenAI terms |

## Adding audio

- Only CC0 / public-domain recordings or our own recordings.
- Add the file to `lib/soundscapes/library.ts` with its author, source page and licence, and a row to the table above.
