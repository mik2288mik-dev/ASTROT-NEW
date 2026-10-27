"""Builds one Markdown file with every image prompt NEBO needs.
usage: python3 build.py <day_theme_prompts.md> <out.md>"""
import re
import sys

day_src, out = sys.argv[1], sys.argv[2]
day = open(day_src, encoding='utf-8').read()
# reuse the 18 day-theme prompts exactly as sent before
day_part = day[day.index('### day_talk.png'):day.index('---\n\n## 2.')].rstrip() + '\n'

STYLE = ("Premium tarot card art, highly detailed and luminous: classic Rider-Waite symbolism retold in a modern painterly style "
         "with soft volumetric light, fine gold linework and a gentle glow. Palette: deep cosmic violet #2E1065 and indigo #4338CA "
         "in skies and shadows, royal blue #2C4BEA, warm gold #F5B53D highlights, ivory white, natural skin tones. Rich colours, "
         "not neon. No pink, no magenta, no coral. Vertical card 2:3, 1024x1536, full-bleed illustration, the main figure centred, "
         "every important detail at least 6% away from the edges. No frame, no border, no text, no letters, no numbers, no roman "
         "numerals, no watermark, no signature. Adults only, no children, no blood, no nudity.")

MAJOR = [
    ('00_fool', 'The Fool', 'Шут', 'a young traveller in a bright patterned tunic stepping lightly toward the edge of a cliff, head high, a white rose in one hand and a small bundle on a staff over the shoulder, a small white dog leaping beside, snowy mountains far below and a big warm sun behind'),
    ('01_magician', 'The Magician', 'Маг', 'a confident figure in a red cloak over a white robe at a table, one hand raising a glowing wand to the sky, the other pointing to the ground; on the table a cup, a sword, a golden pentacle and a wand; a ribbon of light shaped like an infinity loop floats above the head; red roses and white lilies around'),
    ('02_high_priestess', 'The High Priestess', 'Верховная Жрица', 'a calm woman in flowing blue robes seated between a dark pillar and a light pillar, a crescent moon at her feet, a moon crown on her head, a half-hidden scroll in her lap, a veil decorated with pomegranates behind her, night water in the distance'),
    ('03_empress', 'The Empress', 'Императрица', 'a gentle woman crowned with twelve stars resting on soft cushions in a field of ripe golden wheat, a heart-shaped shield with the Venus symbol beside her, a forest and a small waterfall behind'),
    ('04_emperor', 'The Emperor', 'Император', 'a stern bearded ruler on a stone throne carved with ram heads, red robes over armour, holding an ankh-shaped sceptre and a golden orb, bare orange mountains behind'),
    ('05_hierophant', 'The Hierophant', 'Иерофант', 'a wise teacher in red and white robes with a triple crown seated between two stone pillars, one hand raised in blessing, two crossed golden keys at his feet, two adult followers kneeling before him'),
    ('06_lovers', 'The Lovers', 'Влюблённые', 'a man and a woman standing in a garden beneath a radiant winged angel in the clouds, a tree with flame-like leaves behind the man, an apple tree with a small snake behind the woman, a mountain between them and the sun above'),
    ('07_chariot', 'The Chariot', 'Колесница', 'a young warrior in star-decorated armour standing in a stone chariot under a canopy of stars, crescent moons on the shoulders, two resting sphinxes in front, one black and one white, a walled city behind'),
    ('08_strength', 'Strength', 'Сила', 'a woman in a white dress with a garland of flowers gently closing the jaws of a calm golden lion, a ribbon of light shaped like an infinity loop above her head, a green meadow and blue mountains'),
    ('09_hermit', 'The Hermit', 'Отшельник', 'an old bearded hermit in a grey cloak on a snowy mountain peak at night, holding up a lantern with a glowing six-pointed star inside and leaning on a long staff'),
    ('10_wheel', 'Wheel of Fortune', 'Колесо Фортуны', 'a great golden wheel with abstract symbols instead of letters floating among clouds, a sphinx with a sword sitting on top, a snake gliding down one side, a jackal-headed figure rising on the other, four winged creatures (an angel, an eagle, a lion and a bull) reading books in the corners'),
    ('11_justice', 'Justice', 'Справедливость', 'a crowned figure in red robes seated between two pillars, holding an upright sword in one hand and golden scales in the other, a violet veil behind'),
    ('12_hanged_man', 'The Hanged Man', 'Повешенный', 'a serene young man hanging upside down by one ankle from a living T-shaped tree, the other leg bent behind the knee, hands behind his back, a soft golden halo around his calm face'),
    ('13_death', 'Death', 'Смерть', 'a skeleton knight in black armour riding a white horse at a slow walk, carrying a black banner with a white five-petal rose; a bishop and a young woman stand calmly before him; a sunrise between two towers on the horizon; quiet and symbolic, not scary'),
    ('14_temperance', 'Temperance', 'Умеренность', 'a winged angel in white with a sun symbol on the chest pouring water between two golden cups, one foot on the grass and one in a pool, irises by the water, a path leading to mountains under a crown of light'),
    ('15_devil', 'The Devil', 'Дьявол', 'a horned figure with dark bat wings sitting on a black pedestal under a stylised star, a man and a woman with small horns standing below with loose chains around their necks that they could easily lift off; symbolic and calm, not gory'),
    ('16_tower', 'The Tower', 'Башня', 'a tall stone tower on a rocky peak struck by lightning at night, its crown-shaped top blown off, flames in the windows, golden sparks and stones falling, no people'),
    ('17_star', 'The Star', 'Звезда', 'a kneeling woman in a light flowing dress by a pool at night pouring water from two jugs, one onto the land and one into the pool, a large eight-pointed star with seven smaller stars above, a small bird on a tree'),
    ('18_moon', 'The Moon', 'Луна', 'a full moon with a calm face shedding drops of light, a winding path between two towers to distant mountains, a dog and a wolf howling at the moon, a crayfish climbing out of a pool'),
    ('19_sun', 'The Sun', 'Солнце', 'a radiant sun with a calm face, tall sunflowers behind a stone wall, a joyful young woman with a flower wreath riding a white horse and holding a red banner'),
    ('20_judgement', 'Judgement', 'Суд', 'an angel in the clouds blowing a golden trumpet with a banner, a man and a woman rising from open stone boxes floating on the water with their arms open to the sky, mountains behind'),
    ('21_world', 'The World', 'Мир', 'a dancing figure wrapped in a violet sash inside a large laurel wreath tied with red ribbons, holding a wand in each hand, four winged creatures (an angel, an eagle, a lion and a bull) in the clouds at the corners'),
]

