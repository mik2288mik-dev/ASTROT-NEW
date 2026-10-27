# NEBO: все промпты для картинок

Как пользоваться:

1. Каждый промпт копируй целиком, от начала до конца блока, и вставляй в Codex. Промпты на английском: так генератор понимает точнее.
2. Сохраняй картинку под именем, которое стоит над промптом.
3. Где написано «прикрепи», прикрепи к запросу указанный файл, тогда персонаж выйдет тем же самым.
4. Готовые файлы присылай одной папкой. Обрежу, уберу фон, подпишу и вставлю в макет сам.

Платные сервисы я не трогаю: генерируешь ты, я только пишу промпты и обрабатываю картинки.

Что внутри:
1. Колода таро: 78 карт и 2 рубашки.
2. Картинки темы дня для главной («Сегодня»): 18 штук.
3. Кошка, которая уносит замок после покупки: 5 листов с кадрами.
4. Стрелец: кадры, где он натягивает тетиву.

---

## 1. Колода таро

Надписи, номера и рамку на карты я добавлю кодом, на трёх языках. Поэтому на картинках не должно быть ни букв, ни цифр. Формат у всех карт одинаковый: вертикальная карта 2:3. Символы взяты из классической колоды Райдера-Уэйта, в нашем стиле. Детей на картах нет: где в классике дети, там взрослые или сцена без людей.

Если какая-то карта выйдет с буквами или цифрами, просто перегенерируй её тем же промптом.

### Рубашки

#### tarot_back_plain.png: рубашка без логотипа
```
Tarot card back, perfectly symmetrical design that looks the same upside down. Deep violet night sky gradient from #1E1458 at the edges to #4330B8 and #7A5AF0 in the centre, fine gold constellations and tiny stars, a central eight-pointed gold star inside concentric circles of delicate gold ornament, a thin double gold border with rounded corners close to the edges. Highly detailed, luminous, premium. Vertical card 2:3, 1024x1536. No text, no letters, no numbers, no watermark. No pink, no magenta.
```

#### tarot_back_logo.png: рубашка с логотипом
Прикрепи `nebo_logo_ref.png` (это иконка приложения). Если логотип выйдет кривым, бери рубашку без логотипа: настоящий логотип я поставлю кодом.
```
Tarot card back, perfectly symmetrical design. Deep violet night sky gradient from #1E1458 at the edges to #4330B8 and #7A5AF0 in the centre, fine gold constellations and tiny stars, a thin double gold border with rounded corners close to the edges. In the exact centre, the app icon from the attached reference image, the same shape and colours, placed inside a circle of delicate gold ornament. Highly detailed, luminous, premium. Vertical card 2:3, 1024x1536. No other text, no letters, no numbers, no watermark. No pink, no magenta.
```

### Старшие арканы (22)

