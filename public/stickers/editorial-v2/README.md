# Editorial sticker library v2

Подготовленная app-ready библиотека стикеров для приложения «Твой Гороскоп».
`manifest.json` подключён к deterministic Today visual engine через
`lib/personalForecastVisuals/editorialV2Manifest.ts`. Старые 895 утверждённых
ассетов сохранены; библиотека добавляет 195 non-brand visual entries и 19 пустых
paper templates. В generic Today auto-selection входят 142 text-free visuals;
53 assets со встроенной надписью сохранены, но ждут per-asset locale/copy metadata.
Ещё 7 файлов остаются на диске, но исключены из production selection до ручной
коммерческой проверки.

## Итог обработки

- Исходных листов просмотрено: **10**.
- Самостоятельных кандидатов найдено: **278**.
- Дубликатов отбраковано: **44**.
- Кандидатов отбраковано по качеству: **13**.
- Уникальных app-ready ассетов: **221**.
- Lossless PNG masters: **221**, `21 418 588` байт (**20.43 MiB**).
- App-ready WebP: **221**, `5 943 258` байт (**5.67 MiB**).
- Средний app-ready файл: `26 893` байта (**26.26 KiB**).

## Категории

| Category | Count |
| --- | ---: |
| animals | 3 |
| mascots | 48 |
| objects | 26 |
| food_drink | 11 |
| paper_templates | 19 |
| tape | 8 |
| clips_pins | 6 |
| doodles | 36 |
| newspaper | 3 |
| funny | 1 |
| surreal | 8 |
| psychedelic | 3 |
| graphic | 11 |
| fixed_text | 38 |

## Файлы и качество

- App-ready: `public/stickers/editorial-v2/<category>/*.webp`.
- Runtime URL в manifest начинается с `/stickers/editorial-v2/`.
- Masters (локально, вне Git): `tmp/newspaper-alpha/editorial-v2/masters/<category>/*.png`.
- QA-листы (локально, вне Git): `tmp/qa-sticker-review/editorial-v2/final/`.
- WebP сохранён с прозрачным alpha, quality `94`, без увеличения исходников; большая сторона ограничена `1400 px`.
- Каждый asset имеет минимум `16 px` прозрачного safe padding со всех сторон.
- Все 221 результата просмотрены на белом, чёрном и цветном фоне.
- Автоматическая приёмка подтвердила 221/221 alpha-assets, прозрачные края, совпадение размеров с manifest и отсутствие exact/near дублей по контрольным hash-проверкам.

## Manifest

`manifest.json` содержит для каждого asset:

- `id`, `path`, `category`, `tags`;
- `width`, `height`, `aspectRatio`, `orientation`;
- `tone`, `topics`, `visualWeight`, `rarity`;
- `hasEmbeddedText`;
- опциональные `productionSelectable` и `reviewReason` для временного
  исключения без удаления файла;
- ссылку на исходный лист и контрольные hashes.

Для `paper_templates` дополнительно записаны:

- `safeTextArea` — нормализованные координаты `[left, top, right, bottom]`;
- `paperTone`, `format`, `textLength`;
- `hasTape`, `hasClip`, `hasPin`, `canRotate`.

`paper_templates` содержит только элементы, на которые приложение может наложить доступный живой текст. Картинки с уже нарисованной надписью находятся в `fixed_text` или `newspaper` и имеют `hasEmbeddedText: true`.

## Самые тяжёлые app-ready файлы

| Asset | Bytes | KiB |
| --- | ---: | ---: |
| `mascot_capybara_orange_calm_speech_01.webp` | 88 030 | 85.97 |
| `object_plant_books_coffee_set_01.webp` | 77 584 | 75.77 |
| `mascot_raccoon_eating_pizza_01.webp` | 77 362 | 75.55 |
| `mascot_cat_orange_sunglasses_lounging_01.webp` | 69 658 | 68.03 |
| `mascot_cat_orange_chair_coffee_01.webp` | 64 794 | 63.28 |

## Кандидаты, не выпущенные из-за качества

Эти исходные элементы перекрывались соседними стикерами или были слишком неоднозначными для честного восстановления. Они не дорисовывались и не попали в библиотеку из соответствующего исходного места:

- Sheet 1: `take_break_breathe_blue`.
- Sheet 2: `heart_pink_double_line`.
- Sheet 3: `cat_orange_sunglasses_reclining`, `live_by_your_rules_heart`.
- Sheet 4: `small_steps_big_changes_lined`, `cat_pool_float_drink`, `dinosaur_sunglasses_green`, `dog_backwards_cap_happy`, `polaroid_tropical_beach`.
- Sheet 6: `star_pink_outline`, `frog_flamingo_laptop`.
- Sheet 9: `goose_sunglasses_gold_chain`.
- Sheet 10: `envelope_heart_black`.

Если тот же объект присутствовал на другом листе в чистом виде, в библиотеке оставлен лучший чистый вариант.

## Требуют ручного коммерческого просмотра

Маски и alpha у этих файлов корректны, но в изображении заметны брендоподобные знаки. Перед коммерческим релизом желательно отдельно подтвердить их использование:

Все семь помечены в manifest как `productionSelectable: false` с
`reviewReason: "brand_like_marks"`; runtime adapter отфильтровывает их до
ручного решения.

- `objects/object_camera_retro_black_silver_01.webp`;
- `objects/object_camera_retro_silver_01.webp`;
- `objects/object_instant_camera_retro_sunset_01.webp`;
- `objects/object_laptop_dream_job_notes_01.webp`;
- `objects/object_laptop_silver_01.webp`;
- `objects/object_sneaker_white_single_01.webp`;
- `objects/object_sneakers_gray_pair_01.webp`.