SUITS = [
    ('wands', 'Wands', 'Жезлы', [
        'a hand emerging from a cloud holding a sprouting wooden wand with fresh green leaves, a castle on a hill and a river below',
        'a man in a castle holding a small globe and looking out over the sea and land, one wand in his hand and another fixed to the wall',
        'a man standing on a cliff beside three planted wands, watching ships sail on a golden sea',
        'four wands with a garland of flowers forming a canopy, two people raising bouquets in celebration, a castle behind',
        'five young men brandishing wands in a playful contest, energetic and unharmed',
        'a rider on a white horse wearing a laurel wreath and holding a wand with a wreath, a cheering crowd with wands around',
        'a man on a hilltop defending his position with one wand against six wands rising from below',
        'eight wands flying diagonally through a clear sky over a green landscape with a river',
        'a tired but determined man with a cloth headband leaning on a wand, eight wands standing behind him like a fence',
        'a man carrying a heavy bundle of ten wands toward a distant house',
        'a young person in a feathered hat holding a tall wand and studying it with curiosity, a warm desert with pyramids behind',
        'a knight on a rearing horse holding a wand high, a desert behind, salamander patterns on the tunic',
        'a queen on a throne carved with lions holding a wand and a sunflower, a black cat sitting at her feet',
        'a king on a throne carved with lions and salamanders holding a flowering wand',
    ]),
    ('cups', 'Cups', 'Кубки', [
        'a hand emerging from a cloud holding a golden cup overflowing with five streams of water, a white dove descending above it, water lilies on a pond',
        'a man and a woman exchanging cups, a winged lion head above two entwined snakes floating between them',
        'three women raising cups in a toast and dancing in a garden full of fruit',
        'a young man sitting under a tree with arms crossed, three cups before him, a hand from a cloud offering a fourth cup',
        'a figure in a black cloak looking down at three spilled cups, two standing cups behind, a river and a bridge to a castle',
        'two young adults in an old village garden, one offering the other a cup filled with white flowers, six cups with flowers around',
        'a figure facing seven cups floating in the clouds, each with a different vision: a castle, jewels, a laurel wreath, a small dragon, a snake, a veiled figure and a glowing face',
        'a cloaked traveller with a staff walking away from eight stacked cups toward mountains under an eclipsed moon',
        'a satisfied man seated with arms crossed in front of a curved table with nine cups arranged above',
        'a happy couple embracing and raising their arms toward a rainbow of ten cups, a cosy house and green hills behind',
        'a young person holding a cup with a small fish peeking out of it, sea waves behind',
        'a knight on a calm white horse holding a cup forward, a quiet river and trees',
        'a queen seated on a throne at the sea shore holding an ornate closed cup and gazing at it',
        'a king on a stone throne floating on a rough sea, holding a cup and a sceptre, a ship and a dolphin in the waves',
    ]),
    ('swords', 'Swords', 'Мечи', [
        'a hand emerging from a cloud holding an upright sword topped with a crown and a laurel garland, mountains below',
        'a blindfolded woman in white sitting by the sea at night holding two crossed swords over her chest, a crescent moon above',
        'a red heart pierced by three swords under a grey rainy sky, symbolic and clean',
        'a stone effigy of a resting knight on a tomb in a quiet chapel, hands in prayer, three swords on the wall and one beneath',
        'a smug man holding three swords while two figures walk away, two swords lying on the ground, a windy sky',
        'a ferryman rowing a boat with a cloaked woman across calm water, six swords standing in the boat',
        'a man tiptoeing away from a camp carrying five swords, two swords left planted behind',
        'a blindfolded woman loosely bound standing among eight swords planted in the ground, a castle on a cliff behind',
        'a person sitting up in bed with their face in their hands, nine swords on the dark wall behind',
        'ten swords standing in the ground before a dark sea at dawn, a calm golden sunrise breaking on the horizon, no people',
        'a young person holding a sword upright on a windy hill, clouds and birds in the sky',
        'a knight charging forward on a white horse with a raised sword, wind-blown trees and clouds',
        'a queen on a throne among the clouds holding an upright sword, one hand extended in welcome',
        'a king on a throne carved with butterflies holding an upright sword, a clear blue sky',
    ]),
    ('pentacles', 'Pentacles', 'Пентакли', [
        'a hand emerging from a cloud holding a golden pentacle coin with a five-pointed star, a garden with an arch of white roses',
        'a young man juggling two pentacles linked by an infinity-shaped ribbon, ships riding high waves behind',
        'a stonemason working on a cathedral arch while two people holding plans consult him, three pentacles carved in the arch',
        'a man holding a pentacle tightly to his chest, another on his crown and two under his feet, a city behind',
        'two poor travellers walking through snow, one with a crutch, beneath a lit stained-glass window with five pentacles',
        'a merchant weighing coins on golden scales and giving coins to two kneeling people',
        'a farmer leaning on a hoe and looking at a bush with seven pentacles growing like fruit',
        'a craftsman at a bench carving a pentacle, six finished pentacles displayed on a post',
        'an elegant woman in a vineyard garden among nine pentacles, a hooded falcon on her gloved hand',
        'an elderly man with two white dogs in a courtyard under an archway, a couple talking nearby, ten pentacles arranged in the scene',
        'a young person holding a pentacle up and gazing at it in a green field',
        'a knight on a heavy black horse standing still in a ploughed field, holding a pentacle',
        'a queen seated in a lush garden holding a pentacle in her lap, a rabbit nearby',
        'a king on a throne carved with bulls holding a pentacle and a sceptre, grapes around and a castle behind',
    ]),
]
RANK_EN = ['Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Page', 'Knight', 'Queen', 'King']
RANK_RU = ['Туз', 'Двойка', 'Тройка', 'Четвёрка', 'Пятёрка', 'Шестёрка', 'Семёрка', 'Восьмёрка', 'Девятка', 'Десятка', 'Паж', 'Рыцарь', 'Королева', 'Король']
SUIT_RU_GEN = {'wands': 'Жезлов', 'cups': 'Кубков', 'swords': 'Мечей', 'pentacles': 'Пентаклей'}

