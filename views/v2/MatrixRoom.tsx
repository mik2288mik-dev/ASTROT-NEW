import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, LockKeyhole } from 'lucide-react';
import type { UserProfile } from '../../types';
import { computeMatrix, reduceToArcana, type MatrixLifeArea, type MatrixPosition } from '../../lib/matrixOfDestiny';
import { getArcana, MATRIX_SUBTITLE, MATRIX_TITLE } from '../../lib/matrixArcana';
import { toDateInputValue } from '../../lib/date-utils';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { useScreenBack } from '../../lib/useScreenBack';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { MyChartHeader, type MyChartSegment } from '../../components/nebo/MyChartHeader';
import { EditorialProfileButton } from '../../components/editorial/EditorialScreenChrome';
import { ACTION_FEEDBACK, showActionFeedback } from '../../components/lumia-ui/ActionFeedback';
import styles from './MatrixRoom.module.css';
import scrollStyles from './MatrixRoomScrollFix.module.css';
import { hasActivePremium } from '../../lib/accessMatrix';
import { tr } from '../../lib/i18n';

type Props = { profile: UserProfile; onBack: () => void; onOpenProfile?: () => void; onOpenCharts?: () => void; embedded?: boolean; onRequestPremium?: () => void; onOpenSegment?: (segment: MyChartSegment) => void };

/** Free: the diagram, every number, the character theme. NEBO Plus: money, love, life stages and the full reading. */
const PREMIUM_THEMES = new Set<Theme>(['money', 'love', 'age']);
const PREMIUM_POINTS = new Set(['money', 'love']);
type Theme = 'character' | 'money' | 'love' | 'age';
type Point = { id: string; value: number; label: string; hint: string; formula: string; copy: string; place: string };
type Screen = { kind: 'home' } | { kind: 'point'; point: Point } | { kind: 'theme'; theme: Theme } | { kind: 'full' };

const cap = (value: string) => value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
const formula = (values: number[], result: number) => `${values.join(' + ')} → ${result}`;
type NodeKind = 'axis' | 'center' | 'gold' | 'small' | 'pink';
/** Points on the 350px canvas diagram: x, y, the step it appears on, its look. */
const NODE_LAYOUT: Record<string, [number, number, number, NodeKind]> = {
  day: [28, 175, 1, 'axis'], month: [175, 28, 2, 'axis'], year: [322, 175, 3, 'axis'], base: [175, 322, 4, 'axis'], center: [175, 175, 5, 'center'],
  personal: [71, 71, 6, 'gold'], talents: [279, 71, 6, 'gold'], social: [279, 279, 6, 'gold'], past: [71, 279, 6, 'gold'],
  habit: [175, 268, 6, 'small'], purpose: [175, 228, 6, 'small'], money: [268, 228, 6, 'pink'], love: [228, 268, 6, 'pink'],
};

function Diagram({ points, step, onSelect }: { points: Point[]; step: number; onSelect: (point: Point) => void }) {
  const on = (needed: number) => (step >= needed ? 1 : 0);
  return <div className={styles.diagram} aria-label={MATRIX_TITLE.ru}>
    <svg width="350" height="350" viewBox="0 0 350 350" aria-hidden="true">
      <g opacity={on(2)}><polygon className={styles.diamond} points="28,175 175,28 322,175 175,322" /></g>
      <g opacity={on(6)}><rect className={styles.square} x="71" y="71" width="208" height="208" /></g>
      <g opacity={on(3)}><line x1="28" y1="175" x2="322" y2="175" /><line x1="175" y1="28" x2="175" y2="322" /></g>
      <g opacity={on(6)}><line x1="71" y1="71" x2="279" y2="279" /><line x1="279" y1="71" x2="71" y2="279" /></g>
      <g opacity={on(6)}><line className={styles.dash} x1="175" y1="322" x2="322" y2="175" /></g>
    </svg>
    {points.map((point) => {
      const [x, y, appears, kind] = NODE_LAYOUT[point.id];
      return <button key={point.id} type="button" aria-label={`${point.label}: ${point.value}`} data-kind={kind} data-on={step >= appears} className={styles.node} style={{ left: x, top: y }} onClick={() => onSelect(point)}>{point.value}</button>;
    })}
  </div>;
}

