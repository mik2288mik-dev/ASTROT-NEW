# Реестр стикеров «Твой Гороскоп»

83 стикера (фотореалистичные кот и капибара в худи/комбинезонах с патчем «Your Horoscope»; из первичных 110 отобрано вручную — 27 удалено). Формат: **WebP, 1254×1254, настоящий прозрачный фон (вырезано)**, качество q95. Общий вес ~19 МБ.

> Исходники были RGB с впечатанной «псевдопрозрачной» шахматкой (без альфы). Фон удалён программно (см. [раздел о вырезке](#вырезка-фона--качество)), исходные PNG сохранены в `Downloads/asset_stiker`.

> **Стикеры-предметы** (24 девайса/аксессуара, не маскоты) вынесены в подпапку `objects/` — см. [`objects/OBJECTS_REGISTRY.md`](objects/OBJECTS_REGISTRY.md).

> **Runtime «Дневника»:** все 83 отобранных маскота входят в общий детерминированный пул визуальных пауз. Выбор учитывает скрытый контекст текста, исключает повторы внутри прогноза и не зависит от генерации Luna.

## Схема имени

`животное_образ_поза_настроение` — латиница, нижний регистр, через `_`.

- **животное:** `cat` (кот), `capy` (капибара)
- **образ:** предмет/атрибут в кадре (свободный словарь — `hoodie`, `coffee`, `gift`, `gamepad`, `flashlight`, `tablet`, …)
- **поза (строгий словарь):** `pawup` `pawdown` `wave` `sit` `run` `peek` `stand` `point`
- **настроение (строгий словарь):** `happy` `calm` `hype` `thinking` `cheer` `chill` `surprise`

> Позы и настроения взяты **только** из строгих списков. Где реальная поза/эмоция не попадала в список точно — выбран ближайший тег, такие случаи вынесены в раздел [«Приближения»](#приближения-позанастроение). `pawdown` в наборе не встретился ни разу.

---

## Вырезка фона / качество

Фон удалён автоматически: заливка прозрачности от краёв кадра по светлому низконасыщенному фону (шахматка/белый + мягкая тень) + морфологическое «закрытие» (r=2) для сглаживания краёв и мелких вторжений. Результат — WebP q95 с альфой, 1254×1254.

**Качество вырезки — чисто.** Битый экземпляр (`capy_soccer_stand_happy`, «выеденная» белая джерси) удалён при ручном отборе. Осталась одна мелочь:

- **Микро-крапинки на ярко-белых кроссовках** у `cat_skate_pawup_hype` (почти не видно на размере стикера, заметно только при сильном зуме). Остальные «крапчатые» экземпляры удалены при отборе.

Прочее: тонкие светлые усы, уходящие в фон, местами подрезаются (для стикера обычно даже чище). Тонкие структуры (сетка ракетки, нить гирлянды, дужки наушников) сохранены.

---

## Коты (`cat_*`) — 45 шт.

| Файл | образ | поза | настроение | исходник |
|---|---|---|---|---|
| cat_beanie_wave_hype.webp | beanie | wave | hype | 02_21_31 (2) |
| cat_bottle_peek_surprise.webp | bottle | peek | surprise | 01_51_08 (3) |
| cat_clipboard_stand_calm.webp | clipboard | stand | calm | 02_19_31 (4) |
| cat_clipboard_stand_thinking.webp | clipboard | stand | thinking | 02_19_00 (3) |
| cat_coffee_sit_calm.webp | coffee | sit | calm | 02_21_54 (1) |
| cat_console_sit_hype.webp | console | sit | hype | 02_21_56 (3) |
| cat_cookie_pawup_hype.webp | cookie | pawup | hype | 02_19_00 (2) |
| cat_cookie_point_hype.webp | cookie | point | hype | 02_18_48 (3) |
| cat_duck_run_happy.webp | duck | run | happy | 02_18_49 (4) |
| cat_duck_stand_happy.webp | duck | stand | happy | 02_18_59 (1) |
| cat_gameboy_sit_hype.webp | gameboy | sit | hype | 02_22_26 (1) |
| cat_gift_peek_happy.webp | gift | peek | happy | 02_21_09 (2) |
| cat_gift_peek_hype.webp | gift | peek | hype | 02_21_32 (4) |
| cat_gift_stand_calm.webp | gift | stand | calm | 02_20_41 (4) |
| cat_gift_stand_happy.webp | gift | stand | happy | 02_20_09 (7) |
| cat_gift_stand_hype.webp | gift | stand | hype | 02_20_58 (7) |
| cat_giftbox_stand_hype.webp | giftbox | stand | hype | 02_22_26 (2) |
| cat_heart_sit_happy.webp | heart | sit | happy | 00_49_28 (3) |
| cat_heart_stand_happy.webp | heart | stand | happy | 02_20_54 (1) |
| cat_hoodie_pawup_happy.webp | hoodie | pawup | happy | 00_49_27 (1) |
| cat_hoodie_peek_calm.webp | hoodie | peek | calm | 02_21_44 (3) |
| cat_hoodie_peek_chill.webp | hoodie | peek | chill | 02_21_44 (4) |
| cat_hoodie_peek_happy.webp | hoodie | peek | happy | 02_21_08 (1) |
| cat_hoodie_peek_hype.webp | hoodie | peek | hype | 02_21_30 (1) |
| cat_hoodie_peek_surprise.webp | hoodie | peek | surprise | 02_21_43 (1) |
| cat_hoodie_wave_hype.webp | hoodie | wave | hype | 02_21_43 (2) |
| cat_key_stand_calm.webp | key | stand | calm | 02_20_08 (5) |
| cat_lantern_pawup_calm.webp | lantern | pawup | calm | 02_19_31 (2) |
| cat_lantern_stand_happy.webp | lantern | stand | happy | 02_19_12 (1) |
| cat_laptop_point_hype.webp | laptop | point | hype | 02_20_55 (3) |
| cat_laptop_sit_calm.webp | laptop | sit | calm | 02_22_26 (4) |
| cat_letter_stand_happy.webp | letter | stand | happy | 02_19_51 (2) |
| cat_notebook_peek_calm.webp | notebook | peek | calm | 02_21_32 (3) |
| cat_notebook_peek_thinking.webp | notebook | peek | thinking | 02_21_10 (4) |
| cat_notebook_sit_calm.webp | notebook | sit | calm | 02_21_57 (4) |
| cat_phone_pawup_happy.webp | phone | pawup | happy | 02_20_39 (1) |
| cat_phone_peek_calm.webp | phone | peek | calm | 02_21_10 (3) |
| cat_phone_wave_happy.webp | phone | wave | happy | 02_20_07 (1) |
| cat_planner_sit_calm.webp | planner | sit | calm | 02_22_26 (3) |
| cat_plant_pawup_happy.webp | plant | pawup | happy | 02_19_31 (3) |
| cat_plant_pawup_hype.webp | plant | pawup | hype | 02_19_13 (2) |
| cat_present_stand_hype.webp | present | stand | hype | 02_21_54 (2) |
| cat_skate_pawup_hype.webp | skate | pawup | hype | 01_51_08 (4) |
| cat_umbrella_pawup_happy.webp | umbrella | pawup | happy | 02_20_40 (3) |
| cat_umbrella_run_happy.webp | umbrella | run | happy | 02_20_08 (3) |

## Капибары (`capy_*`) — 38 шт.

| Файл | образ | поза | настроение | исходник |
|---|---|---|---|---|
| capy_basketball_point_chill.webp | basketball | point | chill | 01_51_09 (8) |
| capy_book_sit_calm.webp | book | sit | calm | 02_22_26 (5) |
| capy_bubbletea_sit_calm.webp | bubbletea | sit | calm | 02_20_07 (2) |
| capy_calendar_run_happy.webp | calendar | run | happy | 02_19_52 (6) |
| capy_cocoa_sit_calm.webp | cocoa | sit | calm | 02_21_11 (5) |
| capy_coffee_sit_calm.webp | coffee | sit | calm | 00_49_28 (4) |
| capy_coffee_sit_chill.webp | coffee | sit | chill | 02_20_09 (8) |
| capy_compass_run_calm.webp | compass | run | calm | 02_19_32 (6) |
| capy_compass_run_happy.webp | compass | run | happy | 02_19_13 (3) |
| capy_compass_stand_happy.webp | compass | stand | happy | 02_19_01 (5) |
| capy_flashlight_peek_thinking.webp | flashlight | peek | thinking | 02_19_02 (7) |
| capy_flashlight_point_thinking.webp | flashlight | point | thinking | 02_19_33 (8) |
| capy_flashlight_run_thinking.webp | flashlight | run | thinking | 02_19_14 (5) |
| capy_flashlight_stand_thinking.webp | flashlight | stand | thinking | 02_18_50 (7) |
| capy_flask_sit_calm.webp | flask | sit | calm | 02_19_02 (8) |
| capy_flowers_stand_calm.webp | flowers | stand | calm | 02_19_53 (7) |
| capy_gamepad_pawup_hype.webp | gamepad | pawup | hype | 02_18_49 (6) |
| capy_gamepad_peek_hype.webp | gamepad | peek | hype | 02_21_14 (8) |
| capy_gamepad_sit_cheer.webp | gamepad | sit | cheer | 02_20_54 (2) |
| capy_gamepad_sit_hype.webp | gamepad | sit | hype | 02_20_43 (7) |
| capy_gift_sit_hype.webp | gift | sit | hype | 02_22_03 (8) |
| capy_hoodie_peek_calm.webp | hoodie | peek | calm | 02_21_45 (5) |
| capy_hoodie_peek_chill.webp | hoodie | peek | chill | 02_21_48 (7) |
| capy_hoodie_peek_happy.webp | hoodie | peek | happy | 02_21_49 (8) |
| capy_hoodie_wave_calm.webp | hoodie | wave | calm | 02_21_47 (6) |
| capy_key_pawup_calm.webp | key | pawup | calm | 02_20_56 (4) |
| capy_key_sit_calm.webp | key | sit | calm | 00_49_28 (5) |
| capy_key_stand_calm.webp | key | stand | calm | 02_20_42 (5) |
| capy_lights_stand_happy.webp | lights | stand | happy | 02_19_13 (4) |
| capy_mug_sit_calm.webp | mug | sit | calm | 02_20_43 (6) |
| capy_palette_stand_thinking.webp | palette | stand | thinking | 02_19_53 (8) |
| capy_plant_stand_calm.webp | plant | stand | calm | 02_19_52 (5) |
| capy_stopwatch_run_hype.webp | stopwatch | run | hype | 01_51_09 (6) |
| capy_tablet_peek_thinking.webp | tablet | peek | thinking | 02_21_37 (8) |
| capy_tablet_sit_calm.webp | tablet | sit | calm | 02_22_00 (6) |
| capy_tablet_sit_thinking.webp | tablet | sit | thinking | 02_21_13 (7) |
| capy_tablet_stand_thinking.webp | tablet | stand | thinking | 02_20_09 (6) |
| capy_thermos_sit_calm.webp | thermos | sit | calm | 02_18_50 (8) |

---

## Спорные / близнецы (нужен ручной взгляд)

Стикеры, которые различаются **буквально жестом, наклоном или цветом худи** — по строгой схеме их пришлось разводить приближением позы/настроения либо **синтетическим словом-образом** (см. ниже). Проверь эти семьи глазами и при желании переименуй.

**Синтетические слова-образы** (придуманы, чтобы имена не совпадали внутри одинаковой сцены — предмет по сути тот же):
`cocoa`, `mug` (= та же кружка кофе, что `coffee`); `console`, `gameboy` (= тот же геймпад/приставка, что `gamepad`); `present`, `giftbox` (= та же коробка, что `gift`); `planner` (= тот же блокнот, что `notebook`); `book` (отдельная книга).

**Ручная отбраковка выполнена** (осталось 83 из 110, 27 удалено). Близкие дубли внутри семей — кофе/кружка, ключ, геймпад, планшет, гирлянда, зонт, телефон, подарок, худи-«выглядывает», фонарик-детектив, компас — проредены вручную. Актуальный состав — в таблицах «Коты» и «Капибары» выше.

### Приближения (поза/настроение)

Где реального тега в строгом словаре нет — взят ближайший:

- **Поза «на одном колене, протягивает вперёд» → `stand`:** `cat_gift_stand_happy`, `cat_gift_stand_calm`, `cat_gift_stand_hype` (маскот стоит на колене, не в полный рост).
- **Настроения `chill` vs `calm`** и **`cheer` vs `hype`** внутри семей-близнецов расставлены, чтобы развести почти одинаковые кадры; смысловая разница минимальна.