CAT_BASE = ("Photorealistic sprite sheet of the same ginger tabby cat as in the attached reference image, same fur pattern and the same "
            "proportions. Eight frames in a 4 by 2 grid, each frame in its own equal square cell, left to right, top row then bottom row. "
            "Side view, the cat faces right, full body visible in every cell, the same scale and the same soft studio light in every cell. "
            "Pure white background #FFFFFF, no floor line, no shadows, no text, no numbers, no borders between cells. Natural cat anatomy, "
            "the cat walks on four legs like a real cat, realistic fur, no cartoon style, no illustration style.")
LOCK = 'a small shiny gold padlock about the size of the cat\'s paw, rounded body, dark keyhole'
CATS = [
    ('cat_walk_sheet.png', 'Кошка идёт', 'One full walk cycle on four legs: eight evenly spaced phases of a natural relaxed walk, so the frames loop smoothly.'),
    ('cat_run_sheet.png', 'Кошка бежит', 'One full run cycle on four legs, a light gallop: eight evenly spaced phases, so the frames loop smoothly.'),
    ('cat_take_lock_sheet.png', 'Кошка берёт замок зубами', 'The cat picks up ' + LOCK + ' from the floor: 1 walking in; 2 slowing down; 3 stopping and sniffing the padlock lying in front of it; 4 lowering the head; 5 gently taking the padlock shackle in its teeth; 6 lifting the head with the padlock; 7 turning slightly to the right; 8 starting to walk away with the padlock in its mouth.'),
    ('cat_carry_walk_sheet.png', 'Кошка уносит замок шагом', 'One full walk cycle on four legs while carrying ' + LOCK + ' in its teeth by the shackle: eight evenly spaced phases that loop smoothly. The padlock is the same in every frame.'),
    ('cat_carry_run_sheet.png', 'Кошка уносит замок бегом', 'One full run cycle on four legs while carrying ' + LOCK + ' in its teeth by the shackle: eight evenly spaced phases that loop smoothly. The padlock is the same in every frame.'),
]