export function MatrixRoom({ profile, onBack, embedded = false, onRequestPremium, onOpenSegment }: Props) {
  const locked = Boolean(onRequestPremium) && !hasActivePremium(profile);
  const requestPremium = () => { lumiaSelectionHaptic(); onRequestPremium?.(); };
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
    const extra = (id: string, value: number, label: string, hint: string, f: string): Point => ({ id, value, label, hint, formula: f, copy: cap(text(value)), place: '' });
    const talents = reduceToArcana(month.arcana + year.arcana);
    const past = reduceToArcana(base.arcana + day.arcana);
    const habit = reduceToArcana(base.arcana + center.arcana);
    const purpose = reduceToArcana(habit + reduceToArcana(year.arcana + center.arcana));
    return [
      item('day', day, `${result.day} → ${day.arcana}`, 'Left'), item('month', month, `${result.month} → ${month.arcana}`, 'Top'),
      item('year', year, formula(String(result.year).split('').map(Number), year.arcana), 'Right'), item('base', base, formula([day.arcana, month.arcana, year.arcana], base.arcana), 'Bottom'),
      item('center', center, formula([day.arcana, month.arcana, year.arcana, base.arcana], center.arcana), 'Center'),
      item('personal', personal, formula([day.arcana, month.arcana], personal.arcana), 'TopLeft'),
      extra('talents', talents, ru ? 'Таланты' : tr('Talents'), ru ? 'Что даётся легче, чем другим' : tr('What comes easier to you'), formula([month.arcana, year.arcana], talents)),
      item('social', social, formula([year.arcana, base.arcana], social.arcana), 'BottomRight'),
      extra('past', past, ru ? 'Что тянется из прошлого' : tr('What comes from the past'), ru ? 'Привычки, которые повторяются' : tr('Habits that repeat'), formula([base.arcana, day.arcana], past)),
      extra('habit', habit, ru ? 'Привычки' : tr('Habits'), ru ? 'Как ты поступаешь не задумываясь' : tr('What you do without thinking'), formula([base.arcana, center.arcana], habit)),
      extra('purpose', purpose, ru ? 'Предназначение' : tr('Purpose'), ru ? 'К чему тебя тянет' : tr('What draws you'), `→ ${purpose}`),
      item('money', money, formula([month.arcana, base.arcana], money.arcana), 'BottomRight'), item('love', love, formula([day.arcana, personal.arcana], love.arcana), 'BottomLeft'),
    ];
  }, [result, ru]);
  const selected = points.find((point) => point.id === selectedId) || points.find((point) => point.id === 'center');
  // The points appear one by one, as on the canvas. Only the first time on this date, and not when motion is reduced.
  const [step, setStep] = useState(0);
  const [replay, setReplay] = useState(0);
  useEffect(() => {
    if (!result) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setStep(6); return undefined; }
    setStep(0);
    const timer = window.setInterval(() => setStep((value) => { if (value >= 6) { window.clearInterval(timer); return value; } return value + 1; }), 900);
    return () => window.clearInterval(timer);
  }, [result, replay]);

  const themes = useMemo(() => {
    if (!result) return null;
    const pos = (key: MatrixPosition['key']) => result.positions.find((item) => item.key === key)!;
    const area = (key: MatrixLifeArea['key']) => result.lifeAreas.find((item) => item.key === key)!;
    const text = (value: number) => getArcana(value)[ru ? 'essence' : 'essenceEn'];
    return {
      character: { title: ru ? 'Характер' : tr('Character'), lead: cap(text(pos('self').arcana)), blocks: [[ru ? 'Как ты действуешь' : tr('How you act'), text(pos('self').arcana)], [ru ? 'Сильная сторона' : tr('Strength'), text(pos('talents').arcana)], [ru ? 'Где можно не тащить всё самому' : tr('Where to share the load'), ru ? 'Когда хочется быстро навести порядок, полезно сначала проверить: это правда твоя задача?' : tr('Before taking over, check whether this is really your task.')]] },
      money: { title: ru ? 'Деньги' : tr('Money'), lead: cap(text(area('money').arcana)), blocks: [[ru ? 'Что здесь видно' : tr('What this shows'), text(area('money').arcana)], [ru ? 'На что смотреть' : tr('What to notice'), ru ? 'Сверяй результат не только с деньгами, но и с тем, сколько времени и сил он забирает.' : tr('Consider both the result and the time and energy it takes.')]] },
      love: { title: ru ? 'Отношения' : tr('Relationships'), lead: cap(text(area('love').arcana)), blocks: [[ru ? 'Что важно рядом с человеком' : tr('What matters with someone close'), text(area('love').arcana)], [ru ? 'Что лучше говорить вслух' : tr('What to say aloud'), ru ? 'Прямое объяснение часто бережёт больше, чем надежда, что тебя поймут без слов.' : tr('A direct explanation can be kinder than expecting a perfect guess.')]] },
      age: { title: ru ? 'По возрастам' : tr('By life stages'), lead: ru ? 'Не прогноз, а три точки, через которые можно посмотреть на свой опыт.' : tr('Not a forecast, three lenses for looking at your experience.'), blocks: [['18–24', text(pos('personalPurpose').arcana)], ['25–35', text(pos('socialPurpose').arcana)], [ru ? 'После 35' : tr('After 35'), text(pos('spiritualPurpose').arcana)]] },
    } as Record<Theme, { title: string; lead: string; blocks: string[][] }>;
  }, [result, ru]);

  const goHome = () => { lumiaSelectionHaptic(); setScreen({ kind: 'home' }); window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' })); };
  const calculate = () => { lumiaSelectionHaptic(); setCalculatedDate(date || null); setSelectedId('center'); setScreen({ kind: 'home' }); if (date) showActionFeedback(ACTION_FEEDBACK.done); };
  const title = screen.kind === 'point' ? screen.point.label : screen.kind === 'theme' && themes ? themes[screen.theme].title : screen.kind === 'full' ? (ru ? 'Полный разбор' : tr('Full reading')) : MATRIX_TITLE[lang];
  const internal = screen.kind !== 'home';
  useScreenBack(internal, goHome);

  if (!result || !selected || !themes) return <div className={`${embedded ? '' : 'fresh-page '} ${styles.page}`}>
    {!embedded && <><AppTopBar title={MATRIX_TITLE[lang]} main /><MyChartHeader title={MATRIX_TITLE[lang]} active="matrix" onOpen={(segment) => onOpenSegment?.(segment)} /></>}
    <main className={`${styles.content} ${scrollStyles.content}`}><h1>{MATRIX_TITLE[lang]}</h1><p className={styles.subhead}>{MATRIX_SUBTITLE[lang]}</p><label className={styles.dateField}>{ru ? 'Дата рождения' : tr('Birth date')}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><button type="button" className={styles.primary} disabled={!date} onClick={calculate}>{ru ? 'Рассчитать матрицу' : tr('Calculate matrix')}</button></main>
  </div>;

  const theme = screen.kind === 'theme' ? themes[screen.theme] : null;
  const moneyNumber = result.lifeAreas.find((item) => item.key === 'money')?.arcana;
  const loveNumber = result.lifeAreas.find((item) => item.key === 'love')?.arcana;
  const lockedLead = (key: Theme) => key === 'money'
    ? `Твоё число денег, ${moneyNumber}. Что оно значит, в NEBO Plus`
    : key === 'love'
      ? `Твоё число отношений, ${loveNumber}. Что оно значит, в NEBO Plus`
      : 'Три этапа жизни по твоей дате, в NEBO Plus';
  const chapters = [
    ['main', ru ? 'Главное' : tr('Main'), ru ? 'Главный вектор' : tr('Main direction'), selected.copy, ru ? 'Центр схемы помогает заметить повторяющийся способ действовать. Это не ярлык и не предсказание.' : tr('The center helps notice a repeating pattern, not label you.')],
    ['character', ru ? 'Характер' : tr('Character'), themes.character.title, themes.character.lead, themes.character.blocks[1][1]],
    ['strengths', ru ? 'Сильные стороны' : tr('Strengths'), ru ? 'На что можно опереться' : tr('What you can rely on'), themes.character.blocks[1][1], ru ? 'Сильная сторона полезнее всего, когда ты знаешь, где она помогает, а где заставляет делать всё одному.' : tr('Strength works best when you know where it helps and where it makes you do everything alone.')],
    ['money', ru ? 'Деньги' : tr('Money'), themes.money.title, themes.money.lead, themes.money.blocks[1][1]],
    ['love', ru ? 'Отношения' : tr('Relationships'), themes.love.title, themes.love.lead, themes.love.blocks[1][1]],
    ['friction', ru ? 'Что мешает' : tr('Friction'), ru ? 'Где бывает непросто' : tr('Where it can be hard'), themes.character.blocks[2][1], ru ? 'Это место, где полезно заранее заметить привычную реакцию, чтобы у тебя оставался выбор.' : tr('Spot the habit early enough to keep a choice.')],
    ['age', ru ? 'По возрастам' : tr('Life stages'), themes.age.title, themes.age.lead, themes.age.blocks.map(([age, copy]) => `${age}: ${copy}`).join(' ')],
    ['result', ru ? 'Итог' : tr('Takeaway'), ru ? 'Если собрать всё вместе' : tr('Putting it together'), themes.age.blocks[2][1], ru ? 'Матрица не предсказывает события и не решает за тебя. Это способ собрать наблюдения о себе в одну понятную картину.' : tr('The matrix does not predict events or decide for you.')],
  ];

  return <div className={`${embedded ? '' : 'fresh-page '} ${styles.page}`}>
    {!embedded && (internal
      ? <AppTopBar title={title} onBack={goHome} />
      : <><AppTopBar title={title} main /><MyChartHeader title={MATRIX_TITLE[lang]} active="matrix" onOpen={(segment) => onOpenSegment?.(segment)} /></>)}
    <main className={`${styles.content} ${scrollStyles.content}`}>
      {screen.kind === 'home' && (() => {
        const value = (id: string) => points.find((point) => point.id === id)?.value ?? 0;
        const stepLines: Array<[string, string]> = [
          [ru ? `Считаем по дате ${date.split('-').reverse().join('.')}` : `From the date ${date.split('-').reverse().join('.')}`, ru ? 'Начинаем с дня рождения' : tr('Starting with the birthday')],
          [ru ? 'Шаг 1 · День' : tr('Step 1 · Day'), `${ru ? 'Точка слева' : tr('Left point')}: ${value('day')}`],
          [ru ? 'Шаг 2 · Месяц' : tr('Step 2 · Month'), `${ru ? 'Точка сверху' : tr('Top point')}: ${value('month')}`],
          [ru ? 'Шаг 3 · Год' : tr('Step 3 · Year'), points.find((point) => point.id === 'year')?.formula ?? ''],
          [ru ? 'Шаг 4 · Сумма' : tr('Step 4 · Sum'), points.find((point) => point.id === 'base')?.formula ?? ''],
          [ru ? 'Шаг 5 · Центр' : tr('Step 5 · Center'), points.find((point) => point.id === 'center')?.formula ?? ''],
          [ru ? 'Готово · классическая методика' : tr('Done · the classic method'), ru ? 'Нажми на любой раздел, чтобы прочитать' : tr('Tap any section to read it')],
        ];
        const openPoint = (point: Point) => {
          if (locked && PREMIUM_POINTS.has(point.id)) { requestPremium(); return; }
          lumiaSelectionHaptic();
          setSelectedId(point.id);
          setScreen({ kind: 'point', point });
        };
        const centerArcana = getArcana(value('center'));
        const chips: Record<Theme, string> = { character: String(value('center')), money: String(value('money')), love: String(value('love')), age: '0-80' };
        return <>
          <Diagram points={points} step={step} onSelect={openPoint} />
          <div className={styles.stepLine}><span>{stepLines[Math.min(step, 6)][0]}</span><strong>{stepLines[Math.min(step, 6)][1]}</strong></div>
          <button type="button" className={styles.replay} onClick={() => { lumiaSelectionHaptic(); setReplay((value) => value + 1); }}>{ru ? 'Показать расчёт ещё раз' : tr('Show the calculation again')}</button>
          <section className={styles.centerBlock}>
            <p>{ru ? `Центр · ${value('center')} · аркан ${centerArcana.name}` : `Center · ${value('center')} · ${centerArcana.nameEn}`}</p>
            <h2>{cap(ru ? centerArcana.keyword : centerArcana.keywordEn)}</h2>
            <span>{cap(ru ? centerArcana.essence : centerArcana.essenceEn)}</span>
          </section>
          <section className={styles.sectionList}>
            {(Object.keys(themes) as Theme[]).map((key) => {
              const closed = locked && PREMIUM_THEMES.has(key);
              return <button type="button" key={key} onClick={() => { if (closed) { requestPremium(); return; } lumiaSelectionHaptic(); setScreen({ kind: 'theme', theme: key }); }}>
                <i data-closed={closed}>{chips[key]}</i>
                <span><strong>{themes[key].title}</strong><small>{closed ? lockedLead(key) : themes[key].lead}</small></span>
                {closed ? <LockKeyhole aria-hidden="true" size={16} /> : <ChevronRight aria-hidden="true" size={16} />}
              </button>;
            })}
            {locked ? <button type="button" className={styles.sectionCta} onClick={requestPremium}>{ru ? 'Вся матрица в Plus' : tr('The whole matrix in Plus')}</button> : <button type="button" key="full" onClick={() => { lumiaSelectionHaptic(); setScreen({ kind: 'full' }); }}>
                <i>8</i>
                <span><strong>{ru ? 'Полный разбор' : tr('Full reading')}</strong><small>{ru ? 'Восемь глав от главного до итога' : tr('Eight chapters, from the main point to the conclusion')}</small></span>
                <ChevronRight aria-hidden="true" size={16} />
              </button>}
          </section>
        </>;
      })()}
      {screen.kind === 'point' && <article className={styles.detail}><p className={styles.eyebrow}>{ru ? 'Точка матрицы' : tr('Matrix point')}</p><h1>{screen.point.label}</h1><p className={styles.lead}>{screen.point.hint}</p><section className={styles.formula}><small>{ru ? 'Как посчитано' : tr('How it is calculated')}</small><strong>{screen.point.formula}</strong></section><section><h2>{ru ? 'Что здесь видно' : tr('What this shows')}</h2><p>{screen.point.copy}</p></section><section><h2>{ru ? 'Как читать эту точку' : tr('How to read this point')}</h2><p>{ru ? 'Смотри на неё вместе с соседними числами: тогда схема остаётся понятной и не превращается в набор ярлыков.' : tr('Read it with the nearby numbers, not as a label on its own.')}</p></section><button type="button" className={styles.secondary} onClick={goHome}>{ru ? 'Вернуться к матрице' : tr('Back to matrix')}</button></article>}
      {screen.kind === 'theme' && theme && <article className={styles.detail}><p className={styles.eyebrow}>{ru ? 'Разбор' : tr('Reading')}</p><h1>{theme.title}</h1><p className={styles.lead}>{theme.lead}</p>{theme.blocks.map(([heading, copy]) => <section key={heading}><h2>{heading}</h2><p>{copy}</p></section>)}<button type="button" className={styles.secondary} onClick={goHome}>{ru ? 'Вернуться к матрице' : tr('Back to matrix')}</button></article>}
      {screen.kind === 'full' && <article className={styles.fullReading}><nav className={styles.chapterNav} aria-label={ru ? 'Главы разбора' : tr('Reading chapters')}>{[['main', ru ? 'Главное' : tr('Main')], ['character', ru ? 'Характер' : tr('Character')], ['money', ru ? 'Деньги' : tr('Money')], ['love', ru ? 'Отношения' : tr('Relationships')], ['age', ru ? 'Возраст' : tr('Age')]].map(([id, label]) => <button type="button" key={id} onClick={() => document.getElementById(`matrix-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{label}</button>)}</nav><section className={styles.fullIntro}><p>{ru ? 'Твоя общая картина' : tr('Your overall picture')}</p><h1>{ru ? 'Восемь глав, чтобы спокойно собрать схему воедино.' : tr('Eight chapters to put the diagram together.')}</h1><span>{ru ? 'Это развлекательная интерпретация даты рождения, а не прогноз.' : tr('This is an entertaining interpretation, not a prediction.')}</span></section>{chapters.map(([id, cap, heading, lead, copy]) => <section className={styles.chapter} id={`matrix-${id}`} key={id}><p>{cap}</p><h2>{heading}</h2><strong>{lead}</strong><span>{copy}</span></section>)}<button type="button" className={styles.secondary} onClick={goHome}>{ru ? 'Вернуться к матрице' : tr('Back to matrix')}</button></article>}
    </main>
  </div>;
}
