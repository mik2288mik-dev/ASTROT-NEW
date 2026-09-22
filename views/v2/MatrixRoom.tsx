import React, { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { UserProfile } from '../../types';
import { computeMatrix, type MatrixLifeArea, type MatrixPosition } from '../../lib/matrixOfDestiny';
import { getArcana, MATRIX_SUBTITLE, MATRIX_TITLE } from '../../lib/matrixArcana';
import { toDateInputValue } from '../../lib/date-utils';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { EditorialProfileButton } from '../../components/editorial/EditorialScreenChrome';
import styles from './MatrixRoom.module.css';

type Props = { profile: UserProfile; onBack: () => void; onOpenProfile?: () => void; onOpenCharts?: () => void; embedded?: boolean };
type Theme = 'character' | 'money' | 'love' | 'age';
type Point = { id: string; value: number; label: string; hint: string; formula: string; copy: string; place: string };
type Screen = { kind: 'home' } | { kind: 'point'; point: Point } | { kind: 'theme'; theme: Theme } | { kind: 'full' };

const cap = (value: string) => value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
const formula = (values: number[], result: number) => `${values.join(' + ')} → ${result}`;

function Diagram({ points, selected, onSelect }: { points: Point[]; selected: string; onSelect: (point: Point) => void }) {
  return <div className={styles.diagram} aria-label="Интерактивная матрица">
    <svg viewBox="0 0 280 280" aria-hidden="true"><circle cx="140" cy="140" r="104" /><path d="M140 36 244 140 140 244 36 140Z" /><path d="M140 36V244M36 140H244M66 66l148 148M214 66 66 214" /></svg>
    {points.map((point) => <button key={point.id} type="button" aria-label={`${point.label}: ${point.value}`} aria-pressed={selected === point.id} onClick={() => onSelect(point)} className={`${styles.node} ${styles[`node${point.place}`]} ${selected === point.id ? styles.selected : ''}`}>{point.value}</button>)}
  </div>;
}

export function MatrixRoom({ profile, onBack, onOpenProfile, embedded = false }: Props) {
  const ru = profile.language !== 'en';
  const lang: 'ru' | 'en' = ru ? 'ru' : 'en';
  const [date, setDate] = useState(toDateInputValue(profile.birthDate || ''));
  const [calculatedDate, setCalculatedDate] = useState(toDateInputValue(profile.birthDate || '') || null);
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });
  const [selectedId, setSelectedId] = useState('center');
  const result = useMemo(() => calculatedDate ? computeMatrix(calculatedDate, lang) : null, [calculatedDate, lang]);

  const points = useMemo<Point[]>(() => {
    if (!result) return [];
    const p = (key: MatrixPosition['key']) => result.positions.find((item) => item.key === key)!;
    const a = (key: MatrixLifeArea['key']) => result.lifeAreas.find((item) => item.key === key)!;
    const text = (value: number) => getArcana(value)[ru ? 'essence' : 'essenceEn'];
    const day = p('portrait'), month = p('talents'), year = p('karma'), base = p('comfort'), personal = p('personalPurpose'), social = p('socialPurpose'), center = p('self'), money = a('money'), love = a('love');
    const item = (id: string, source: MatrixPosition | MatrixLifeArea, f: string, place: string): Point => ({ id, value: source.arcana, label: source.label, hint: source.hint, formula: f, copy: text(source.arcana), place });
    return [
      item('month', month, `${result.month} → ${month.arcana}`, 'Top'), item('personal', personal, formula([day.arcana, month.arcana], personal.arcana), 'TopRight'), item('year', year, `${String(result.year).split('').join(' + ')} → ${year.arcana}`, 'Right'),
      item('social', social, formula([year.arcana, base.arcana], social.arcana), 'BottomRight'), item('base', base, formula([day.arcana, month.arcana, year.arcana], base.arcana), 'Bottom'), item('love', love, formula([day.arcana, personal.arcana], love.arcana), 'BottomLeft'),
      item('day', day, `${result.day} → ${day.arcana}`, 'Left'), item('money', money, formula([month.arcana, base.arcana], money.arcana), 'TopLeft'), item('center', center, formula([day.arcana, month.arcana, year.arcana, base.arcana], center.arcana), 'Center'),
    ];
  }, [result, ru]);
  const selected = points.find((point) => point.id === selectedId) || points.find((point) => point.id === 'center');

  const themes = useMemo(() => {
    if (!result) return null;
    const pos = (key: MatrixPosition['key']) => result.positions.find((item) => item.key === key)!;
    const area = (key: MatrixLifeArea['key']) => result.lifeAreas.find((item) => item.key === key)!;
    const text = (value: number) => getArcana(value)[ru ? 'essence' : 'essenceEn'];
    return {
      character: { title: ru ? 'Характер' : 'Character', lead: cap(text(pos('self').arcana)), blocks: [[ru ? 'Как ты действуешь' : 'How you act', text(pos('self').arcana)], [ru ? 'Сильная сторона' : 'Strength', text(pos('talents').arcana)], [ru ? 'Где можно не тащить всё самому' : 'Where to share the load', ru ? 'Когда хочется быстро навести порядок, полезно сначала проверить: это правда твоя задача?' : 'Before taking over, check whether this is really your task.']] },
      money: { title: ru ? 'Деньги' : 'Money', lead: cap(text(area('money').arcana)), blocks: [[ru ? 'Что здесь видно' : 'What this shows', text(area('money').arcana)], [ru ? 'На что смотреть' : 'What to notice', ru ? 'Сверяй результат не только с деньгами, но и с тем, сколько времени и сил он забирает.' : 'Consider both the result and the time and energy it takes.']] },
      love: { title: ru ? 'Отношения' : 'Relationships', lead: cap(text(area('love').arcana)), blocks: [[ru ? 'Что важно рядом с человеком' : 'What matters with someone close', text(area('love').arcana)], [ru ? 'Что лучше говорить вслух' : 'What to say aloud', ru ? 'Прямое объяснение часто бережёт больше, чем надежда, что тебя поймут без слов.' : 'A direct explanation can be kinder than expecting a perfect guess.']] },
      age: { title: ru ? 'По возрастам' : 'By life stages', lead: ru ? 'Не прогноз, а три точки, через которые можно посмотреть на свой опыт.' : 'Not a forecast — three lenses for looking at your experience.', blocks: [['18–24', text(pos('personalPurpose').arcana)], ['25–35', text(pos('socialPurpose').arcana)], [ru ? 'После 35' : 'After 35', text(pos('spiritualPurpose').arcana)]] },
    } as Record<Theme, { title: string; lead: string; blocks: string[][] }>;
  }, [result, ru]);

  const goHome = () => { lumiaSelectionHaptic(); setScreen({ kind: 'home' }); window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' })); };
  const calculate = () => { lumiaSelectionHaptic(); setCalculatedDate(date || null); setSelectedId('center'); setScreen({ kind: 'home' }); };
  const title = screen.kind === 'point' ? screen.point.label : screen.kind === 'theme' && themes ? themes[screen.theme].title : screen.kind === 'full' ? (ru ? 'Полный разбор' : 'Full reading') : MATRIX_TITLE[lang];
  const internal = screen.kind !== 'home';

  if (!result || !selected || !themes) return <div className={`${embedded ? '' : 'fresh-page '} ${styles.page}`}>
    {!embedded && <AppTopBar title={MATRIX_TITLE[lang]} onBack={onBack} rightAction={<EditorialProfileButton label={ru ? 'Открыть мои карты' : 'Open my charts'} onClick={onOpenProfile} />} />}
    <main className={styles.content}><h1>{MATRIX_TITLE[lang]}</h1><p className={styles.subhead}>{MATRIX_SUBTITLE[lang]}</p><label className={styles.dateField}>{ru ? 'Дата рождения' : 'Birth date'}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><button type="button" className={styles.primary} disabled={!date} onClick={calculate}>{ru ? 'Рассчитать матрицу' : 'Calculate matrix'}</button></main>
  </div>;

  const theme = screen.kind === 'theme' ? themes[screen.theme] : null;
  const chapters = [
    ['main', ru ? '01 · главное' : '01 · main', ru ? 'Главный вектор' : 'Main direction', selected.copy, ru ? 'Центр схемы помогает заметить повторяющийся способ действовать. Это не ярлык и не предсказание.' : 'The center helps notice a repeating pattern, not label you.'],
    ['character', ru ? '02 · характер' : '02 · character', themes.character.title, themes.character.lead, themes.character.blocks[1][1]],
    ['strengths', ru ? '03 · сильные стороны' : '03 · strengths', ru ? 'На что можно опереться' : 'What you can rely on', themes.character.blocks[1][1], ru ? 'Сильная сторона полезнее всего, когда ты знаешь, где она помогает, а где заставляет делать всё одному.' : 'Strength works best when you know where it helps and where it makes you do everything alone.'],
    ['money', ru ? '04 · деньги' : '04 · money', themes.money.title, themes.money.lead, themes.money.blocks[1][1]],
    ['love', ru ? '05 · отношения' : '05 · relationships', themes.love.title, themes.love.lead, themes.love.blocks[1][1]],
    ['friction', ru ? '06 · что мешает' : '06 · friction', ru ? 'Где бывает непросто' : 'Where it can be hard', themes.character.blocks[2][1], ru ? 'Это место, где полезно заранее заметить привычную реакцию, чтобы у тебя оставался выбор.' : 'Spot the habit early enough to keep a choice.'],
    ['age', ru ? '07 · по возрастам' : '07 · life stages', themes.age.title, themes.age.lead, themes.age.blocks.map(([age, copy]) => `${age}: ${copy}`).join(' ')],
    ['result', ru ? '08 · итог' : '08 · takeaway', ru ? 'Если собрать всё вместе' : 'Putting it together', themes.age.blocks[2][1], ru ? 'Матрица не предсказывает события и не решает за тебя. Это способ собрать наблюдения о себе в одну понятную картину.' : 'The matrix does not predict events or decide for you.'],
  ];

  return <div className={`${embedded ? '' : 'fresh-page '} ${styles.page}`}>
    {!embedded && <AppTopBar title={title} onBack={internal ? goHome : onBack} rightAction={<EditorialProfileButton label={ru ? 'Открыть мои карты' : 'Open my charts'} onClick={onOpenProfile} />} />}
    <main className={styles.content}>
      {screen.kind === 'home' && <>
        <p className={styles.dateLine}>{ru ? 'Дата рождения' : 'Birth date'} <strong>{date.split('-').reverse().join('.')}</strong></p>
        <details className={styles.recalculate}><summary>{ru ? 'Изменить дату' : 'Change date'}</summary><div><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /><button type="button" onClick={calculate}>{ru ? 'Пересчитать' : 'Recalculate'}</button></div></details>
        <section className={styles.matrixBlock}><p className={styles.eyebrow}>{ru ? 'Твоя матрица' : 'Your matrix'}</p><Diagram points={points} selected={selectedId} onSelect={(point) => { lumiaSelectionHaptic(); setSelectedId(point.id); }} /><div className={styles.selection}><b>{selected.value}</b><span><strong>{selected.label}</strong><small>{selected.formula}</small></span><button type="button" onClick={() => { lumiaSelectionHaptic(); setScreen({ kind: 'point', point: selected }); }}>{ru ? 'Разобрать' : 'Open'}</button></div></section>
        <section className={styles.themes}><h1>{ru ? 'Разбор' : 'Reading'}</h1><p>{ru ? 'Нажми на тему или число — откроем отдельный разбор.' : 'Choose a theme or a number for its own reading.'}</p>{(Object.keys(themes) as Theme[]).map((key, index) => <button type="button" className={styles.themeRow} key={key} onClick={() => { lumiaSelectionHaptic(); setScreen({ kind: 'theme', theme: key }); }}><b>{String(index + 1).padStart(2, '0')}</b><span><strong>{themes[key].title}</strong><small>{themes[key].lead}</small></span><ChevronRight aria-hidden="true" /></button>)}</section>
        <section className={styles.fullCard}><p>{ru ? 'Полный разбор' : 'Full reading'}</p><h2>{ru ? 'Собрать всё вместе' : 'See the whole picture'}</h2><span>{ru ? 'Восемь глав: от главной точки до итога.' : 'Eight chapters, from the main point to the takeaway.'}</span><button type="button" onClick={() => { lumiaSelectionHaptic(); setScreen({ kind: 'full' }); }}>{ru ? 'Открыть полный разбор' : 'Open full reading'}</button></section>
      </>}
      {screen.kind === 'point' && <article className={styles.detail}><p className={styles.eyebrow}>{ru ? 'Точка матрицы' : 'Matrix point'}</p><h1>{screen.point.label}</h1><p className={styles.lead}>{screen.point.hint}</p><section className={styles.formula}><small>{ru ? 'Как посчитано' : 'How it is calculated'}</small><strong>{screen.point.formula}</strong></section><section><h2>{ru ? 'Что здесь видно' : 'What this shows'}</h2><p>{screen.point.copy}</p></section><section><h2>{ru ? 'Как читать эту точку' : 'How to read this point'}</h2><p>{ru ? 'Смотри на неё вместе с соседними числами: тогда схема остаётся понятной и не превращается в набор ярлыков.' : 'Read it with the nearby numbers, not as a label on its own.'}</p></section><button type="button" className={styles.secondary} onClick={goHome}>{ru ? 'Вернуться к матрице' : 'Back to matrix'}</button></article>}
      {screen.kind === 'theme' && theme && <article className={styles.detail}><p className={styles.eyebrow}>{ru ? 'Разбор' : 'Reading'}</p><h1>{theme.title}</h1><p className={styles.lead}>{theme.lead}</p>{theme.blocks.map(([heading, copy]) => <section key={heading}><h2>{heading}</h2><p>{copy}</p></section>)}<button type="button" className={styles.secondary} onClick={goHome}>{ru ? 'Вернуться к матрице' : 'Back to matrix'}</button></article>}
      {screen.kind === 'full' && <article className={styles.fullReading}><nav className={styles.chapterNav} aria-label={ru ? 'Главы разбора' : 'Reading chapters'}>{[['main', ru ? 'Главное' : 'Main'], ['character', ru ? 'Характер' : 'Character'], ['money', ru ? 'Деньги' : 'Money'], ['love', ru ? 'Отношения' : 'Relationships'], ['age', ru ? 'Возраст' : 'Age']].map(([id, label]) => <button type="button" key={id} onClick={() => document.getElementById(`matrix-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{label}</button>)}</nav><section className={styles.fullIntro}><p>{ru ? 'Твоя общая картина' : 'Your overall picture'}</p><h1>{ru ? 'Восемь глав, чтобы спокойно собрать схему воедино.' : 'Eight chapters to put the diagram together.'}</h1><span>{ru ? 'Это развлекательная интерпретация даты рождения, а не прогноз.' : 'This is an entertaining interpretation, not a prediction.'}</span></section>{chapters.map(([id, cap, heading, lead, copy]) => <section className={styles.chapter} id={`matrix-${id}`} key={id}><p>{cap}</p><h2>{heading}</h2><strong>{lead}</strong><span>{copy}</span></section>)}<button type="button" className={styles.secondary} onClick={goHome}>{ru ? 'Вернуться к матрице' : 'Back to matrix'}</button></article>}
    </main>
  </div>;
}