SAG = ("Sprite sheet of the same silver marble-like Sagittarius centaur statue as in the attached reference image: the same horse body, "
       "the same pose of the legs and tail, the same bow, the same face and hair, the same metallic silver material and the same soft studio "
       "lighting. Six frames in a 3 by 2 grid, each in its own equal square cell, left to right, top row then bottom row, showing the archer "
       "drawing the bow string step by step: 1 the drawing hand holds the string at the bow, the arrow resting on the bow, the drawing arm "
       "stretched forward; 2 the hand has pulled the string back a quarter of the way; 3 halfway, the elbow starts to rise; 4 three quarters; "
       "5 full draw, the hand at the chin, exactly like the reference image; 6 the moment right after release: the string straight, the arrow "
       "gone, the drawing hand opening and moving slightly back past the ear. Between frames only the drawing arm, the string and the arrow "
       "move; the horse body, the bow arm, the bow and the head stay exactly in place. Pure white background #FFFFFF, no shadows, no floor, "
       "no text, no numbers, no borders between cells.")

L = []
w = L.append
w('# NEBO: все промпты для картинок\n')
w('Как пользоваться:\n')
w('1. Каждый промпт копируй целиком, от начала до конца блока, и вставляй в Codex. Промпты на английском: так генератор понимает точнее.')
w('2. Сохраняй картинку под именем, которое стоит над промптом.')
w('3. Где написано «прикрепи», прикрепи к запросу указанный файл, тогда персонаж выйдет тем же самым.')
w('4. Готовые файлы присылай одной папкой. Обрежу, уберу фон, подпишу и вставлю в макет сам.\n')
w('Платные сервисы я не трогаю: генерируешь ты, я только пишу промпты и обрабатываю картинки.\n')
w('Что внутри:')
w('1. Колода таро: 78 карт и 2 рубашки.')
w('2. Картинки темы дня для главной («Сегодня»): 18 штук.')
w('3. Кошка, которая уносит замок после покупки: 5 листов с кадрами.')
w('4. Стрелец: кадры, где он натягивает тетиву.\n')
w('---\n')
w('## 1. Колода таро\n')
w('Надписи, номера и рамку на карты я добавлю кодом, на трёх языках. Поэтому на картинках не должно быть ни букв, ни цифр. Формат у всех карт одинаковый: вертикальная карта 2:3. Символы взяты из классической колоды Райдера-Уэйта, в нашем стиле. Детей на картах нет: где в классике дети, там взрослые или сцена без людей.\n')
w('Если какая-то карта выйдет с буквами или цифрами, просто перегенерируй её тем же промптом.\n')
w('### Рубашки\n')
w('#### tarot_back_plain.png: рубашка без логотипа')
w('```')
w('Tarot card back, perfectly symmetrical design that looks the same upside down. Deep violet night sky gradient from #1E1458 at the edges '
  'to #4330B8 and #7A5AF0 in the centre, fine gold constellations and tiny stars, a central eight-pointed gold star inside concentric circles '
  'of delicate gold ornament, a thin double gold border with rounded corners close to the edges. Highly detailed, luminous, premium. '
  'Vertical card 2:3, 1024x1536. No text, no letters, no numbers, no watermark. No pink, no magenta.')
