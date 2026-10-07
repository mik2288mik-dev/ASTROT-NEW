import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Armchair, BookHeart, Check, ChevronRight, Coffee, DoorClosed, Lamp, Lock, Monitor, Smartphone, SquareStack } from 'lucide-react';
import { hasActivePremium } from '../../lib/accessMatrix';
import type { UserProfile } from '../../types';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { weeklyDiarySummary } from '../../lib/antistressDiary';
import { VideoBackground } from '../../components/lumia-ui/VideoBackground';
import { MANNEQUIN_HINT, WoodenMannequin, type GuideStep, type MannequinPart } from '../../components/antistress/WoodenMannequin';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import {
  BODY_RELEASE_SECONDS,
  BODY_STEPS,
  BODY_TENSE_SECONDS,
  BREATH_TECHNIQUES,
  GROUNDING_STEPS,
  STRESS_HABITS,
  STRESS_MOODS,
  STRESS_TRIGGERS,
  type BreathTechnique,
  type DiaryEntry,
  type StressMood,
} from '../../lib/antistress';
import { SOUND_GROUP_LABELS, SOUND_GROUPS, tracksOfGroup, type SoundGroup } from '../../lib/soundscapes/library';
import { playSoundscape, setAmbientTimer, stopAmbient } from '../../services/ambientPlayer';
import { pausePlayback } from '../../services/audioPlayback';
import { loadFeatureState, peekFeatureState, saveFeatureState } from '../../services/featureStateService';

type Screen = 'hub' | 'breathe' | 'player' | 'body' | 'ground' | 'habits' | 'diary';

type AntistressRoomProps = {
  profile: UserProfile;
  onBack: () => void;
  /** Opens the app's own «Звуки» room. */
  onOpenSounds: () => void;
  /** Opens NEBO Premium for the locked techniques. */
  onRequestPremium?: () => void;
};

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function dayKeyOf(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function lastSevenDays(): string[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (6 - index));
    return dayKeyOf(day);
  });
}

/** Live pictures on the four hub tiles. */
function TileBreath() {
  const [inhale, setInhale] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setInhale((value) => !value), inhale ? 4000 : 6000);
    return () => window.clearTimeout(timer);
  }, [inhale]);
  return (
    <span className="as-vis" aria-hidden="true">
      <span className={`as-mini-orb${inhale ? ' is-in' : ''}`}><i /><i /><b>{inhale ? 'Вдох' : 'Выдох'}</b></span>
    </span>
  );
}

function TileBody() {
  const [step, setStep] = useState(0);
  const [released, setReleased] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (released) { setReleased(false); setStep((value) => (value + 1) % STEP_PARTS.length); } else setReleased(true);
    }, released ? 1300 : 1100);
    return () => window.clearTimeout(timer);
  }, [released, step]);
  return (
    <span className="as-vis" aria-hidden="true">
      <WoodenMannequin interactive={false} className="as-mini-figure" tint={{ parts: STEP_PARTS[step], state: released ? 'release' : 'tense' }} />
    </span>
  );
}

const GROUND_THINGS = [
  { Icon: Armchair, word: 'стул' }, { Icon: Monitor, word: 'экран' }, { Icon: DoorClosed, word: 'шкаф' },
  { Icon: SquareStack, word: 'пол' }, { Icon: Smartphone, word: 'телефон' }, { Icon: Lamp, word: 'лампа' }, { Icon: Coffee, word: 'кружка' },
];

function TileGround() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % GROUND_THINGS.length), 1700);
    return () => window.clearInterval(timer);
  }, []);
  const { Icon, word } = GROUND_THINGS[index];
  return (
    <span className="as-vis" aria-hidden="true">
      <span key={index} className="as-pop is-col"><span className="as-bubble"><Icon size={30} strokeWidth={1.8} /></span><em>{word}</em></span>
    </span>
  );
}

const TILE_SOUNDS = ['Дождь', 'Море', 'Костёр', 'Лес'];

