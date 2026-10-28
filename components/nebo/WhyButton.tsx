import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { ForecastSection } from '../../lib/personalForecastContract';
import { buildFutureMonth, natalPointsFromChart, type PersonalEvent } from '../../lib/futureCalendar';
import { buildLunarDays, phaseName, SIGNS_IN } from '../../lib/lunarCalendar';
import { loadExploreCharts } from '../PersonalForecastFeed/exploreCharts';

let engineModule: Promise<typeof import('astronomy-engine')> | null = null;

const PLANET_PLAIN: Record<PersonalEvent['planet'], string> = {
  Sun: 'Солнце, твоя энергия и воля',
  Venus: 'Венера, планета любви, красоты и удовольствий',
  Mars: 'Марс, планета сил, спешки и споров',
  Jupiter: 'Юпитер, планета удачи и роста',
  Saturn: 'Сатурн, планета порядка, сроков и терпения',
};
const POINT_PLAIN: Record<PersonalEvent['point'], string> = {
  sun: 'твоё Солнце (кто ты и чего хочешь)',
  moon: 'твою Луну (чувства и настроение)',
  venus: 'твою Венеру (любовь и то, что тебя радует)',
  mars: 'твой Марс (силы и напор)',
  ascendant: 'твой Асцендент (как тебя видят люди)',
};
const ASPECT_PLAIN: Record<PersonalEvent['aspect'], string> = {
  0: 'в соединении, то есть совсем рядом: усиливает',
  60: 'в секстиле: лёгкая помощь, если сделать шаг навстречу',
  90: 'в квадрате: трение и напряжение',
  120: 'в трине: мягкая связь, всё идёт легко',
  180: 'в оппозиции: тянет в разные стороны',
};
const MOON_SIGN_DAY = ['смелых решений', 'спокойных и надёжных дел', 'разговоров и новостей', 'дома и близких', 'когда легко быть заметным', 'точности и порядка', 'договорённостей и красоты', 'честных разговоров', 'планов и дороги', 'серьёзных дел', 'идей и друзей', 'мягкости и чувств'];

type Why = { title: string; sky: string; you: string; todo: string };

function actionOf(overview: ForecastSection | null): string {
  const action = overview?.actionText?.trim() || overview?.contentBlocks.find((block) => block.role === 'action')?.text.trim();
  return action || 'Сделай сегодня то, что давно откладывал, но без спешки и с запасом времени.';
}

/** «?» next to the forecast: why the day is like this, in three plain layers. Calculated on the device, no AI. */
export function WhyButton({ userId, dayKey, overview }: { userId: string; dayKey: string; overview: ForecastSection | null }) {
  const [why, setWhy] = useState<Why | null>(null);
  const [loading, setLoading] = useState(false);

  const open = async () => {
    if (loading) return;
    setLoading(true);
    try {
      engineModule ??= import('astronomy-engine');
      const [engine, charts] = await Promise.all([engineModule, loadExploreCharts(userId).catch(() => [])]);
      const natal = natalPointsFromChart(charts.find((chart) => chart.is_primary)?.chart_data ?? null);
      const [year, month] = dayKey.split('-').map(Number);
      const day = buildFutureMonth(engine, year, month, natal).days.find((item) => item.dayKey === dayKey);
      const moon = buildLunarDays(engine, new Date(`${dayKey}T12:00:00Z`), 1)[0];
      const event = day?.personal[0] ?? null;
      if (event) {
        setWhy({
          title: event.headline,
          sky: `${PLANET_PLAIN[event.planet]}, сегодня встречает ${POINT_PLAIN[event.point]}. Как это называют астрологи: ${ASPECT_PLAIN[event.aspect]}.`,
          you: `${event.body}.`,
          todo: actionOf(overview),
        });
      } else {
        setWhy({
          title: `Луна ${SIGNS_IN[moon.sign]}`,
          sky: `Сегодня Луна ${SIGNS_IN[moon.sign]}, ${phaseName(moon.phase).toLowerCase()}. Луна отвечает за настроение, поэтому день окрашен ею. ${day?.mercuryRetrograde ? 'Ещё Меркурий идёт назад: в словах и сроках легче запутаться.' : ''}`.trim(),
          you: `Это день ${MOON_SIGN_DAY[moon.sign]}. ${moon.waxing ? 'Луна растёт: легче начинать и добавлять.' : 'Луна убывает: легче заканчивать и отпускать.'}`,
          todo: actionOf(overview),
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" className="nebo-why-btn" onClick={() => { void open(); }} aria-label="Почему так" disabled={loading}>?</button>
      {why ? (
        <div className="nebo-sheet-scrim" role="presentation" onClick={() => setWhy(null)}>
          <div className="nebo-why" role="dialog" aria-modal="true" aria-label="Почему так" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="nebo-day-pop-close" onClick={() => setWhy(null)} aria-label="Закрыть"><X size={18} aria-hidden /></button>
            <p className="nebo-why-kicker">Почему так</p>
            <h2>{why.title}</h2>
            <ol className="nebo-why-steps">
              <li className="is-sky"><b>На небе</b><p>{why.sky}</p></li>
              <li className="is-you"><b>Для тебя</b><p>{why.you}</p></li>
              <li className="is-todo"><b>Что делать</b><p>{why.todo}</p></li>
            </ol>
            <button type="button" className="nebo-period-cta" onClick={() => setWhy(null)}>Понятно</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