#### tarot_00_fool.png: Шут
```
Tarot card "The Fool" (Major Arcana). Scene: a young traveller in a bright patterned tunic stepping lightly toward the edge of a cliff, head high, a white rose in one hand and a small bundle on a staff over the shoulder, a small white dog leaping beside, snowy mountains far below and a big warm sun behind. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_01_magician.png: Маг
```
Tarot card "The Magician" (Major Arcana). Scene: a confident figure in a red cloak over a white robe at a table, one hand raising a glowing wand to the sky, the other pointing to the ground; on the table a cup, a sword, a golden pentacle and a wand; a ribbon of light shaped like an infinity loop floats above the head; red roses and white lilies around. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_02_high_priestess.png: Верховная Жрица
```
Tarot card "The High Priestess" (Major Arcana). Scene: a calm woman in flowing blue robes seated between a dark pillar and a light pillar, a crescent moon at her feet, a moon crown on her head, a half-hidden scroll in her lap, a veil decorated with pomegranates behind her, night water in the distance. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_03_empress.png: Императрица
```
Tarot card "The Empress" (Major Arcana). Scene: a gentle woman crowned with twelve stars resting on soft cushions in a field of ripe golden wheat, a heart-shaped shield with the Venus symbol beside her, a forest and a small waterfall behind. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_04_emperor.png: Император
```
Tarot card "The Emperor" (Major Arcana). Scene: a stern bearded ruler on a stone throne carved with ram heads, red robes over armour, holding an ankh-shaped sceptre and a golden orb, bare orange mountains behind. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_05_hierophant.png: Иерофант
```
Tarot card "The Hierophant" (Major Arcana). Scene: a wise teacher in red and white robes with a triple crown seated between two stone pillars, one hand raised in blessing, two crossed golden keys at his feet, two adult followers kneeling before him. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_06_lovers.png: Влюблённые
```
Tarot card "The Lovers" (Major Arcana). Scene: a man and a woman standing in a garden beneath a radiant winged angel in the clouds, a tree with flame-like leaves behind the man, an apple tree with a small snake behind the woman, a mountain between them and the sun above. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_07_chariot.png: Колесница
```
Tarot card "The Chariot" (Major Arcana). Scene: a young warrior in star-decorated armour standing in a stone chariot under a canopy of stars, crescent moons on the shoulders, two resting sphinxes in front, one black and one white, a walled city behind. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_08_strength.png: Сила
```
Tarot card "Strength" (Major Arcana). Scene: a woman in a white dress with a garland of flowers gently closing the jaws of a calm golden lion, a ribbon of light shaped like an infinity loop above her head, a green meadow and blue mountains. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_09_hermit.png: Отшельник
```
Tarot card "The Hermit" (Major Arcana). Scene: an old bearded hermit in a grey cloak on a snowy mountain peak at night, holding up a lantern with a glowing six-pointed star inside and leaning on a long staff. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_10_wheel.png: Колесо Фортуны
```
Tarot card "Wheel of Fortune" (Major Arcana). Scene: a great golden wheel with abstract symbols instead of letters floating among clouds, a sphinx with a sword sitting on top, a snake gliding down one side, a jackal-headed figure rising on the other, four winged creatures (an angel, an eagle, a lion and a bull) reading books in the corners. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_11_justice.png: Справедливость
```
Tarot card "Justice" (Major Arcana). Scene: a crowned figure in red robes seated between two pillars, holding an upright sword in one hand and golden scales in the other, a violet veil behind. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_12_hanged_man.png: Повешенный
```
Tarot card "The Hanged Man" (Major Arcana). Scene: a serene young man hanging upside down by one ankle from a living T-shaped tree, the other leg bent behind the knee, hands behind his back, a soft golden halo around his calm face. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_13_death.png: Смерть
```
Tarot card "Death" (Major Arcana). Scene: a skeleton knight in black armour riding a white horse at a slow walk, carrying a black banner with a white five-petal rose; a bishop and a young woman stand calmly before him; a sunrise between two towers on the horizon; quiet and symbolic, not scary. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_14_temperance.png: Умеренность
```
Tarot card "Temperance" (Major Arcana). Scene: a winged angel in white with a sun symbol on the chest pouring water between two golden cups, one foot on the grass and one in a pool, irises by the water, a path leading to mountains under a crown of light. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_15_devil.png: Дьявол
```
Tarot card "The Devil" (Major Arcana). Scene: a horned figure with dark bat wings sitting on a black pedestal under a stylised star, a man and a woman with small horns standing below with loose chains around their necks that they could easily lift off; symbolic and calm, not gory. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_16_tower.png: Башня
```
Tarot card "The Tower" (Major Arcana). Scene: a tall stone tower on a rocky peak struck by lightning at night, its crown-shaped top blown off, flames in the windows, golden sparks and stones falling, no people. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_17_star.png: Звезда
```
Tarot card "The Star" (Major Arcana). Scene: a kneeling woman in a light flowing dress by a pool at night pouring water from two jugs, one onto the land and one into the pool, a large eight-pointed star with seven smaller stars above, a small bird on a tree. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_18_moon.png: Луна
```
Tarot card "The Moon" (Major Arcana). Scene: a full moon with a calm face shedding drops of light, a winding path between two towers to distant mountains, a dog and a wolf howling at the moon, a crayfish climbing out of a pool. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_19_sun.png: Солнце
```
Tarot card "The Sun" (Major Arcana). Scene: a radiant sun with a calm face, tall sunflowers behind a stone wall, a joyful young woman with a flower wreath riding a white horse and holding a red banner. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_20_judgement.png: Суд
```
Tarot card "Judgement" (Major Arcana). Scene: an angel in the clouds blowing a golden trumpet with a banner, a man and a woman rising from open stone boxes floating on the water with their arms open to the sky, mountains behind. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_21_world.png: Мир
```
Tarot card "The World" (Major Arcana). Scene: a dancing figure wrapped in a violet sash inside a large laurel wreath tied with red ribbons, holding a wand in each hand, four winged creatures (an angel, an eagle, a lion and a bull) in the clouds at the corners. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

### Младшие арканы: Жезлы (14)

#### tarot_wands_01.png: Туз Жезлов
```
Tarot card "Ace of Wands" (Minor Arcana). Scene: a hand emerging from a cloud holding a sprouting wooden wand with fresh green leaves, a castle on a hill and a river below. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_wands_02.png: Двойка Жезлов
```
Tarot card "Two of Wands" (Minor Arcana). Scene: a man in a castle holding a small globe and looking out over the sea and land, one wand in his hand and another fixed to the wall. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_wands_03.png: Тройка Жезлов
```
Tarot card "Three of Wands" (Minor Arcana). Scene: a man standing on a cliff beside three planted wands, watching ships sail on a golden sea. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_wands_04.png: Четвёрка Жезлов
```
Tarot card "Four of Wands" (Minor Arcana). Scene: four wands with a garland of flowers forming a canopy, two people raising bouquets in celebration, a castle behind. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_wands_05.png: Пятёрка Жезлов
```
Tarot card "Five of Wands" (Minor Arcana). Scene: five young men brandishing wands in a playful contest, energetic and unharmed. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_wands_06.png: Шестёрка Жезлов
```
Tarot card "Six of Wands" (Minor Arcana). Scene: a rider on a white horse wearing a laurel wreath and holding a wand with a wreath, a cheering crowd with wands around. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_wands_07.png: Семёрка Жезлов
```
Tarot card "Seven of Wands" (Minor Arcana). Scene: a man on a hilltop defending his position with one wand against six wands rising from below. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_wands_08.png: Восьмёрка Жезлов
```
Tarot card "Eight of Wands" (Minor Arcana). Scene: eight wands flying diagonally through a clear sky over a green landscape with a river. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_wands_09.png: Девятка Жезлов
```
Tarot card "Nine of Wands" (Minor Arcana). Scene: a tired but determined man with a cloth headband leaning on a wand, eight wands standing behind him like a fence. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_wands_10.png: Десятка Жезлов
```
Tarot card "Ten of Wands" (Minor Arcana). Scene: a man carrying a heavy bundle of ten wands toward a distant house. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_wands_11.png: Паж Жезлов
```
Tarot card "Page of Wands" (Minor Arcana). Scene: a young person in a feathered hat holding a tall wand and studying it with curiosity, a warm desert with pyramids behind. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_wands_12.png: Рыцарь Жезлов
```
Tarot card "Knight of Wands" (Minor Arcana). Scene: a knight on a rearing horse holding a wand high, a desert behind, salamander patterns on the tunic. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_wands_13.png: Королева Жезлов
```
Tarot card "Queen of Wands" (Minor Arcana). Scene: a queen on a throne carved with lions holding a wand and a sunflower, a black cat sitting at her feet. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_wands_14.png: Король Жезлов
```
Tarot card "King of Wands" (Minor Arcana). Scene: a king on a throne carved with lions and salamanders holding a flowering wand. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

