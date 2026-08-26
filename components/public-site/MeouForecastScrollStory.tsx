'use client';

import { useEffect, useRef, useState } from 'react';
import styles from '../../styles/PublicSite.module.css';

const forecasts = [
  {
    name: 'Максим',
    descriptor: 'мужчина',
    title: 'День без дублей',
    barb: 'Хватит репетировать решение — сцена давно ждёт, пока ты выйдешь.',
    body:
      'Сегодня один затянувшийся вопрос потребует не новых расчётов, а нормального ответа. Ты уже собрал достаточно фактов, но продолжаешь проверять их так, будто там спрятан государственный секрет. Как только выберешь один вариант и назовёшь его вслух, суета заметно сдуется. В общении прямота сработает лучше вежливых кругов вокруг очевидного. Не пытайся выглядеть безошибочным: сегодня убедительнее тот, кто говорит ясно и отвечает за свой выбор.',
    advice: 'Закрой один вопрос и не устраивай ему вторую жизнь.',
    accentClassName: styles.forecastPaperRed,
  },
  {
    name: 'Алина',
    descriptor: 'женщина',
    title: 'Чужой цирк закрыт',
    barb: 'Ты не служба спасения, особенно для тех, кто сам поджёг диван.',
    body:
      'Сегодня чужая срочность может снова попытаться въехать в твоё расписание без билета. Ты привыкла быстро подхватывать то, что другие бросили, а потом злиться на собственную добросовестность. На этот раз спокойное «нет» сохранит больше сил, чем героическая попытка всех выручить. В работе полезно закончить своё, прежде чем соглашаться на дополнительную нагрузку. В личном разговоре не объясняй границу пятью абзацами: одной честной фразы вполне достаточно. Свободное внимание лучше отдать задаче, которую ты действительно выбрала сама.',
    advice: 'Верни чужие проблемы владельцам и займись своим.',
    accentClassName: styles.forecastPaperYellow,
  },
] as const;

export function MeouForecastScrollStory() {
  const [activeIndex, setActiveIndex] = useState(0);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const closestEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!closestEntry) return;

        const nextIndex = Number((closestEntry.target as HTMLElement).dataset.forecastIndex);
        if (Number.isInteger(nextIndex)) setActiveIndex(nextIndex);
      },
      {
        rootMargin: '-18% 0px -32%',
        threshold: [0.25, 0.5, 0.75],
      },
    );

    stepRefs.current.forEach((step) => {
      if (step) observer.observe(step);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.forecastShowcase}>
      <aside className={styles.storyRail} aria-label="Навигация по примерам">
        <p className={styles.storyRailLabel}>Два человека. Два разных текста.</p>
        <div className={styles.storyIndex} aria-hidden="true">
          <span>0{activeIndex + 1}</span>
          <span>/ 02</span>
        </div>
        <p className={styles.storyActiveName} aria-hidden="true">
          {forecasts[activeIndex].name}
        </p>
        <div className={styles.storyProgress} aria-hidden="true">
          {forecasts.map((forecast, index) => (
            <span
              key={forecast.name}
              className={index === activeIndex ? styles.storyProgressActive : undefined}
            />
          ))}
        </div>
      </aside>

      <div className={styles.forecastStream}>
        {forecasts.map((forecast, index) => {
          const titleId = `forecast-example-${index + 1}`;
          const isActive = activeIndex === index;

          return (
            <div
              key={forecast.name}
              ref={(node) => {
                stepRefs.current[index] = node;
              }}
              className={styles.forecastStep}
              data-forecast-index={index}
            >
              <p className={styles.forecastIdentity}>
                Пример {index + 1}: {forecast.name}, {forecast.descriptor}
              </p>
              <article
                className={`${styles.forecastPaper} ${forecast.accentClassName} ${
                  isActive ? styles.forecastPaperActive : ''
                }`}
                aria-labelledby={titleId}
              >
                <header className={styles.forecastHeader}>
                  <div>
                    <p className={styles.forecastPeriod}>Сегодня</p>
                    <h3 id={titleId}>{forecast.title}</h3>
                  </div>
                  <div className={styles.forecastClock} aria-hidden="true">
                    <span />
                  </div>
                </header>

                <p className={styles.forecastBarb}>{forecast.barb}</p>
                <p className={styles.forecastBody}>{forecast.body}</p>

                <footer className={styles.forecastAdvice}>
                  <p>Совет дня</p>
                  <strong>{forecast.advice}</strong>
                </footer>
              </article>
            </div>
          );
        })}
      </div>
    </div>
  );
}