w('```\n')
w('#### tarot_back_logo.png: рубашка с логотипом')
w('Прикрепи `nebo_logo_ref.png` (это иконка приложения). Если логотип выйдет кривым, бери рубашку без логотипа: настоящий логотип я поставлю кодом.')
w('```')
w('Tarot card back, perfectly symmetrical design. Deep violet night sky gradient from #1E1458 at the edges to #4330B8 and #7A5AF0 in the centre, '
  'fine gold constellations and tiny stars, a thin double gold border with rounded corners close to the edges. In the exact centre, the app icon '
  'from the attached reference image, the same shape and colours, placed inside a circle of delicate gold ornament. Highly detailed, luminous, '
  'premium. Vertical card 2:3, 1024x1536. No other text, no letters, no numbers, no watermark. No pink, no magenta.')
w('```\n')
w('### Старшие арканы (22)\n')
for code, en, ru, scene in MAJOR:
    w('#### tarot_%s.png: %s' % (code, ru))
    w('```')
    w('Tarot card "%s" (Major Arcana). Scene: %s. %s' % (en, scene, STYLE))
    w('```\n')
for key, en, ru, scenes in SUITS:
    w('### Младшие арканы: %s (14)\n' % ru)
    for i, scene in enumerate(scenes):
        w('#### tarot_%s_%02d.png: %s %s' % (key, i + 1, RANK_RU[i], SUIT_RU_GEN[key]))
        w('```')
        w('Tarot card "%s of %s" (Minor Arcana). Scene: %s. %s' % (RANK_EN[i], en, scene, STYLE))
        w('```\n')
w('---\n')
w('## 2. Картинки темы дня для главной («Сегодня»)\n')
w('Картинка стоит справа от названия дня, например «День, чтобы договориться». Каждый день она своя, по теме дня. Стиль у всех один, поэтому общий блок стиля повторяется в каждом промпте.\n')
w(day_part)
w('---\n')
w('## 3. Кошка, которая уносит замок после покупки\n')
w('Прикрепи к каждому запросу `cat_ref_walk.png` (и `cat_ref_upright.png`, если она есть), чтобы это была та же рыжая кошка. Кадры я нарежу и соберу в плавное видео сам.\n')
w('Если какой-то кадр выйдет кривым, перегенерируй только его отдельным запросом: «the same cat as in the reference, frame N from the list, single frame, pure white background #FFFFFF, side view, full body».\n')
for fname, ru, action in CATS:
    w('### %s: %s' % (fname, ru))
    w('```')
    w(CAT_BASE + ' ' + action)
    w('```\n')