### Младшие арканы: Кубки (14)

#### tarot_cups_01.png: Туз Кубков
```
Tarot card "Ace of Cups" (Minor Arcana). Scene: a hand emerging from a cloud holding a golden cup overflowing with five streams of water, a white dove descending above it, water lilies on a pond. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_cups_02.png: Двойка Кубков
```
Tarot card "Two of Cups" (Minor Arcana). Scene: a man and a woman exchanging cups, a winged lion head above two entwined snakes floating between them. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_cups_03.png: Тройка Кубков
```
Tarot card "Three of Cups" (Minor Arcana). Scene: three women raising cups in a toast and dancing in a garden full of fruit. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_cups_04.png: Четвёрка Кубков
```
Tarot card "Four of Cups" (Minor Arcana). Scene: a young man sitting under a tree with arms crossed, three cups before him, a hand from a cloud offering a fourth cup. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_cups_05.png: Пятёрка Кубков
```
Tarot card "Five of Cups" (Minor Arcana). Scene: a figure in a black cloak looking down at three spilled cups, two standing cups behind, a river and a bridge to a castle. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_cups_06.png: Шестёрка Кубков
```
Tarot card "Six of Cups" (Minor Arcana). Scene: two young adults in an old village garden, one offering the other a cup filled with white flowers, six cups with flowers around. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_cups_07.png: Семёрка Кубков
```
Tarot card "Seven of Cups" (Minor Arcana). Scene: a figure facing seven cups floating in the clouds, each with a different vision: a castle, jewels, a laurel wreath, a small dragon, a snake, a veiled figure and a glowing face. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_cups_08.png: Восьмёрка Кубков
```
Tarot card "Eight of Cups" (Minor Arcana). Scene: a cloaked traveller with a staff walking away from eight stacked cups toward mountains under an eclipsed moon. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_cups_09.png: Девятка Кубков
```
Tarot card "Nine of Cups" (Minor Arcana). Scene: a satisfied man seated with arms crossed in front of a curved table with nine cups arranged above. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_cups_10.png: Десятка Кубков
```
Tarot card "Ten of Cups" (Minor Arcana). Scene: a happy couple embracing and raising their arms toward a rainbow of ten cups, a cosy house and green hills behind. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_cups_11.png: Паж Кубков
```
Tarot card "Page of Cups" (Minor Arcana). Scene: a young person holding a cup with a small fish peeking out of it, sea waves behind. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_cups_12.png: Рыцарь Кубков
```
Tarot card "Knight of Cups" (Minor Arcana). Scene: a knight on a calm white horse holding a cup forward, a quiet river and trees. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_cups_13.png: Королева Кубков
```
Tarot card "Queen of Cups" (Minor Arcana). Scene: a queen seated on a throne at the sea shore holding an ornate closed cup and gazing at it. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_cups_14.png: Король Кубков
```
Tarot card "King of Cups" (Minor Arcana). Scene: a king on a stone throne floating on a rough sea, holding a cup and a sceptre, a ship and a dolphin in the waves. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

### Младшие арканы: Мечи (14)