function TileSounds() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % TILE_SOUNDS.length), 2400);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <span className="as-vis" aria-hidden="true">
      <span className="as-eq">{Array.from({ length: 13 }, (_, k) => <i key={k} style={{ animationDelay: `${((k * 7) % 11) * -0.1}s` }} />)}</span>
      <em key={index} className="as-pop">{TILE_SOUNDS[index]}</em>
    </span>
  );
}

/** Which parts of the figure each relaxation step lights up (same order as BODY_STEPS). */
const STEP_PARTS: readonly (readonly MannequinPart[])[] = [
  ['handL', 'handR'], ['shoulderL', 'shoulderR'], ['head'], ['belly', 'chest'], ['thighL', 'thighR'], ['footL', 'footR'],
];

function ScaleButtons({ value, onChange, label }: { value: number; onChange: (next: number) => void; label: string }) {
  return (
    <div className="as-scale" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} className={value === n ? 'is-on' : ''} onClick={() => { lumiaSelectionHaptic(); onChange(n); }}>
          {n}
        </button>
      ))}
    </div>
  );
}

function InfoBlock({ technique }: { technique: BreathTechnique }) {
  return (
    <div className="as-card as-info">
      <div><h3>Как это работает</h3><p>{technique.why}</p></div>
      <div><h3>Как делать</h3><ol>{technique.how.map((item) => <li key={item}>{item}</li>)}</ol></div>
      <div><h3>Когда помогает</h3><ul>{technique.when.map((item) => <li key={item}>{item}</li>)}</ul></div>
      <p className="as-fact"><b>Факт.</b> {technique.fact}{technique.source ? <> <a href={technique.source} target="_blank" rel="noopener noreferrer">Источник</a></> : null}</p>
    </div>
  );
}