w('---\n')
w('## 4. Стрелец натягивает тетиву\n')
w('Сейчас в макете Стрелец стреляет, а новая стрела появляется в мягкой вспышке света: так нет пустой руки, которая тянет тетиву без движения. Чтобы рука по-настоящему оттягивала тетиву, нужны кадры этого движения. Нарисовать их из одной картинки без искажений нельзя, поэтому вот промпт.\n')
w('Прикрепи `sign_illustration_sagittarius.png` (это картинка Стрельца из приложения, папка public/zodiac).\n')
w('### sag_draw_sheet.png')
w('```')
w(SAG)
w('```\n')
w('Если тело или лук между кадрами съезжают, попроси по одному кадру: «the same statue as in the reference, frame N from the list, single image, pure white background #FFFFFF».\n')

w('---\n')
w('## 5. Китайский гороскоп: 12 животных\n')
w('Сейчас в макете на месте животных стоят серебряные медальоны с иероглифами. Эти 12 картинок заменят их на экране «Знаки», во вкладке «Китайский», и в совместимости. Стиль тот же, что у знаков зодиака: серебряная статуэтка на белом фоне.\n')
w('Прикрепи к каждому запросу одну картинку знака зодиака из приложения, например `sign_illustration_leo.png` из папки public/zodiac, чтобы материал и свет совпали.\n')
CN_BASE = ('A small statue of {a}, in exactly the same style as the attached reference image: the same polished silver, marble-like metallic material '
           'with soft reflections, the same soft studio light from the upper left, the same gentle shadow under the figure, the same scale and framing. '
           'Calm, friendly, elegant pose, full body, three-quarter view. No pedestal, no letters, no symbols, no text. Pure white background #FFFFFF, '
           'square 1:1, 1024x1024, centered, the figure takes about 70% of the frame.')
CN_LIST = [
    ('cn_rat.png', 'Крыса', 'a rat sitting upright on its hind legs, holding a tiny grain in its front paws, the long tail curled around'),
    ('cn_ox.png', 'Бык', 'an ox standing calmly, strong body, short curved horns, head slightly lowered'),
    ('cn_tiger.png', 'Тигр', 'a tiger walking forward with confident steps, stripes lightly engraved in the silver'),
    ('cn_rabbit.png', 'Кролик', 'a rabbit sitting with long ears up, one ear slightly bent, soft round body'),
    ('cn_dragon.png', 'Дракон', 'a Chinese dragon with a long curling body coiled in an S-shape, small horns and whiskers, friendly face'),
    ('cn_snake.png', 'Змея', 'a coiled snake with its head raised gracefully, smooth scales lightly engraved'),
    ('cn_horse.png', 'Лошадь', 'a galloping horse with the mane and tail flowing, one front leg raised'),
    ('cn_goat.png', 'Коза', 'a goat with curved horns and a small beard, standing on a small rock'),
    ('cn_monkey.png', 'Обезьяна', 'a monkey sitting and holding a peach, playful expression, long tail curved'),
    ('cn_rooster.png', 'Петух', 'a rooster standing proudly, chest forward, large tail feathers, small comb'),
    ('cn_dog.png', 'Собака', 'a dog sitting loyally, ears up, looking forward, tail curled'),
    ('cn_pig.png', 'Свинья', 'a round friendly pig standing, small ears, curly tail, gentle smile'),
]
for fname, ru, a in CN_LIST:
    w('### %s: %s' % (fname, ru))
    w('```')
    w(CN_BASE.format(a=a))
    w('```\n')

open(out, 'w', encoding='utf-8').write('\n'.join(L))
print('written', out, sum(1 for x in L if x.startswith('```')) // 2, 'prompt blocks')