#### tarot_swords_01.png: Туз Мечей
```
Tarot card "Ace of Swords" (Minor Arcana). Scene: a hand emerging from a cloud holding an upright sword topped with a crown and a laurel garland, mountains below. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_swords_02.png: Двойка Мечей
```
Tarot card "Two of Swords" (Minor Arcana). Scene: a blindfolded woman in white sitting by the sea at night holding two crossed swords over her chest, a crescent moon above. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_swords_03.png: Тройка Мечей
```
Tarot card "Three of Swords" (Minor Arcana). Scene: a red heart pierced by three swords under a grey rainy sky, symbolic and clean. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_swords_04.png: Четвёрка Мечей
```
Tarot card "Four of Swords" (Minor Arcana). Scene: a stone effigy of a resting knight on a tomb in a quiet chapel, hands in prayer, three swords on the wall and one beneath. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_swords_05.png: Пятёрка Мечей
```
Tarot card "Five of Swords" (Minor Arcana). Scene: a smug man holding three swords while two figures walk away, two swords lying on the ground, a windy sky. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_swords_06.png: Шестёрка Мечей
```
Tarot card "Six of Swords" (Minor Arcana). Scene: a ferryman rowing a boat with a cloaked woman across calm water, six swords standing in the boat. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_swords_07.png: Семёрка Мечей
```
Tarot card "Seven of Swords" (Minor Arcana). Scene: a man tiptoeing away from a camp carrying five swords, two swords left planted behind. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_swords_08.png: Восьмёрка Мечей
```
Tarot card "Eight of Swords" (Minor Arcana). Scene: a blindfolded woman loosely bound standing among eight swords planted in the ground, a castle on a cliff behind. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_swords_09.png: Девятка Мечей
```
Tarot card "Nine of Swords" (Minor Arcana). Scene: a person sitting up in bed with their face in their hands, nine swords on the dark wall behind. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_swords_10.png: Десятка Мечей
```
Tarot card "Ten of Swords" (Minor Arcana). Scene: ten swords standing in the ground before a dark sea at dawn, a calm golden sunrise breaking on the horizon, no people. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_swords_11.png: Паж Мечей
```
Tarot card "Page of Swords" (Minor Arcana). Scene: a young person holding a sword upright on a windy hill, clouds and birds in the sky. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_swords_12.png: Рыцарь Мечей
```
Tarot card "Knight of Swords" (Minor Arcana). Scene: a knight charging forward on a white horse with a raised sword, wind-blown trees and clouds. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_swords_13.png: Королева Мечей
```
Tarot card "Queen of Swords" (Minor Arcana). Scene: a queen on a throne among the clouds holding an upright sword, one hand extended in welcome. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_swords_14.png: Король Мечей
```
Tarot card "King of Swords" (Minor Arcana). Scene: a king on a throne carved with butterflies holding an upright sword, a clear blue sky. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

### Младшие арканы: Пентакли (14)

