# Audio in NEBO: sources and licences

| What | Source | Licence |
|---|---|---|
| Calm sounds: rain, café, forest, sea, fireplace | Synthesized in the app at playback time (`lib/soundscapes/synth.ts`, Web Audio API). No recordings. | Own work of the NEBO project |
| Calm music: «Тихое утро», «Вечерний свет», «Медленные волны» | Generated in the app at playback time (`lib/soundscapes/synth.ts`). No samples. | Own work of the NEBO project |
| Sleep stories: «Дом у моря», «Ночной поезд через снег», «Сад после дождя» | Texts written for NEBO (`lib/sleepStories.ts`), voiced by OpenAI TTS (`gpt-4o-mini-tts`) on the server, cached in `tts_audio`. | Texts — own work; generated audio belongs to the account owner under the OpenAI terms |

## Rules for adding audio files here

- Only CC0 / public domain recordings or our own recordings.
- One row per file in the table above: file name, author, link to the source page, licence, date downloaded.
- Keep files small (mono, 96–128 kbps MP3 or AAC); long tracks are streamed and cached on the device.
