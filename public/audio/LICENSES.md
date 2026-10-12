# Audio in NEBO: sources and licences

All audio in NEBO is either our own work or free of copyright (CC0 1.0 / public domain). No attribution is legally required for these licences; authors are credited here anyway.

## Recordings in `public/audio/library/`

Streamed by `/api/audio/library/<file>` and excluded from the APK by `scripts/build-mobile.mjs`. Ambient recordings are encoded once from the original lossless BigSoundBank WAV files, at 48 kHz with MP3 VBR quality 0, preserving the original channels (18 stereo and two mono). Loops are up to four minutes, with a four-second circular crossfade and static gain; no dynamic compression or artificial stereo. BigSoundBank releases these sources under CC0 1.0: https://bigsoundbank.com/licenses.html . Music remains at 44.1 kHz / 96 kbps.

New ambient filenames prevent reuse of old immutable downloads. Older API filenames resolve to the replacements. The offline ambient cache holds at most eight recordings / 64 MiB and removes the previous ambient copies; existing music downloads remain available.

| File | In the app | Author | Source | Licence |
|---|---|---|---|---|
| `rain-roof-hq-v2.mp3` | Дождь по стеклу | Joseph SARDIN | https://bigsoundbank.com/rain-on-car-windshield-s1295.html | CC0 1.0 |
| `rain-drip-hq-v2.mp3` | Летний дождь | Joseph SARDIN | https://bigsoundbank.com/summer-rain-on-terrace-s1019.html | CC0 1.0 |
| `rain-forest-hq-v2.mp3` | Дождь по палатке | Joseph SARDIN | https://bigsoundbank.com/rain-and-storm-in-a-tent-s0820.html | CC0 1.0 |
| `rain-storm-hq-v2.mp3` | Гроза | Joseph SARDIN | https://bigsoundbank.com/rain-and-storm-2-s0740.html | CC0 1.0 |
| `forest-dawn-hq-v2.mp3` | Птицы на рассвете | Joseph SARDIN | https://bigsoundbank.com/birds-waking-4-s1906.html | CC0 1.0 |
| `forest-spring-hq-v2.mp3` | Весенний лес | Joseph SARDIN | https://bigsoundbank.com/forest-2-s1348.html | CC0 1.0 |
| `forest-afternoon-hq-v2.mp3` | Лес и ветер | Joseph SARDIN | https://bigsoundbank.com/forest-4-s2749.html | CC0 1.0 |
| `forest-rain-birds-hq-v2.mp3` | На опушке леса | Joseph SARDIN | https://bigsoundbank.com/forest-on-the-edge-s0905.html | CC0 1.0 |
| `stream-wyre-hq-v2.mp3` | Лесной ручей | Joseph SARDIN | https://bigsoundbank.com/mountain-stream-1-s2754.html | CC0 1.0 |
| `stream-small-hq-v2.mp3` | Маленький ручеёк | Joseph SARDIN | https://bigsoundbank.com/small-stream-s0823.html | CC0 1.0 |
| `sea-calm-hq-v2.mp3` | Спокойный прибой | Joseph SARDIN | https://bigsoundbank.com/small-waves-and-beach-1-s1446.html | CC0 1.0 |
| `sea-beach-hq-v2.mp3` | Волны на пляже | Joseph SARDIN | https://bigsoundbank.com/sea-of-the-beach-of-dellec-2-s2565.html | CC0 1.0 |
| `sea-waves-hq-v2.mp3` | Волны у камней | Joseph SARDIN | https://bigsoundbank.com/small-waves-rocks-and-beach-s1445.html | CC0 1.0 |
| `fire-campfire-hq-v2.mp3` | Костёр | Joseph SARDIN | https://bigsoundbank.com/big-branching-fire-3-s0989.html | CC0 1.0 |
| `fire-fireplace-hq-v2.mp3` | Камин | Joseph SARDIN | https://bigsoundbank.com/fireplace-3-s2855.html | CC0 1.0 |
| `fire-lit-hq-v2.mp3` | Потрескивание дров | Joseph SARDIN | https://bigsoundbank.com/fireplace-4-s2856.html | CC0 1.0 |
| `cafe-coffee-hq-v2.mp3` | Кофейня | DavidGreck | https://bigsoundbank.com/atmosphere-bar-2-s0480.html | CC0 1.0 |
| `cafe-chatter-hq-v2.mp3` | Разговоры за столиками | Joseph SARDIN & Axeline T. | https://bigsoundbank.com/small-restaurant-conversations-s3542.html | CC0 1.0 |
| `night-porch-hq-v2.mp3` | Ночь со сверчками | Joseph SARDIN | https://bigsoundbank.com/campaign-at-night-4-s1880.html | CC0 1.0 |
| `night-crickets-hq-v2.mp3` | Вечерние птицы | Joseph SARDIN | https://bigsoundbank.com/evening-birds-s1859.html | CC0 1.0 |
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

## Recorded stories in `server-assets/audio/stories/`

LibriVox 128 kbps MP3 recordings with the service introductions and end
announcements removed by copying the original MP3 packets, without additional
lossy encoding. Spoken titles, story text and collection footnotes are retained.
Durations in `lib/recordedSleepStories.ts` match the edited recordings. These
files are outside `public/` and the mobile export. `/api/audio/listen` checks
Premium before issuing an opaque playback ticket for `/api/audio/file/<id>.mp3`.
The Docker server image includes the private directory explicitly.

LibriVox dedicates its recordings to the public domain:
https://librivox.org/pages/public-domain/ . Its guarantee is for the USA; other
countries' copyright rules still apply. The source texts here are Danilevsky
(1829–1890), Afanasyev's 1860s collection (1826–1871), and the Japanese tales
translated by Aleksandr Fyodorov-Davydov (1875–1936). Each selected chapter has
one reader. The recordings remain in Russian in either interface language.

| File | Reading | Reader | Access | Original source |
|---|---|---|---|---|
| `librivox-steppe.mp3` | Степь | Anastasiia Solokha | Free | https://archive.org/download/stepnyyeskazki_2204_librivox/stepnyyeskazki_01_danilevsky_128kb.mp3 |
| `librivox-wonder-teapot.mp3` | Диковинный чайник | Anastasiia Solokha | Premium | https://archive.org/download/yaponskienarodnyeskazki_1607_librivox/yaponskienarodnyeskazki_07_fyodorov-davydov_128kb.mp3 |
| `librivox-japanese-children.mp3` | Японские дети | Anastasiia Solokha | Premium | https://archive.org/download/yaponskienarodnyeskazki_1607_librivox/yaponskienarodnyeskazki_09_fyodorov-davydov_128kb.mp3 |
| `librivox-frog-princess.mp3` | Царевна-лягушка | Лена Сухая | Free | https://archive.org/download/russianfairytales2_2103_librivox/russianfairytales2_23_afanasyev_128kb.mp3 |
| `librivox-mouse-house.mp3` | Теремок мышки | Лена Сухая | Free | https://archive.org/download/russianfairytales3_2412_librivox/russianfairytales3_16_afanasyev_128kb.mp3 |
| `librivox-ivan-the-fool.mp3` | Иван-дурак | Лена Сухая | Premium | https://archive.org/download/russianfairytales2_2103_librivox/russianfairytales2_06_afanasyev_128kb.mp3 |

## Adding audio

- Only CC0 / public-domain recordings or our own recordings.
- Add the file to `lib/soundscapes/library.ts` with its author, source page and licence, and a row to the table above.