#### tarot_pentacles_01.png: Туз Пентаклей
```
Tarot card "Ace of Pentacles" (Minor Arcana). Scene: a hand emerging from a cloud holding a golden pentacle coin with a five-pointed star, a garden with an arch of white roses. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_pentacles_02.png: Двойка Пентаклей
```
Tarot card "Two of Pentacles" (Minor Arcana). Scene: a young man juggling two pentacles linked by an infinity-shaped ribbon, ships riding high waves behind. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_pentacles_03.png: Тройка Пентаклей
```
Tarot card "Three of Pentacles" (Minor Arcana). Scene: a stonemason working on a cathedral arch while two people holding plans consult him, three pentacles carved in the arch. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_pentacles_04.png: Четвёрка Пентаклей
```
Tarot card "Four of Pentacles" (Minor Arcana). Scene: a man holding a pentacle tightly to his chest, another on his crown and two under his feet, a city behind. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_pentacles_05.png: Пятёрка Пентаклей
```
Tarot card "Five of Pentacles" (Minor Arcana). Scene: two poor travellers walking through snow, one with a crutch, beneath a lit stained-glass window with five pentacles. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_pentacles_06.png: Шестёрка Пентаклей
```
Tarot card "Six of Pentacles" (Minor Arcana). Scene: a merchant weighing coins on golden scales and giving coins to two kneeling people. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_pentacles_07.png: Семёрка Пентаклей
```
Tarot card "Seven of Pentacles" (Minor Arcana). Scene: a farmer leaning on a hoe and looking at a bush with seven pentacles growing like fruit. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_pentacles_08.png: Восьмёрка Пентаклей
```
Tarot card "Eight of Pentacles" (Minor Arcana). Scene: a craftsman at a bench carving a pentacle, six finished pentacles displayed on a post. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_pentacles_09.png: Девятка Пентаклей
```
Tarot card "Nine of Pentacles" (Minor Arcana). Scene: an elegant woman in a vineyard garden among nine pentacles, a hooded falcon on her gloved hand. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_pentacles_10.png: Десятка Пентаклей
```
Tarot card "Ten of Pentacles" (Minor Arcana). Scene: an elderly man with two white dogs in a courtyard under an archway, a couple talking nearby, ten pentacles arranged in the scene. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_pentacles_11.png: Паж Пентаклей
```
Tarot card "Page of Pentacles" (Minor Arcana). Scene: a young person holding a pentacle up and gazing at it in a green field. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_pentacles_12.png: Рыцарь Пентаклей
```
Tarot card "Knight of Pentacles" (Minor Arcana). Scene: a knight on a heavy black horse standing still in a ploughed field, holding a pentacle. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_pentacles_13.png: Королева Пентаклей
```
Tarot card "Queen of Pentacles" (Minor Arcana). Scene: a queen seated in a lush garden holding a pentacle in her lap, a rabbit nearby. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

#### tarot_pentacles_14.png: Король Пентаклей
```
Tarot card "King of Pentacles" (Minor Arcana). Scene: a king on a throne carved with bulls holding a pentacle and a sceptre, grapes around and a castle behind. Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.
```

---

## 2. Картинки темы дня для главной («Сегодня»)

Картинка стоит справа от названия дня, например «День, чтобы договориться». Каждый день она своя, по теме дня. Стиль у всех один, поэтому общий блок стиля повторяется в каждом промпте.

### day_talk.png: «День, чтобы договориться»
```
Premium soft 3D icon of two speech bubbles overlapping, one royal blue and one dark violet, the front bubble has three small white dots. Single object group, centered, three-quarter view. Glossy clay-like material with a soft inner glow, soft studio light from the top left, gentle contact shadow under the object. Pure white background #FFFFFF. No text, no letters, no numbers, no faces, no people. Palette: royal blue #2C4BEA, indigo #4338CA, dark violet #4C1D95, warm gold accents #F5B53D. No pink, no magenta. Square 1024x1024, the object fills about 70% of the frame.
```

### day_warm.png: «Тёплый день: ты нравишься людям»
```
Premium soft 3D icon of a heart made of thick frosted glass with a warm golden glow inside, slightly tilted. Single object, centered, three-quarter view. Glossy clay-like material with a soft inner glow, soft studio light from the top left, gentle contact shadow under the object. Pure white background #FFFFFF. No text, no letters, no numbers, no faces, no people. Palette: deep red #C2412D, warm gold #F5B53D, a touch of dark violet #4C1D95 in the reflections. No pink, no magenta. Square 1024x1024, the object fills about 70% of the frame.
```

### day_home.png: «День для дома и своих»
```
Premium soft 3D icon of a small cozy house with a pitched roof and warm golden light in two windows. Single object, centered, three-quarter view. Glossy clay-like material, soft studio light from the top left, gentle contact shadow under the object. Pure white background #FFFFFF. No text, no letters, no numbers, no faces, no people. Palette: indigo #4338CA roof, soft white walls, warm gold window light #F5B53D. No pink, no magenta. Square 1024x1024, the object fills about 70% of the frame.
```

### day_money.png: «Денежный день»
```
Premium soft 3D icon of a small stack of three shiny gold coins next to a compact dark violet wallet. Single object group, centered, three-quarter view. Glossy clay-like material, soft studio light from the top left, gentle contact shadow under the objects. Pure white background #FFFFFF. No text, no letters, no numbers, no currency signs, no faces, no people. Palette: gold #F5B53D, dark violet #4C1D95, indigo #4338CA. No pink, no magenta. Square 1024x1024, the objects fill about 70% of the frame.
```

### day_rest.png: «День отдыха»
```
Premium soft 3D icon of a white ceramic cup of tea with soft steam and one fresh green lemon balm leaf on the saucer. Single object, centered, three-quarter view. Glossy clay-like material, soft studio light from the top left, gentle contact shadow under the object. Pure white background #FFFFFF. No text, no letters, no numbers, no faces, no people. Palette: white ceramic, warm amber tea, fresh green leaf, an indigo #4338CA stripe on the cup. No pink, no magenta. Square 1024x1024, the object fills about 70% of the frame.
```

### day_energy.png: «День сил»
```
Premium soft 3D icon of a bold lightning bolt with a warm golden glow. Single object, centered, three-quarter view, slightly tilted. Glossy clay-like material with a soft inner glow, soft studio light from the top left, gentle contact shadow under the object. Pure white background #FFFFFF. No text, no letters, no numbers, no faces, no people. Palette: gold #F5B53D to amber, a royal blue #2C4BEA rim light. No pink, no magenta. Square 1024x1024, the object fills about 70% of the frame.
```

### day_retro.png: «Меркурий разворачивается»
```
Premium soft 3D icon of the planet Mercury, a grey rocky cratered sphere, with a smooth glossy indigo arrow curving around it and pointing backwards. Single object group, centered, three-quarter view. Realistic planet surface, glossy clay-like arrow, soft studio light from the top left, gentle contact shadow under the object. Pure white background #FFFFFF. No text, no letters, no numbers, no faces, no people. Palette: stone grey, indigo #4338CA, dark violet #4C1D95. No pink, no magenta. Square 1024x1024, the object fills about 70% of the frame.
```

### day_gift.png: «Удовольствия без трат»
```
Premium soft 3D icon of a gift box with a satin ribbon and a neat bow, the lid slightly lifted with a soft golden glow inside. Single object, centered, three-quarter view. Glossy clay-like material, soft studio light from the top left, gentle contact shadow under the object. Pure white background #FFFFFF. No text, no letters, no numbers, no faces, no people. Palette: royal blue #2C4BEA box, gold #F5B53D ribbon. No pink, no magenta. Square 1024x1024, the object fills about 70% of the frame.
```

### day_love.png: «День для признаний и свиданий»
```
Premium soft 3D icon of a sealed envelope with a small gold wax seal in the shape of a heart. Single object, centered, three-quarter view, slightly tilted. Glossy clay-like material, soft studio light from the top left, gentle contact shadow under the object. Pure white background #FFFFFF. No text, no letters, no numbers, no faces, no people. Palette: soft white paper, dark violet #4C1D95 inner lining, gold #F5B53D seal. No pink, no magenta. Square 1024x1024, the object fills about 70% of the frame.
```

### day_work.png: «День для работы»
```
Premium soft 3D icon of a compact leather briefcase with gold clasps. Single object, centered, three-quarter view. Glossy clay-like material, soft studio light from the top left, gentle contact shadow under the object. Pure white background #FFFFFF. No text, no letters, no numbers, no faces, no people. Palette: indigo #4338CA leather, gold #F5B53D clasps. No pink, no magenta. Square 1024x1024, the object fills about 70% of the frame.
```

### day_start.png: «День для нового начала»
```
Premium soft 3D icon of a small green sprout with two leaves growing from a round indigo pot. Single object, centered, three-quarter view. Glossy clay-like material, soft studio light from the top left, gentle contact shadow under the object. Pure white background #FFFFFF. No text, no letters, no numbers, no faces, no people. Palette: fresh green leaves, indigo #4338CA pot, warm gold rim #F5B53D. No pink, no magenta. Square 1024x1024, the object fills about 70% of the frame.
```

### day_choice.png: «День решений»
```
Premium soft 3D icon of a classic compass with a gold case and a dark violet face, the needle pointing up and to the right. Single object, centered, three-quarter view. Glossy clay-like material, soft studio light from the top left, gentle contact shadow under the object. Pure white background #FFFFFF. No text, no letters, no numbers, no compass letters, no faces, no people. Palette: gold #F5B53D, dark violet #4C1D95, royal blue #2C4BEA needle. No pink, no magenta. Square 1024x1024, the object fills about 70% of the frame.
```

### day_create.png: «Творческий день»
```
Premium soft 3D icon of an artist palette with a few round paint dabs and one brush resting on it. Single object, centered, three-quarter view. Glossy clay-like material, soft studio light from the top left, gentle contact shadow under the object. Pure white background #FFFFFF. No text, no letters, no numbers, no faces, no people. Palette: warm wood palette, paint dabs in royal blue #2C4BEA, gold #F5B53D, emerald green and dark violet #4C1D95. No pink, no magenta. Square 1024x1024, the object fills about 70% of the frame.
```

### day_learn.png: «День, чтобы узнать новое»
```
Premium soft 3D icon of an open book with a small glowing gold star floating above the pages. Single object, centered, three-quarter view. Glossy clay-like material, soft studio light from the top left, gentle contact shadow under the object. Pure white background #FFFFFF. No text, no letters, no numbers on the pages, no faces, no people. Palette: indigo #4338CA cover, soft white pages, gold #F5B53D star. No pink, no magenta. Square 1024x1024, the object fills about 70% of the frame.
```

### day_calm.png: «Спокойный день»
```
Premium soft 3D icon of a smooth round pebble resting in shallow clear water with two soft ripple rings around it. Single object, centered, three-quarter view. Glossy clay-like material, soft studio light from the top left, gentle contact shadow. Pure white background #FFFFFF outside the small round water pool. No text, no letters, no numbers, no faces, no people. Palette: soft grey pebble, clear blue water with royal blue #2C4BEA tint. No pink, no magenta. Square 1024x1024, the object fills about 70% of the frame.
```

### day_careful.png: «Осторожный день»
```
Premium soft 3D icon of a closed umbrella standing upright, slightly tilted, with a curved wooden handle. Single object, centered, three-quarter view. Glossy clay-like material, soft studio light from the top left, gentle contact shadow under the object. Pure white background #FFFFFF. No text, no letters, no numbers, no faces, no people. Palette: dark violet #4C1D95 canopy, warm wood handle, gold #F5B53D tip. No pink, no magenta. Square 1024x1024, the object fills about 70% of the frame.
```

### day_fullmoon.png: «Полнолуние»
```
Premium soft 3D icon of a realistic full Moon sphere with visible maria and craters, soft warm glow around it. Single object, centered. Realistic lunar surface, soft studio light from the top left. Pure white background #FFFFFF. No text, no letters, no numbers, no faces, no people. Palette: silver grey moon, warm gold glow #F5B53D. No pink, no magenta. Square 1024x1024, the moon fills about 65% of the frame.
```

### day_newmoon.png: «Новолуние»
```
Premium soft 3D icon of a thin silver crescent Moon with a few tiny gold stars near it. Single object group, centered. Glossy material with a soft inner glow, soft studio light from the top left. Pure white background #FFFFFF. No text, no letters, no numbers, no faces, no people. Palette: silver, indigo #4338CA shading, gold #F5B53D stars. No pink, no magenta. Square 1024x1024, the crescent fills about 65% of the frame.
```

---

## 3. Кошка, которая уносит замок после покупки

Прикрепи к каждому запросу `cat_ref_walk.png` (и `cat_ref_upright.png`, если она есть), чтобы это была та же рыжая кошка. Кадры я нарежу и соберу в плавное видео сам.

Если какой-то кадр выйдет кривым, перегенерируй только его отдельным запросом: «the same cat as in the reference, frame N from the list, single frame, pure white background #FFFFFF, side view, full body».

### cat_walk_sheet.png: Кошка идёт
```
Photorealistic sprite sheet of the same ginger tabby cat as in the attached reference image, same fur pattern and the same proportions. Eight frames in a 4 by 2 grid, each frame in its own equal square cell, left to right, top row then bottom row. Side view, the cat faces right, full body visible in every cell, the same scale and the same soft studio light in every cell. Pure white background #FFFFFF, no floor line, no shadows, no text, no numbers, no borders between cells. Natural cat anatomy, the cat walks on four legs like a real cat, realistic fur, no cartoon style, no illustration style. One full walk cycle on four legs: eight evenly spaced phases of a natural relaxed walk, so the frames loop smoothly.
```

### cat_run_sheet.png: Кошка бежит
```
Photorealistic sprite sheet of the same ginger tabby cat as in the attached reference image, same fur pattern and the same proportions. Eight frames in a 4 by 2 grid, each frame in its own equal square cell, left to right, top row then bottom row. Side view, the cat faces right, full body visible in every cell, the same scale and the same soft studio light in every cell. Pure white background #FFFFFF, no floor line, no shadows, no text, no numbers, no borders between cells. Natural cat anatomy, the cat walks on four legs like a real cat, realistic fur, no cartoon style, no illustration style. One full run cycle on four legs, a light gallop: eight evenly spaced phases, so the frames loop smoothly.
```

### cat_take_lock_sheet.png: Кошка берёт замок зубами
```
Photorealistic sprite sheet of the same ginger tabby cat as in the attached reference image, same fur pattern and the same proportions. Eight frames in a 4 by 2 grid, each frame in its own equal square cell, left to right, top row then bottom row. Side view, the cat faces right, full body visible in every cell, the same scale and the same soft studio light in every cell. Pure white background #FFFFFF, no floor line, no shadows, no text, no numbers, no borders between cells. Natural cat anatomy, the cat walks on four legs like a real cat, realistic fur, no cartoon style, no illustration style. The cat picks up a small shiny gold padlock about the size of the cat's paw, rounded body, dark keyhole from the floor: 1 walking in; 2 slowing down; 3 stopping and sniffing the padlock lying in front of it; 4 lowering the head; 5 gently taking the padlock shackle in its teeth; 6 lifting the head with the padlock; 7 turning slightly to the right; 8 starting to walk away with the padlock in its mouth.
```

### cat_carry_walk_sheet.png: Кошка уносит замок шагом
```
Photorealistic sprite sheet of the same ginger tabby cat as in the attached reference image, same fur pattern and the same proportions. Eight frames in a 4 by 2 grid, each frame in its own equal square cell, left to right, top row then bottom row. Side view, the cat faces right, full body visible in every cell, the same scale and the same soft studio light in every cell. Pure white background #FFFFFF, no floor line, no shadows, no text, no numbers, no borders between cells. Natural cat anatomy, the cat walks on four legs like a real cat, realistic fur, no cartoon style, no illustration style. One full walk cycle on four legs while carrying a small shiny gold padlock about the size of the cat's paw, rounded body, dark keyhole in its teeth by the shackle: eight evenly spaced phases that loop smoothly. The padlock is the same in every frame.
```

### cat_carry_run_sheet.png: Кошка уносит замок бегом
```
Photorealistic sprite sheet of the same ginger tabby cat as in the attached reference image, same fur pattern and the same proportions. Eight frames in a 4 by 2 grid, each frame in its own equal square cell, left to right, top row then bottom row. Side view, the cat faces right, full body visible in every cell, the same scale and the same soft studio light in every cell. Pure white background #FFFFFF, no floor line, no shadows, no text, no numbers, no borders between cells. Natural cat anatomy, the cat walks on four legs like a real cat, realistic fur, no cartoon style, no illustration style. One full run cycle on four legs while carrying a small shiny gold padlock about the size of the cat's paw, rounded body, dark keyhole in its teeth by the shackle: eight evenly spaced phases that loop smoothly. The padlock is the same in every frame.
```

---

## 4. Стрелец натягивает тетиву

Сейчас в макете Стрелец стреляет, а новая стрела появляется в мягкой вспышке света: так нет пустой руки, которая тянет тетиву без движения. Чтобы рука по-настоящему оттягивала тетиву, нужны кадры этого движения. Нарисовать их из одной картинки без искажений нельзя, поэтому вот промпт.

Прикрепи `sign_illustration_sagittarius.png` (это картинка Стрельца из приложения, папка public/zodiac).

### sag_draw_sheet.png
```
Sprite sheet of the same silver marble-like Sagittarius centaur statue as in the attached reference image: the same horse body, the same pose of the legs and tail, the same bow, the same face and hair, the same metallic silver material and the same soft studio lighting. Six frames in a 3 by 2 grid, each in its own equal square cell, left to right, top row then bottom row, showing the archer drawing the bow string step by step: 1 the drawing hand holds the string at the bow, the arrow resting on the bow, the drawing arm stretched forward; 2 the hand has pulled the string back a quarter of the way; 3 halfway, the elbow starts to rise; 4 three quarters; 5 full draw, the hand at the chin, exactly like the reference image; 6 the moment right after release: the string straight, the arrow gone, the drawing hand opening and moving slightly back past the ear. Between frames only the drawing arm, the string and the arrow move; the horse body, the bow arm, the bow and the head stay exactly in place. Pure white background #FFFFFF, no shadows, no floor, no text, no numbers, no borders between cells.
```

Если тело или лук между кадрами съезжают, попроси по одному кадру: «the same statue as in the reference, frame N from the list, single image, pure white background #FFFFFF».

---

## 5. Китайский гороскоп: 12 животных

Сейчас в макете на месте животных стоят серебряные медальоны с иероглифами. Эти 12 картинок заменят их на экране «Знаки», во вкладке «Китайский», и в совместимости. Стиль тот же, что у знаков зодиака: серебряная статуэтка на белом фоне.

Прикрепи к каждому запросу одну картинку знака зодиака из приложения, например `sign_illustration_leo.png` из папки public/zodiac, чтобы материал и свет совпали.

### cn_rat.png: Крыса
```
A small statue of a rat sitting upright on its hind legs, holding a tiny grain in its front paws, the long tail curled around, in exactly the same style as the attached reference image: the same polished silver, marble-like metallic material with soft reflections, the same soft studio light from the upper left, the same gentle shadow under the figure, the same scale and framing. Calm, friendly, elegant pose, full body, three-quarter view. No pedestal, no letters, no symbols, no text. Pure white background #FFFFFF, square 1:1, 1024x1024, centered, the figure takes about 70% of the frame.
```

### cn_ox.png: Бык
```
A small statue of an ox standing calmly, strong body, short curved horns, head slightly lowered, in exactly the same style as the attached reference image: the same polished silver, marble-like metallic material with soft reflections, the same soft studio light from the upper left, the same gentle shadow under the figure, the same scale and framing. Calm, friendly, elegant pose, full body, three-quarter view. No pedestal, no letters, no symbols, no text. Pure white background #FFFFFF, square 1:1, 1024x1024, centered, the figure takes about 70% of the frame.
```

### cn_tiger.png: Тигр
```
A small statue of a tiger walking forward with confident steps, stripes lightly engraved in the silver, in exactly the same style as the attached reference image: the same polished silver, marble-like metallic material with soft reflections, the same soft studio light from the upper left, the same gentle shadow under the figure, the same scale and framing. Calm, friendly, elegant pose, full body, three-quarter view. No pedestal, no letters, no symbols, no text. Pure white background #FFFFFF, square 1:1, 1024x1024, centered, the figure takes about 70% of the frame.
```

### cn_rabbit.png: Кролик
```
A small statue of a rabbit sitting with long ears up, one ear slightly bent, soft round body, in exactly the same style as the attached reference image: the same polished silver, marble-like metallic material with soft reflections, the same soft studio light from the upper left, the same gentle shadow under the figure, the same scale and framing. Calm, friendly, elegant pose, full body, three-quarter view. No pedestal, no letters, no symbols, no text. Pure white background #FFFFFF, square 1:1, 1024x1024, centered, the figure takes about 70% of the frame.
```

### cn_dragon.png: Дракон
```
A small statue of a Chinese dragon with a long curling body coiled in an S-shape, small horns and whiskers, friendly face, in exactly the same style as the attached reference image: the same polished silver, marble-like metallic material with soft reflections, the same soft studio light from the upper left, the same gentle shadow under the figure, the same scale and framing. Calm, friendly, elegant pose, full body, three-quarter view. No pedestal, no letters, no symbols, no text. Pure white background #FFFFFF, square 1:1, 1024x1024, centered, the figure takes about 70% of the frame.
```

### cn_snake.png: Змея
```
A small statue of a coiled snake with its head raised gracefully, smooth scales lightly engraved, in exactly the same style as the attached reference image: the same polished silver, marble-like metallic material with soft reflections, the same soft studio light from the upper left, the same gentle shadow under the figure, the same scale and framing. Calm, friendly, elegant pose, full body, three-quarter view. No pedestal, no letters, no symbols, no text. Pure white background #FFFFFF, square 1:1, 1024x1024, centered, the figure takes about 70% of the frame.
```

### cn_horse.png: Лошадь
```
A small statue of a galloping horse with the mane and tail flowing, one front leg raised, in exactly the same style as the attached reference image: the same polished silver, marble-like metallic material with soft reflections, the same soft studio light from the upper left, the same gentle shadow under the figure, the same scale and framing. Calm, friendly, elegant pose, full body, three-quarter view. No pedestal, no letters, no symbols, no text. Pure white background #FFFFFF, square 1:1, 1024x1024, centered, the figure takes about 70% of the frame.
```

### cn_goat.png: Коза
```
A small statue of a goat with curved horns and a small beard, standing on a small rock, in exactly the same style as the attached reference image: the same polished silver, marble-like metallic material with soft reflections, the same soft studio light from the upper left, the same gentle shadow under the figure, the same scale and framing. Calm, friendly, elegant pose, full body, three-quarter view. No pedestal, no letters, no symbols, no text. Pure white background #FFFFFF, square 1:1, 1024x1024, centered, the figure takes about 70% of the frame.
```

### cn_monkey.png: Обезьяна
```
A small statue of a monkey sitting and holding a peach, playful expression, long tail curved, in exactly the same style as the attached reference image: the same polished silver, marble-like metallic material with soft reflections, the same soft studio light from the upper left, the same gentle shadow under the figure, the same scale and framing. Calm, friendly, elegant pose, full body, three-quarter view. No pedestal, no letters, no symbols, no text. Pure white background #FFFFFF, square 1:1, 1024x1024, centered, the figure takes about 70% of the frame.
```

### cn_rooster.png: Петух
```
A small statue of a rooster standing proudly, chest forward, large tail feathers, small comb, in exactly the same style as the attached reference image: the same polished silver, marble-like metallic material with soft reflections, the same soft studio light from the upper left, the same gentle shadow under the figure, the same scale and framing. Calm, friendly, elegant pose, full body, three-quarter view. No pedestal, no letters, no symbols, no text. Pure white background #FFFFFF, square 1:1, 1024x1024, centered, the figure takes about 70% of the frame.
```

### cn_dog.png: Собака
```
A small statue of a dog sitting loyally, ears up, looking forward, tail curled, in exactly the same style as the attached reference image: the same polished silver, marble-like metallic material with soft reflections, the same soft studio light from the upper left, the same gentle shadow under the figure, the same scale and framing. Calm, friendly, elegant pose, full body, three-quarter view. No pedestal, no letters, no symbols, no text. Pure white background #FFFFFF, square 1:1, 1024x1024, centered, the figure takes about 70% of the frame.
```

### cn_pig.png: Свинья
```
A small statue of a round friendly pig standing, small ears, curly tail, gentle smile, in exactly the same style as the attached reference image: the same polished silver, marble-like metallic material with soft reflections, the same soft studio light from the upper left, the same gentle shadow under the figure, the same scale and framing. Calm, friendly, elegant pose, full body, three-quarter view. No pedestal, no letters, no symbols, no text. Pure white background #FFFFFF, square 1:1, 1024x1024, centered, the figure takes about 70% of the frame.
```