function BreathPlayer({ technique, auto, onExit }: { technique: BreathTechnique; auto: boolean; onExit: () => void }) {
  const [stage, setStage] = useState<'before' | 'run' | 'after'>(auto ? 'run' : 'before');
  const [before, setBefore] = useState(auto ? 4 : 0);
  const [after, setAfter] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [count, setCount] = useState(0);
  const [left, setLeft] = useState(technique.minutes * 60);
  const [sound, setSound] = useState<SoundGroup | null>(null);
  // The circle starts small and then grows, so the first in-breath is animated too.
  const [armed, setArmed] = useState(false);
  const startedAt = useRef(0);
  const phase = technique.phases[phaseIndex % technique.phases.length];

  const finish = useCallback(() => { setStage('after'); stopAmbient(); setSound(null); }, []);

  useEffect(() => {
    if (stage !== 'run') return undefined;
    startedAt.current = Date.now();
    setPhaseIndex(0);
    setLeft(technique.minutes * 60);
    const total = technique.minutes * 60;
    let phaseEnd = Date.now() + technique.phases[0].seconds * 1000;
    let index = 0;
    const timer = window.setInterval(() => {
      const now = Date.now();
      if (now >= phaseEnd) {
        index += 1;
        const next = technique.phases[index % technique.phases.length];
        phaseEnd = now + next.seconds * 1000;
        setPhaseIndex(index);
        try { if (navigator.vibrate && next.kind !== 'hold') navigator.vibrate(next.kind === 'in' ? [30] : [20, 60, 20]); } catch { /* no vibration */ }
      }
      setCount(Math.max(1, Math.ceil((phaseEnd - now) / 1000)));
      const remaining = Math.max(0, total - (now - startedAt.current) / 1000);
      setLeft(remaining);
      if (remaining <= 0) finish();
    }, 200);
    return () => window.clearInterval(timer);
  }, [stage, technique, finish]);

  useEffect(() => {
    if (stage !== 'run') { setArmed(false); return undefined; }
    const frame = window.requestAnimationFrame(() => window.requestAnimationFrame(() => setArmed(true)));
    return () => window.cancelAnimationFrame(frame);
  }, [stage]);

  useEffect(() => () => { stopAmbient(); }, []);

  const pickSound = (group: SoundGroup | null) => {
    lumiaSelectionHaptic();
    setSound(group);
    if (!group) { stopAmbient(); return; }
    pausePlayback();
    playSoundscape(tracksOfGroup(group)[0].id);
    setAmbientTimer(technique.minutes + 1);
  };

  const diff = before - after;
  const clock = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;

  if (stage === 'run') {
    return (
      <section className="as-run" aria-label={technique.name}>
        <VideoBackground id="breathing" scrim="bottom" />
        <div className="as-run-body">
          <h2>{technique.name}</h2>
          <p>Круг растёт: вдыхай. Круг сжимается: выдыхай. Просто следи за ним.</p>
          <div className="as-orb-stage">
            <span
              className={`as-orb is-${phase.kind}`}
              style={{ ['--orb-size' as string]: String(armed ? 0.58 + (phase.size - 0.5) * 0.84 : 0.5), ['--orb-ms' as string]: `${phase.seconds * 1000}ms` }}
              aria-hidden="true"
            />
            <div className="as-orb-label" aria-live="polite"><strong>{phase.label}</strong><small>{count}</small></div>
          </div>
          <p className="as-hint">{phase.hint ?? ''}</p>
          <p className="as-left">Осталось {clock}</p>
          <div className="as-chips" role="radiogroup" aria-label="Звук для дыхания">
            <button type="button" role="radio" aria-checked={sound === null} className={sound === null ? 'is-on' : ''} onClick={() => pickSound(null)}>Без звука</button>
            {SOUND_GROUPS.map((group) => (
              <button key={group} type="button" role="radio" aria-checked={sound === group} className={sound === group ? 'is-on' : ''} onClick={() => pickSound(group)}>
                {SOUND_GROUP_LABELS[group].ru}
              </button>
            ))}
          </div>
          <button type="button" className="as-btn is-dark" onClick={finish}>Закончить</button>
        </div>
      </section>
    );
  }

  if (stage === 'after') {
    return (
      <section className="as-card as-stack">
        <h2>Готово. Как сейчас?</h2>
        <ScaleButtons value={after} onChange={setAfter} label="Напряжение после" />
        {after ? (
          <p>{diff > 0 ? `Напряжение снизилось на ${diff} ${diff === 1 ? 'пункт' : 'пункта'}.` : diff === 0 ? 'Без изменений. Попробуй другую технику или тело.' : 'Стало сильнее. Это бывает, попробуй «Здесь и сейчас».'}</p>
        ) : <p className="as-mute">1, спокойно, 5, на пределе</p>}
        <button type="button" className="as-btn" onClick={onExit}>На главную</button>
      </section>
    );
  }

  return (
    <>
      <InfoBlock technique={technique} />
      <section className="as-card as-stack">
        <h2>Насколько напряжён(а) сейчас?</h2>
        <ScaleButtons value={before} onChange={setBefore} label="Напряжение до" />
        <p className="as-mute">1, спокойно, 5, на пределе</p>
        <button type="button" className="as-btn is-blue" disabled={!before} onClick={() => setStage('run')}>Начать</button>
      </section>
    </>
  );
}

