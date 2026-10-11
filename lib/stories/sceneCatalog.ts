import { parseStoryScenes, type StoryScene } from './scenes';

export type StorySceneAsset = { id: string; seriesId: string; title: string; action: string; kind: StoryScene['kind']; src: string; poster: string };
export type StorySceneCue = { assetId: string; anchor: string; side: 'left' | 'right' };

const asset = (seriesId: string, id: string, title: string, action: string): StorySceneAsset => ({
  seriesId, id, title, action, kind: 'image', src: `/assets/stories/scenes/${id}-motion.webp`, poster: `/assets/stories/scenes/${id}.webp`,
});

/** Approved loops. The writer chooses matching actions after writing the complete prose. */
const PICTURE_ASSETS: readonly StorySceneAsset[] = [
  asset('family-chat', 'family-phone', 'Бабушка с телефоном', 'Зинаида в домашней кухне смотрит в смартфон и касается экрана'),
  asset('family-chat', 'family-cat', 'Кот и ноутбук', 'Рыжий кот на кухонном столе касается лапой клавиатуры ноутбука'),
  asset('family-chat', 'family-table', 'Чай на кухне', 'Женская рука рядом с чашкой чая и открытым блокнотом на кухонном столе'),
  asset('family-chat', 'family-screen', 'Сообщение на экране', 'Рука листает сообщения на смартфоне у кухонного стола'),
  asset('quiet-lane', 'quiet-envelope', 'Конверт', 'Руки в оливковом кардигане рассматривают закрытый конверт в книжном магазине'),
  asset('quiet-lane', 'quiet-cat', 'Пиксель у прилавка', 'Рыжий кот Пиксель сидит на прилавке книжного магазина рядом с ключами'),
  asset('quiet-lane', 'quiet-book', 'Книга под лампой', 'Вера в оливковом кардигане рассматривает раскрытую книгу под зелёной лампой'),
  asset('quiet-lane', 'quiet-watch', 'Карманные часы', 'Руки в белых хлопковых перчатках поднимают крышку старых карманных часов над стеклом циферблата'),
  asset('quiet-lane', 'quiet-window', 'Окно книжного', 'Капли дождя медленно стекают по окну книжного магазина; за стеклом старый переулок'),
  asset('polyn-station', 'polyn-console', 'Пульт станции', 'Рука в сером рукаве у панели управления исследовательской станции'),
  asset('polyn-station', 'polyn-repair', 'Проверка разъёма', 'Руки в технических перчатках проверяют разъём в открытой панели станции'),
  asset('polyn-station', 'polyn-signal', 'Сигнал на экране', 'На панели станции движется график сигнала и светится индикатор'),
  asset('stair-neighbours', 'stair-meet', 'Встреча на лестнице', 'Аня в светлом шарфе и Марк в тёмной куртке стоят на старой лестнице с альбомом'),
  asset('stair-neighbours', 'stair-dog', 'Бублик у миски', 'Рыжеватый лохматый пёс с тёмными ушами пьёт воду у батареи рядом с шарфом'),
  asset('stair-neighbours', 'stair-sketch', 'Рисунок в альбоме', 'Аня в светлом свитере делает карандашный набросок в раскрытом альбоме'),
  asset('stair-neighbours', 'stair-letter', 'Записка и ключ', 'Руки Ани в светлом свитере разворачивают записку возле маленького ключа на домашнем столе'),
  { ...asset('stair-neighbours', 'stair-phone', 'Сообщение для Ани', 'Рука в светлом вязаном рукаве листает сообщения на смартфоне у стола'),
    src: '/assets/stories/scenes/family-screen-motion.webp', poster: '/assets/stories/scenes/family-screen.webp' },
  asset('stair-neighbours', 'stair-talk', 'Разговор на площадке', 'Аня в светлом шарфе и Марк в тёмной куртке тихо разговаривают на старой лестнице'),
  asset('stair-neighbours', 'stair-candle', 'Ужин при свечах', 'Руки Ани в светлом свитере и Марка в тёмной рубашке у чашек на столе возле окна; мерцает свеча'),
];

export const STORY_SCENE_ASSETS: readonly StorySceneAsset[] = PICTURE_ASSETS;

export function sceneAssetsForSeries(seriesId: string): readonly StorySceneAsset[] {
  return STORY_SCENE_ASSETS.filter((item) => item.seriesId === seriesId);
}

export function scenesFromCues(seriesId: string, text: string, cues: readonly StorySceneCue[] = []): StoryScene[] {
  const assets = sceneAssetsForSeries(seriesId);
  return parseStoryScenes(cues.flatMap((cue, index) => {
    const selected = assets.find((item) => item.id === cue.assetId);
    return selected ? [{ id: `${selected.id}-${index + 1}`, kind: selected.kind, anchor: cue.anchor,
      src: selected.src, poster: selected.poster, alt: selected.action, side: cue.side }] : [];
  }), text);
}
