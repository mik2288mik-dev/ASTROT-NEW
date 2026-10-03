/**
 * «Истории для сна и для успокоения»: authored NEBO texts, read slowly by
 * different voices. Each story is voiced once and shared by everyone.
 */
import type { TtsVoice } from './tts/openaiSpeech';

export type SleepStory = {
  id: string;
  kind: 'sleep' | 'calm';
  free: boolean;
  voice: TtsVoice;
  title: { ru: string; en: string };
  teaser: { ru: string; en: string };
  voiceLabel: { ru: string; en: string };
  text: { ru: string; en: string };
};

export const SLEEP_STORIES: readonly SleepStory[] = [
  {
    id: 'sea-house',
    kind: 'sleep',
    free: true,
    voice: 'sage',
    title: { ru: 'Дом у моря', en: 'The house by the sea' },
    teaser: { ru: 'Вечер, тёплый свет в окне и море, которое никуда не спешит', en: 'Evening, warm light in the window and a sea in no hurry' },
    voiceLabel: { ru: 'Тихий женский голос', en: 'Quiet female voice' },
    text: {
      ru: `Устройся поудобнее. Пусть подушка примет голову, а одеяло ляжет так, как тебе нравится. Сегодня никуда не нужно идти. Всё, что было днём, уже случилось, и до утра это может подождать.

Представь небольшой деревянный дом на берегу моря. Солнце только что село, и небо над водой стало мягким, персиковым, потом сиреневым. Ты стоишь на крыльце. Доски под ногами ещё тёплые — они весь день грелись на солнце и теперь отдают это тепло тебе.

Море совсем рядом. Ты слышишь, как волна набегает на берег, шуршит галькой и уходит обратно. Набегает — и уходит. Никакой спешки. Море делает так уже тысячи лет и будет делать завтра. Попробуй дышать вместе с ним. Вдох — волна приходит. Выдох — волна уходит.

Ты открываешь дверь и заходишь в дом. Внутри пахнет деревом и немного яблоками: на столе стоит миска с яблоками, которые кто-то принёс с утра. В углу горит лампа с абажуром, и свет от неё жёлтый, медовый. Он не режет глаза, он просто есть.

Ты проходишь на кухню. Чайник уже тёплый. Ты наливаешь себе чашку чего-то горячего — может быть, чай с мятой, может быть, молоко с мёдом. Держишь чашку двумя руками и чувствуешь, как тепло расходится по ладоням, по запястьям, поднимается к плечам.

Плечи опускаются. Сами собой. Странно, как высоко они были весь день.

У окна стоит старое кресло с пледом. Ты садишься, подбираешь ноги и накрываешься пледом. Он немного колючий и очень тёплый. За окном море стало тёмно-синим, а на горизонте зажёгся маленький огонёк — может быть, лодка рыбака, может быть, далёкий маяк. Огонёк мигает: раз, пауза, раз, пауза. Ровно и спокойно.

Ты делаешь глоток. Где-то в доме тикают часы. Тик. Так. Тик. Так. Они не торопят. Они просто считают время, которое тебе сейчас не нужно.

Слышно, как ветер трогает ставни, тихо, как будто проверяет, все ли дома. Все дома. Всё на месте. Двери закрыты, свет мягкий, чай тёплый.

На подоконнике лежат ракушки. Кто-то собирал их долго и раскладывал по размеру: от самой большой, похожей на ладонь, до совсем крошечной, с ноготь. Ты берёшь одну и подносишь к уху. Внутри шумит своё маленькое море — такое же, как за окном, только тише.

Ты вспоминаешь, каким был сегодня берег днём. Как светилась вода на мелководье, как по песку бегали маленькие крабы и прятались, стоило подойти. Как пахло солью и нагретыми камнями. Всё это было, и всё это хорошо. Теперь берег отдыхает, и тебе тоже можно.

Где-то наверху, на втором этаже, тихо скрипнула половица — дом устраивается на ночь, как большая старая собака, которая крутится на месте, прежде чем лечь. Скрипнула ещё раз — и успокоилась.

Ты кладёшь ракушку обратно, на её место в ряду. Всё на своих местах. И ты тоже — на своём.

Ты ставишь чашку на подоконник. Веки становятся тяжёлыми, и это приятная тяжесть, как после долгой прогулки по пляжу. Можно закрыть глаза. Море никуда не денется. Оно будет шуметь всю ночь, укладывая гальку ровными рядами.

Набегает — и уходит.

Ты слышишь, как волна приходит медленнее. Ещё медленнее. Между волнами становится всё больше тишины, и эта тишина тоже тёплая.

В этом доме тебя никто ни о чём не спросит. Здесь не нужно ничего решать, отвечать, успевать. Здесь можно просто быть. Дышать. Слушать море.

Вдох — волна приходит.

Выдох — волна уходит.

Огонёк на горизонте мигает всё реже. Часы тикают всё тише. Плед тёплый, кресло мягкое, дом держит тебя в своих деревянных ладонях.

Спокойной ночи. Море будет рядом до самого утра.`,
      en: `Get comfortable. Let the pillow hold your head and the blanket settle the way you like it. You do not need to go anywhere tonight. Everything from the day has already happened, and it can wait until morning.

Picture a small wooden house by the sea. The sun has just set, and the sky over the water has turned soft peach, then lilac. You stand on the porch. The boards under your feet are still warm — they soaked up the sun all day and now give that warmth back to you.

The sea is very close. A wave runs up the shore, rustles the pebbles and slips back. In — and out. No hurry. The sea has done this for thousands of years and will do it tomorrow. Try breathing with it. Breathe in — the wave arrives. Breathe out — the wave leaves.

You open the door and step inside. It smells of wood and a little of apples: there is a bowl of apples on the table that someone brought this morning. In the corner a lamp glows under its shade, a yellow, honey light. It does not hurt the eyes. It is simply there.

In the kitchen the kettle is still warm. You pour yourself a cup of something hot — mint tea, perhaps, or milk with honey. You hold the cup in both hands and feel the warmth spread through your palms, your wrists, up to your shoulders.

Your shoulders drop. All by themselves. You had not noticed how high they were all day.

By the window there is an old armchair with a blanket. You sit, tuck your feet up and pull the blanket over you. It is a little scratchy and very warm. Outside, the sea has turned deep blue, and a small light has appeared on the horizon — a fishing boat, maybe, or a distant lighthouse. It blinks: once, pause, once, pause. Steady and calm.

You take a sip. Somewhere in the house a clock ticks. Tick. Tock. It does not rush you. It only counts the time you do not need right now.

The wind touches the shutters softly, as if checking that everyone is home. Everyone is home. Everything is in place. The doors are closed, the light is soft, the tea is warm.

There are shells on the windowsill. Someone collected them for a long time and laid them out by size: from the largest, like a palm, to the tiniest, no bigger than a fingernail. You pick one up and hold it to your ear. Inside there is a small sea of its own — the same as the one outside, only quieter.

You remember the shore as it was today. How the water glowed in the shallows, how little crabs ran across the sand and hid the moment you came close. How it smelled of salt and warm stones. All of that happened, and all of it was good. Now the shore is resting, and you can too.

Somewhere upstairs a floorboard creaks softly — the house is settling for the night, like a big old dog turning round before lying down. It creaks once more — and is still.

You put the shell back in its place in the row. Everything is where it belongs. And so are you.

You put the cup on the windowsill. Your eyelids grow heavy, the pleasant heaviness after a long walk on the beach. You can close your eyes. The sea is not going anywhere. It will murmur all night, laying the pebbles in neat rows.

In — and out.

The waves come more slowly now. Slower still. There is more and more quiet between them, and the quiet is warm too.

Nobody in this house will ask you anything. Nothing needs deciding, answering or finishing here. Here you can simply be. Breathe. Listen to the sea.

Breathe in — the wave arrives.

Breathe out — the wave leaves.

The light on the horizon blinks less and less. The clock ticks quieter and quieter. The blanket is warm, the chair is soft, and the house holds you in its wooden hands.

Good night. The sea will be here until morning.`,
    },
  },
  {
    id: 'night-train',
    kind: 'sleep',
    free: false,
    voice: 'onyx',
    title: { ru: 'Ночной поезд через снег', en: 'The night train through the snow' },
    teaser: { ru: 'Купе, стук колёс и белые поля за окном', en: 'A sleeper cabin, the rhythm of wheels and white fields outside' },
    voiceLabel: { ru: 'Низкий мужской голос', en: 'Deep male voice' },
    text: {
      ru: `Закрой глаза. Сегодня ты едешь в поезде. Не важно куда — важно, что дорога долгая, а приехать нужно только утром.

В купе больше никого. На столике стоит стакан чая в металлическом подстаканнике, и ложечка в нём тихонько звякает на поворотах. Над полкой горит маленький ночник. Белая простыня хрустит, когда ты ложишься и вытягиваешь ноги.

Поезд идёт ровно. Колёса стучат: та-дам, та-дам. Та-дам, та-дам. Этот звук похож на сердцебиение, только медленнее. Послушай его немного. Та-дам. Та-дам.

За окном зима. Поезд едет через поля, и всё вокруг белое. Снег светится сам по себе, даже ночью, как будто внутри у него маленький свет. Иногда мимо проплывает лес — тёмные ели в снежных шапках стоят плотно, плечом к плечу, и молчат.

Ты смотришь в окно, и тебе тепло. Батарея под столиком греет, а стекло прохладное, и, если коснуться его пальцем, остаётся маленькое запотевшее пятнышко.

Поезд замедляется. Какая-то маленькая станция. Жёлтый фонарь, деревянная скамейка, засыпанная снегом, и никого. Только снежинки кружатся в свете фонаря, медленно, не торопясь, будто выбирают, куда лечь. Поезд стоит минуту, вздыхает и снова трогается.

Та-дам. Та-дам.

В коридоре кто-то прошёл в мягких тапочках и прикрыл за собой дверь. Снова тихо. Только колёса и ровный гул вагона.

Тебе не нужно следить за дорогой. Машинист знает путь. Рельсы знают путь. Всё, что тебе нужно, — лежать и ехать. Каждый стук колёс уносит тебя чуть дальше от дневных дел. Вот они остались на той станции, под жёлтым фонарём. Пусть полежат там до утра.

Подушка мягкая. Одеяло тяжёлое и тёплое. Вагон слегка покачивается, как колыбель, — вправо, влево, вправо, влево.

За окном снова поле. Луна вышла из облаков, и снег стал серебряным. По полю тянутся синие тени от редких деревьев. Где-то далеко светится одно окошко деревенского дома — там тоже кто-то не спит, пьёт чай и смотрит на поезд. На твой поезд, который несёт тебя сквозь ночь.

Проводница тихо проходит по коридору и проверяет, всё ли в порядке. Её шаги удаляются, и за дверью снова только ровный гул. Где-то в соседнем купе кто-то перевернул страницу книги, и этот шорох почему-то тоже успокаивает: ты не один в этой ночи, но никто ничего от тебя не ждёт.

Поезд въезжает на мост. Звук колёс становится глуже и гулче — тум-тум, тум-тум, — под мостом спит замёрзшая река. Лёд на ней гладкий, с голубыми трещинками, а по берегам стоят ивы, опустившие ветки до самого снега. Мост заканчивается, и колёса снова стучат привычно, легко.

Ты думаешь о том, как хорошо, что дорога делает всё сама. Не нужно поворачивать руль, искать указатели, выбирать. Можно просто лежать и знать: к утру ты будешь там, где нужно.

Чай в стакане остыл, и ложечка больше не звякает. Ты отодвигаешь стакан к окну. Пусть стоит до утра.

Ты выключаешь ночник. В купе становится темно и уютно, только полоска лунного света лежит на одеяле.

Та-дам. Та-дам.

Дыхание становится длиннее. Вдох — на два стука колёс. Выдох — на три.

Та-дам. Та-дам. Та-дам.

Поезд идёт всё ровнее. Звуки становятся мягкими, как снег. Тепло от батареи, тяжесть одеяла, качание вагона — всё сливается в одно спокойное ощущение: ты в пути, и тебе хорошо.

Утром будет новая станция и новый день. А сейчас — только ночь, снег и стук колёс.

Спи. Поезд довезёт.`,
      en: `Close your eyes. Tonight you are on a train. It does not matter where to — what matters is that the journey is long, and you only need to arrive in the morning.

You have the cabin to yourself. On the little table there is a glass of tea in a metal holder, and the spoon chimes softly on the bends. A small night light glows above the berth. The white sheet crackles as you lie down and stretch your legs.

The train runs evenly. The wheels knock: ta-dum, ta-dum. Ta-dum, ta-dum. It sounds like a heartbeat, only slower. Listen to it for a while. Ta-dum. Ta-dum.

Outside it is winter. The train crosses fields, and everything is white. The snow glows by itself, even at night, as if there were a little light inside it. Now and then a forest drifts by — dark firs in snowy caps, standing close, shoulder to shoulder, silent.

You look out of the window and feel warm. The heater under the table is warm, the glass is cool, and if you touch it with a finger, a small misty spot stays behind.

The train slows down. A tiny station. A yellow lamp, a wooden bench buried in snow, and nobody at all. Only snowflakes circling in the lamplight, slowly, as if choosing where to land. The train stands for a minute, sighs and moves on.

Ta-dum. Ta-dum.

Someone passes in the corridor in soft slippers and closes a door. Quiet again. Only the wheels and the steady hum of the carriage.

You do not need to watch the road. The driver knows the way. The rails know the way. All you need to do is lie here and travel. Every knock of the wheels carries you a little further from the day. There — it stayed behind at that station, under the yellow lamp. Let it wait there until morning.

The pillow is soft. The blanket is heavy and warm. The carriage rocks gently like a cradle — right, left, right, left.

Outside there is another field. The moon has come out, and the snow has turned silver. Blue shadows of lonely trees stretch across it. Far away a single window glows in a village house — someone there is awake too, drinking tea and watching the train. Your train, carrying you through the night.

The attendant walks quietly down the corridor, checking that all is well. Her steps fade, and behind the door there is only the steady hum again. In the next cabin someone turns a page, and somehow that rustle is calming too: you are not alone in this night, but nobody expects anything of you.

The train rolls onto a bridge. The wheels sound deeper and hollower — thoom-thoom, thoom-thoom — and below the bridge a frozen river sleeps. Its ice is smooth with blue cracks, and willows on the banks let their branches hang down to the snow. The bridge ends, and the wheels knock lightly again, the familiar way.

You think how good it is that the road does everything by itself. No steering, no signs to look for, nothing to choose. You can simply lie here and know: by morning you will be where you need to be.

The tea in the glass has gone cold, and the spoon no longer chimes. You push the glass towards the window. Let it stand there until morning.

You switch off the night light. The cabin becomes dark and cosy, with only a strip of moonlight on the blanket.

Ta-dum. Ta-dum.

Your breath grows longer. In — for two knocks of the wheels. Out — for three.

Ta-dum. Ta-dum. Ta-dum.

The train runs smoother and smoother. The sounds become soft as snow. The warm heater, the heavy blanket, the rocking carriage — it all blends into one calm feeling: you are on your way, and you are fine.

In the morning there will be a new station and a new day. For now there is only the night, the snow and the wheels.

Sleep. The train will get you there.`,
    },
  },
  {
    id: 'garden-rain',
    kind: 'calm',
    free: false,
    voice: 'shimmer',
    title: { ru: 'Сад после дождя', en: 'The garden after rain' },
    teaser: { ru: 'Для тревожного дня: десять минут тишины, мокрой травы и тёплого солнца', en: 'For an anxious day: ten minutes of quiet, wet grass and warm sun' },
    voiceLabel: { ru: 'Мягкий светлый голос', en: 'Soft bright voice' },
    text: {
      ru: `Если сегодня внутри шумно и тревожно, давай ненадолго выйдем туда, где тихо. Можно сидеть, можно лежать — как удобно. Просто послушай.

Только что закончился дождь. Ты выходишь в сад, и первое, что чувствуешь, — запах. Мокрая земля, трава, немного сирени. Воздух такой свежий, что его хочется пить. Сделай медленный вдох носом. И длинный выдох ртом, как будто остужаешь горячий чай.

С листьев ещё капает. Кап. Пауза. Кап. Капли падают в лужицу у дорожки, и по воде расходятся круги. Один круг, другой. Они расходятся и исчезают. Так же исчезают и мысли, если на них не давить, — появляются и расходятся.

Дорожка выложена старым кирпичом, он потемнел от воды. Ты идёшь медленно и чувствуешь, как ступня касается земли: пятка, середина, пальцы. Пятка, середина, пальцы. Никуда не надо спешить. Сад никуда не денется.

Из-за облака выходит солнце. Сразу становится теплее. Капли на траве загораются, как крошечные лампочки. На листе смородины сидит капля и держит в себе весь сад, только маленький и перевёрнутый.

В конце сада стоит скамейка. Ты садишься. Дерево немного влажное и прохладное, но солнце уже греет спину. Положи ладони на колени. Почувствуй, какие они тёплые.

Где-то в кустах начинает петь птица. Сначала неуверенно, одну ноту, потом смелее. Ей отвечает другая. Они переговариваются о чём-то своём — наверное, о том, что дождь кончился и можно снова лететь.

Тревога любит говорить, что всё срочно. Но посмотри вокруг: в саду ничего не срочно. Трава растёт с той скоростью, с какой растёт. Облака плывут со своей. Капли падают тогда, когда тяжелеют. И у тебя тоже есть своя скорость. Её можно себе разрешить.

Давай подышим вместе с садом. Вдох — на четыре счёта: раз, два, три, четыре. Выдох — на шесть: раз, два, три, четыре, пять, шесть. Ещё раз. Вдох — раз, два, три, четыре. Выдох — раз, два, три, четыре, пять, шесть.

Ветер трогает яблоню, и с веток осыпается последняя вода — короткий, весёлый дождик. Ты немного вздрагиваешь и улыбаешься.

Попробуй заметить пять вещей вокруг. Мокрый кирпич. Солнечное пятно на скамейке. Пчела, которая проверяет цветок клевера. Лужица с небом внутри. Твои тёплые ладони. Всё это происходит прямо сейчас. Не вчера и не завтра. Сейчас.

Рядом со скамейкой растёт мята. Сорви один листик, разотри его между пальцами и поднеси к лицу. Холодный, свежий запах. Сделай вдох — и почувствуй, как он доходит до самой груди. Мята не спрашивает, из-за чего было тревожно утром. Она просто пахнет.

По дорожке ползёт улитка. Она вылезла после дождя и никуда не торопится: её дом всегда с ней. Посмотри, как медленно она двигается. Сантиметр. Ещё сантиметр. И при этом она точно знает, куда ползёт. Иногда медленно — это не плохо. Иногда медленно — это как раз правильно.

Если какая-то мысль снова тянет тебя в тревогу, не спорь с ней. Представь, что это облако, и посмотри, как оно плывёт над садом. Вот оно над яблоней. Вот над крышей сарая. Вот оно уже за забором. Небо после него снова чистое.

Положи руку на грудь. Почувствуй, как она поднимается и опускается. Ты дышишь. Ты здесь. Этого сейчас достаточно.

Солнце поднимается выше. Сад высыхает, пар поднимается от дорожки тонкими прозрачными лентами. Птицы поют уже вовсю. Внутри становится чуть тише — как в саду после дождя.

Ты можешь вернуться сюда в любой момент. Сад всегда будет пахнуть мокрой травой, скамейка всегда будет ждать, а капли — падать в своём ритме.

Сделай последний медленный вдох. И выдох.

Когда захочется, открой глаза. Ты справляешься. Шаг за шагом, со своей скоростью.`,
      en: `If it is noisy and anxious inside today, let us step out for a while to where it is quiet. You can sit or lie down — whatever feels right. Just listen.

The rain has just stopped. You step into the garden, and the first thing you notice is the smell. Wet earth, grass, a little lilac. The air is so fresh you want to drink it. Take a slow breath in through your nose. And a long breath out through your mouth, as if cooling hot tea.

The leaves are still dripping. Drip. Pause. Drip. Drops fall into a little puddle by the path, and circles spread across the water. One circle, then another. They spread and disappear. Thoughts disappear the same way if you do not push them — they appear and fade.

The path is old brick, dark from the rain. You walk slowly and feel your foot touch the ground: heel, middle, toes. Heel, middle, toes. No need to hurry. The garden is not going anywhere.

The sun comes out from behind a cloud. It gets warmer at once. The drops on the grass light up like tiny bulbs. A drop sits on a currant leaf, holding the whole garden inside, only small and upside down.

At the end of the garden there is a bench. You sit. The wood is a little damp and cool, but the sun already warms your back. Rest your palms on your knees. Feel how warm they are.

Somewhere in the bushes a bird starts to sing. Hesitantly at first, one note, then bolder. Another answers. They talk about something of their own — probably that the rain is over and it is time to fly again.

Anxiety likes to say everything is urgent. But look around: nothing in the garden is urgent. The grass grows at its own speed. The clouds drift at theirs. Drops fall when they grow heavy. You have your own speed too. You are allowed to keep it.

Let us breathe with the garden. In for four: one, two, three, four. Out for six: one, two, three, four, five, six. Again. In — one, two, three, four. Out — one, two, three, four, five, six.

The wind touches the apple tree, and the last water falls from its branches — a short, cheerful shower. You flinch a little and smile.

Try to notice five things around you. The wet brick. A patch of sun on the bench. A bee checking a clover flower. A puddle with the sky inside. Your warm palms. All of this is happening right now. Not yesterday, not tomorrow. Now.

Mint grows next to the bench. Pick a leaf, rub it between your fingers and bring it to your face. A cool, fresh smell. Breathe in — and feel it reach all the way into your chest. The mint does not ask what you were worried about this morning. It simply smells of mint.

A snail is crawling along the path. It came out after the rain and is in no hurry: its home is always with it. Watch how slowly it moves. An inch. Another inch. And still it knows exactly where it is going. Sometimes slow is not bad. Sometimes slow is exactly right.

If a thought pulls you back into worry, do not argue with it. Imagine it is a cloud and watch it drift over the garden. There it is over the apple tree. Now over the shed roof. Now it is past the fence. The sky behind it is clear again.

Put a hand on your chest. Feel it rise and fall. You are breathing. You are here. For now, that is enough.

The sun climbs higher. The garden dries, and thin transparent ribbons of steam rise from the path. The birds are in full song. Inside, it gets a little quieter — like a garden after rain.

You can come back here any time. The garden will always smell of wet grass, the bench will always wait, and the drops will fall in their own rhythm.

Take one last slow breath in. And out.

When you are ready, open your eyes. You are managing. Step by step, at your own speed.`,
    },
  },
];

export function findSleepStory(id: string): SleepStory | null {
  return SLEEP_STORIES.find((story) => story.id === id) ?? null;
}