function BodyPractice() {
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [poseKey, setPoseKey] = useState(0);
  const total = BODY_TENSE_SECONDS + BODY_RELEASE_SECONDS;

  useEffect(() => {
    if (!started || paused || done) return undefined;
    const timer = window.setInterval(() => {
      setElapsed((value) => {
        const next = value + 0.1;
        if (next < total) return next;
        setStep((current) => {
          if (current + 1 >= BODY_STEPS.length) { setDone(true); setStarted(false); return 0; }
          return current + 1;
        });
        return 0;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [started, paused, done, total]);

  const reset = () => { setStarted(false); setPaused(false); setStep(0); setElapsed(0); setDone(false); };
  const tensing = elapsed < BODY_TENSE_SECONDS;
  const current = BODY_STEPS[step];
  const state = !started ? 'idle' : tensing ? 'tense' : 'release';
  const secondsLeft = Math.ceil((tensing ? BODY_TENSE_SECONDS : total) - elapsed + 0.001);

  return (
    <>
      <section className="as-card as-stack as-center">
        <div className="as-steps" aria-hidden="true">{BODY_STEPS.map((item, index) => <i key={item.name} className={done || index < step ? 'is-done' : index === step && started ? 'is-cur' : ''} />)}</div>
        <span className="as-mute">{done ? 'Готово' : `Шаг ${step + 1} из ${BODY_STEPS.length}`}</span>
        <WoodenMannequin
          key={poseKey}
          className="as-figure"
          guide={started ? { step: step as GuideStep, state } : null}
          tint={started || done ? { parts: done ? [] : STEP_PARTS[step], state } : { parts: STEP_PARTS[step], state: 'idle' }}
        />
        {!started ? <p className="as-mute as-hint-line">{MANNEQUIN_HINT} <button type="button" className="as-reset" onClick={() => setPoseKey((value) => value + 1)}>Сбросить позу</button></p> : null}
        <h2>{done ? 'Всё тело отпущено' : current.name}</h2>
        <p className="as-phase">{done ? 'Посиди ещё минуту и подыши спокойно' : !started ? 'Нажми «Начать»' : tensing ? current.tense : 'Отпусти и почувствуй тепло'}</p>
        {started ? <div className={`as-bignum ${tensing ? 'is-tense' : 'is-release'}`}>{secondsLeft}</div> : null}
        <div className="as-progress"><div style={{ width: `${done ? 100 : (elapsed / total) * 100}%` }} /></div>
        <div className="as-row-buttons">
          {!started ? <button type="button" className="as-btn is-blue" onClick={() => { reset(); setStarted(true); }}>{done ? 'Пройти заново' : 'Начать'}</button> : (
            <>
              <button type="button" className="as-btn is-blue" onClick={() => setPaused((value) => !value)}>{paused ? 'Продолжить' : 'Пауза'}</button>
              <button type="button" className="as-btn is-ghost" onClick={() => { setStep((value) => Math.min(BODY_STEPS.length - 1, value + 1)); setElapsed(0); }}>Дальше</button>
              <button type="button" className="as-btn is-ghost" onClick={reset}>Стоп</button>
            </>
          )}
        </div>
      </section>
      <details className="as-card as-info">
        <summary>Как это работает и когда помогает</summary>
        <div>
          <h3>Как делать</h3>
          <ol>
            <li>Сядь или ляг, плечи опусти</li>
            <li>Когда зона на фигуре станет красной и сожмётся, сожми эту мышцу на 5 секунд, не до боли</li>
            <li>Когда станет зелёной и расправится, резко отпусти и 10 секунд чувствуй разницу</li>
          </ol>
          <h3>Почему работает</h3>
          <p>Под стрессом мы незаметно зажимаем плечи, челюсть, живот. Если сначала сильно напрячь мышцу, а потом отпустить, она расслабляется глубже, чем от команды «расслабься». Заодно учишься замечать, где копится напряжение.</p>
          <h3>Когда помогает</h3>
          <ul><li>Вечером после тяжёлого дня</li><li>Тело зажато, а голова не отпускает</li><li>Перед сном, если дыхание не идёт</li></ul>
          <p className="as-fact"><b>Факт.</b> Метод придумал врач Эдмунд Джейкобсон в 1920-х. В исследованиях он снижает тревогу и давление и даёт заметный эффект уже после первого занятия. <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC8272667/" target="_blank" rel="noopener noreferrer">Источник</a></p>
          <p className="as-warn">Если есть травма или боль в какой-то мышце, пропусти её или напрягай совсем слегка.</p>
        </div>
      </details>
    </>
  );
}

function Grounding() {
  const [index, setIndex] = useState(0);
  const [found, setFound] = useState(0);
  const finished = index >= GROUNDING_STEPS.length;
  const step = GROUNDING_STEPS[Math.min(index, GROUNDING_STEPS.length - 1)];

  const mark = () => {
    lumiaSelectionHaptic();
    const next = found + 1;
    setFound(next);
    if (next >= step.count) window.setTimeout(() => { setIndex((value) => value + 1); setFound(0); }, 350);
  };

  return (
    <>
      <div className="as-card as-info">
        <div><h3>Как это работает</h3><p>Тревожный мозг живёт в «а вдруг» и «что будет». Когда ты ищешь глазами, ушами и руками реальные вещи вокруг, внимание возвращается в сейчас, и накрутка слабеет.</p></div>
        <div><h3>Когда помогает</h3><ul><li>Мысли идут по кругу</li><li>Внутри гонка, хотя никуда не опаздываешь</li><li>Паника, когда трудно дышать по счёту</li></ul></div>
        <p className="as-fact"><b>Факт.</b> Приём из когнитивной терапии. Его дают людям с паникой как быстрый навык, потому что он работает без подготовки.</p>
        <p className="as-warn">Нажимай на каждую найденную вещь. Называй их про себя или вслух.</p>
      </div>
      <section className="as-card as-stack">
        <div className="as-ground-head">
          <div className="as-bignum">{finished ? 0 : step.count}</div>
          <div><h2>{finished ? 'Ты здесь' : step.title}</h2><p className="as-mute">{finished ? 'Вернулось ощущение места и времени. Если мысли снова закрутят, пройди ещё раз.' : step.hint}</p></div>
        </div>
        {finished ? (
          <button type="button" className="as-btn is-ghost" onClick={() => { setIndex(0); setFound(0); }}>Пройти заново</button>
        ) : (
          <div className="as-sense">
            {Array.from({ length: step.count }, (_, k) => (
              <button key={`${index}-${k}`} type="button" className={k < found ? 'is-on' : ''} aria-pressed={k < found} disabled={k !== found} onClick={mark}>Нашёл(а) {k + 1}</button>
            ))}
          </div>
        )}
        <div className="as-progress"><div style={{ width: `${(Math.min(index, GROUNDING_STEPS.length) / GROUNDING_STEPS.length) * 100}%` }} /></div>
      </section>
    </>
  );
}

function Habits({ userId, today }: { userId: string; today: string }) {
  const key = `habits:${today}`;
  const [done, setDone] = useState<number[]>(() => (peekFeatureState(userId, 'antistress')[key] as number[] | undefined) ?? []);
  useEffect(() => {
    let active = true;
    void loadFeatureState(userId, 'antistress').then((items) => { if (active && Array.isArray(items[key])) setDone(items[key] as number[]); });
    return () => { active = false; };
  }, [userId, key]);
  const toggle = (index: number) => {
    lumiaSelectionHaptic();
    const next = done.includes(index) ? done.filter((item) => item !== index) : [...done, index];
    setDone(next);
    void saveFeatureState(userId, 'antistress', key, next);
  };
  return (
    <>
      <div className="as-card as-info">
        <div><h3>Зачем</h3><p>Дыхание помогает в моменте, а привычки снижают общий фон стресса. Когда выспался, поел и подвигался, срывов меньше. Берём только то, что делается за минуту или две.</p></div>
        <p className="as-warn">Это общие советы, не диета и не лечение.</p>
      </div>
      <div className="as-list">
        {STRESS_HABITS.map((habit, index) => (
          <button key={habit.title} type="button" className={`as-habit${done.includes(index) ? ' is-on' : ''}`} aria-pressed={done.includes(index)} onClick={() => toggle(index)}>
            <span className="as-check"><Check size={16} strokeWidth={3} aria-hidden="true" /></span>
            <span><b>{habit.title}</b><small>{habit.why}</small></span>
          </button>
        ))}
      </div>
      <p className="as-mute as-center-text">Сегодня выполнено {done.length} из {STRESS_HABITS.length}</p>
    </>
  );
}

function Diary({ userId, today }: { userId: string; today: string }) {
  const days = useMemo(lastSevenDays, []);
  const [entries, setEntries] = useState<Record<string, DiaryEntry>>(() => {
    const items = peekFeatureState(userId, 'antistress');
    return Object.fromEntries(days.filter((day) => items[`diary:${day}`]).map((day) => [day, items[`diary:${day}`] as DiaryEntry]));
  });
  const [level, setLevel] = useState(entries[today]?.level ?? 0);
  const [causes, setCauses] = useState<string[]>(entries[today]?.causes ?? []);
  const [own, setOwn] = useState('');
  const [custom, setCustom] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void loadFeatureState(userId, 'antistress').then((items) => {
      if (!active) return;
      const loaded = Object.fromEntries(days.filter((day) => items[`diary:${day}`]).map((day) => [day, items[`diary:${day}`] as DiaryEntry]));
      setEntries(loaded);
      if (loaded[today]) { setLevel(loaded[today].level); setCauses(loaded[today].causes); }
    });
    return () => { active = false; };
  }, [userId, days, today]);

  const toggleCause = (cause: string) => setCauses((current) => (current.includes(cause) ? current.filter((item) => item !== cause) : [...current, cause]));
  const addOwn = () => {
    const value = own.trim();
    if (!value) return;
    setCustom((current) => (current.includes(value) ? current : [...current, value]));
    setCauses((current) => (current.includes(value) ? current : [...current, value]));
    setOwn('');
  };
  const save = () => {
    if (!level) { setMessage('Сначала отметь уровень от 1 до 5.'); return; }
    const entry: DiaryEntry = { level, causes };
    setEntries((current) => ({ ...current, [today]: entry }));
    void saveFeatureState(userId, 'antistress', `diary:${today}`, entry);
    setMessage(`Записано: ${level} из 5${causes.length ? `, причины: ${causes.join(', ')}` : ''}.`);
  };
  const summary = useMemo(() => weeklyDiarySummary(days.map((day) => {
    const entry = entries[day];
    const value = day === today ? level || entry?.level || 0 : entry?.level ?? 0;
    return { day, level: value, causes: day === today ? causes : entry?.causes ?? [] };
  })), [days, entries, today, level, causes]);
  const frequent = useMemo(() => {
    const counts = new Map<string, number>();
    Object.values(entries).forEach((entry) => entry.causes.forEach((cause) => counts.set(cause, (counts.get(cause) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [entries]);

  return (
    <>
      <div className="as-card as-info">
        <div><h3>Зачем дневник</h3><p>Стресс кажется «просто плохим днём», пока не видишь его по дням. Отмечай уровень и причину за 10 секунд. Через неделю станет видно, что тебя выбивает и в какие дни, и под это можно подбирать технику.</p></div>
        <p className="as-fact"><b>Факт.</b> С тем, что названо, справляться легче. Простая отметка «что выбило» уже снижает ощущение хаоса.</p>
      </div>
      <section className="as-card as-stack">
        <h2>Неделя</h2>
        <div className="as-bars">
          {days.map((day) => {
            const value = day === today ? level || entries[day]?.level || 0 : entries[day]?.level ?? 0;
            const date = new Date(`${day}T12:00:00`);
            return <div key={day}><i className={day === today ? 'is-now' : ''} style={{ height: `${value ? value * 18 + 10 : 6}px` }} />{WEEKDAYS[(date.getDay() + 6) % 7]}</div>;
          })}
        </div>
        <div className="as-summary" aria-label="Разбор недели">
          {summary.map((line) => <p key={line}>{line}</p>)}
        </div>
        {frequent.length ? <p className="as-mute">Чаще всего выбивало: {frequent.map(([cause, count]) => `${cause} (${count})`).join(', ')}.</p> : <p className="as-mute">Отметки появятся здесь по мере записей.</p>}
      </section>
      <section className="as-card as-stack">
        <h2>Как сегодня с напряжением?</h2>
        <ScaleButtons value={level} onChange={setLevel} label="Уровень напряжения" />
        <h3>Что выбило</h3>
        <div className="as-chips is-left">
          {[...STRESS_TRIGGERS, ...custom].map((cause) => (
            <button key={cause} type="button" className={causes.includes(cause) ? 'is-on' : ''} aria-pressed={causes.includes(cause)} onClick={() => toggleCause(cause)}>{cause}</button>
          ))}
        </div>
        <div className="as-own">
          <input value={own} maxLength={28} placeholder="Своя причина" onChange={(event) => setOwn(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addOwn(); }} />
          <button type="button" className="as-btn is-ghost" onClick={addOwn}>Добавить</button>
        </div>
        <button type="button" className="as-btn is-blue" onClick={save}>Сохранить</button>
        {message ? <p role="status">{message}</p> : null}
      </section>
    </>
  );
}

export function AntistressRoom({ profile, onBack, onOpenSounds, onRequestPremium }: AntistressRoomProps) {
  const userId = String(profile.id || 'guest');
  const premium = hasActivePremium(profile);
  const today = useMemo(() => dayKeyOf(new Date()), []);
  const [screen, setScreen] = useState<Screen>('hub');
  const [technique, setTechnique] = useState<BreathTechnique>(BREATH_TECHNIQUES[0]);
  const [auto, setAuto] = useState(false);
  const [mood, setMood] = useState<StressMood | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  // Every inner screen opens at its top, not where the previous one was scrolled to.
  useEffect(() => {
    const scroller = rootRef.current?.closest('.lumia-main-scroll');
    if (scroller instanceof HTMLElement) scroller.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [screen, technique.id]);

  // Free: the two-minute breathing (also the red button). Everything else comes with NEBO Premium.
  const go = (next: Screen) => {
    lumiaSelectionHaptic();
    if (!premium && (next === 'body' || next === 'ground' || next === 'habits' || next === 'diary')) {
      onRequestPremium?.();
      return;
    }
    setScreen(next);
  };
  const openTechnique = (id: string, immediately = false) => {
    if (!premium && id !== 'sigh') {
      lumiaSelectionHaptic();
      onRequestPremium?.();
      return;
    }
    setTechnique(BREATH_TECHNIQUES.find((item) => item.id === id) ?? BREATH_TECHNIQUES[0]);
    setAuto(immediately);
    go('player');
  };
  const runAction = (action: StressMood['action']) => {
    if (action.type === 'breath') openTechnique(action.id);
    else go(action.type);
  };
  const titles: Record<Screen, string> = {
    hub: 'Антистресс', breathe: 'Дыхание', player: technique.name, body: 'Тело', ground: 'Здесь и сейчас', habits: 'Привычки', diary: 'Дневник напряжения',
  };
  const back = () => {
    if (screen === 'hub') onBack();
    else if (screen === 'player') setScreen('breathe');
    else setScreen('hub');
  };

  return (
    <div ref={rootRef} className="fresh-page antistress-room">
      <AppTopBar title={titles[screen]} onBack={back} />
      {screen === 'hub' ? (
        <>
          <section className="as-head">
            <h1>Антистресс</h1>
            <p>Выбери, как тебе сейчас, и получишь то, что поможет.</p>
          </section>
          <button type="button" className="as-sos" onClick={() => openTechnique('sigh', true)}>
            <b>Мне плохо прямо сейчас</b>
            <span>Двухминутное дыхание. Одно касание, без выбора.</span>
          </button>
          <section className="as-card as-stack">
            <h2>Что с тобой сейчас?</h2>
            <div className="as-chips is-left" role="radiogroup" aria-label="Состояние">
              {STRESS_MOODS.map((item) => (
                <button key={item.id} type="button" role="radio" aria-checked={mood?.id === item.id} className={mood?.id === item.id ? 'is-on' : ''} onClick={() => { lumiaSelectionHaptic(); setMood(item); }}>{item.label}</button>
              ))}
            </div>
          </section>
          {mood ? (
            <section className="as-rec">
              <small>Подойдёт тебе сейчас</small>
              <h2>{mood.title}</h2>
              <p>{mood.text}</p>
              <button type="button" className="as-btn is-light" onClick={() => runAction(mood.action)}>Начать</button>
              {mood.second ? <button type="button" className="as-btn is-glass" onClick={() => runAction(mood.second!.action)}>{mood.second.label}</button> : null}
              {mood.warning ? <p className="as-rec-warn">{mood.warning}</p> : null}
            </section>
          ) : null}
          <div className="as-card as-info">
            <div><h3>Как пользоваться разделом</h3><p>Стресс бывает разный, и помогает разное. Если накрыло прямо сейчас, нажми красную кнопку. Если хочешь разобраться, выбери состояние. Если хочешь стать устойчивее, делай по 2–5 минут в день и веди дневник.</p></div>
            <p className="as-warn">Это приёмы самопомощи, не лечение. Если тревога держится неделями или бывают приступы паники, обратись к врачу или психологу.</p>
          </div>
          <div className="as-grid">
            <button type="button" className="as-tile is-blue" onClick={() => go('breathe')}><TileBreath /><b>Дыхание</b><span>{premium ? '5 техник, от 1 минуты' : '1 бесплатно, ещё 4 с Premium'}</span></button>
            <button type="button" className="as-tile is-violet" onClick={() => go('body')}><TileBody /><b>Тело</b><span>{premium ? 'Снять зажимы, 6 минут' : 'С NEBO Premium'}</span></button>
            <button type="button" className="as-tile is-mint" onClick={() => go('ground')}><TileGround /><b>Здесь и сейчас</b><span>{premium ? 'Остановить мысли по кругу' : 'С NEBO Premium'}</span></button>
            <button type="button" className="as-tile is-coral" onClick={() => { lumiaSelectionHaptic(); onOpenSounds(); }}><TileSounds /><b>Звуки</b><span>Дождь, море, истории</span></button>
          </div>
          <button type="button" className="as-link" onClick={() => go('habits')}><span className="as-dot is-mint"><Check size={18} aria-hidden="true" /></span><span><b>Привычки против стресса</b><small>{premium ? 'Прогулка, вода, кофе, экран перед сном' : 'С NEBO Premium'}</small></span>{premium ? <ChevronRight size={18} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}</button>
          <button type="button" className="as-link" onClick={() => go('diary')}><span className="as-dot is-blue"><BookHeart size={18} aria-hidden="true" /></span><span><b>Дневник напряжения</b><small>{premium ? 'Что тебя выбивает и когда' : 'С NEBO Premium'}</small></span>{premium ? <ChevronRight size={18} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}</button>
        </>
      ) : null}

      {screen === 'breathe' ? (
        <>
          <div className="as-card as-info">
            <div><h3>Почему дыхание</h3><p>Дыханием можно управлять руками, а пульсом нет. Когда выдох длиннее вдоха, пульс замедляется, и телу приходит сигнал, что опасности нет. Эффект чувствуется за 1–2 минуты.</p></div>
            <p className="as-fact"><b>Исследование.</b> В 2023 году Стэнфорд сравнил 5 минут в день разных практик на 111 людях в течение месяца. Лучше всего подняло настроение и снизило тревогу циклическое вздыхание (первая техника ниже), причём лучше, чем медитация. <a href="https://stanmed.stanford.edu/cyclic-sighing-stress-relief/" target="_blank" rel="noopener noreferrer">Источник</a></p>
          </div>
          <div className="as-list">
            {BREATH_TECHNIQUES.map((item) => (
              <button key={item.id} type="button" className="as-link" onClick={() => openTechnique(item.id)}>
                <span className="as-dot is-blue as-min">{item.minutes} мин</span>
                <span><b>{item.name}</b><small>{premium || item.id === 'sigh' ? item.forWhom : 'С NEBO Premium'}</small></span>
                {premium || item.id === 'sigh' ? <ChevronRight size={18} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
              </button>
            ))}
          </div>
          <p className="as-mute as-center-text">Если кружится голова, дыши обычно и сделай паузу.</p>
        </>
      ) : null}

      {screen === 'player' ? <BreathPlayer key={`${technique.id}-${auto}`} technique={technique} auto={auto} onExit={() => setScreen('hub')} /> : null}
      {screen === 'body' ? <BodyPractice /> : null}
      {screen === 'ground' ? <Grounding /> : null}
      {screen === 'habits' ? <Habits userId={userId} today={today} /> : null}
      {screen === 'diary' ? <Diary userId={userId} today={today} /> : null}
    </div>
  );
}
