import React from 'react';
import { Play } from 'lucide-react';
import { SOUND_GROUP_LABELS, SOUND_GROUPS } from '../../lib/soundscapes/library';
import { SLEEP_STORIES } from '../../lib/sleepStories';
import { SELF_TESTS } from '../../lib/selfTests/engine';
import { videoBackgroundPoster, type VideoBackgroundId } from '../../lib/videoBackgrounds';

const STORY_POSTERS: VideoBackgroundId[] = ['sleep-sea-house', 'sleep-night-train', 'sleep-garden-rain'];
const TEST_IMAGES: Record<string, string> = {
  love_language: '/assets/rest/test_love.webp',
  conflict: '/assets/rest/test_conflict.webp',
  recharge: '/assets/rest/test_battery.webp',
  temperament: '/assets/rest/test_rhythm.webp',
};
const TEST_TINTS = ['#ffe3e8', '#e3e8ff', '#dff4ea', '#fff0d6'];

type RestHomeProps = {
  onOpenSounds: () => void;
  onOpenStories: () => void;
  onOpenTests: (testId?: string) => void;
  onOpenAntistress: () => void;
  onOpenMoon?: () => void;
};

/** «Отдых» as on the canvas: the sea for sleep on top, then shelves of sounds, stories, tests and breathing. */
export function RestHome({ onOpenSounds, onOpenStories, onOpenTests, onOpenAntistress, onOpenMoon }: RestHomeProps) {
  return (
    <div className="nebo-rest-home">
      <div className="nebo-rest-head">
        <h1><span aria-hidden="true" />Отдых<span aria-hidden="true" /></h1>
        <p>Звуки, рассказы, тесты</p>
      </div>

      <button type="button" className="nebo-rest-hero" onClick={onOpenSounds} style={{ backgroundImage: `url(${videoBackgroundPoster('sounds-sea')})` }}>
        <span className="nebo-rest-hero-copy">
          <small>Звуки для сна · Море</small>
          <strong>Волны на пляже</strong>
          <span>20 минут, чтобы отдохнуть после дня, полного разговоров</span>
        </span>
        <span className="nebo-rest-play" aria-hidden="true"><Play size={20} fill="currentColor" /></span>
      </button>

      <section className="nebo-shelf" aria-labelledby="rest-sounds">
        <h2 id="rest-sounds">Звуки</h2>
        <div className="nebo-shelf-row">
          {SOUND_GROUPS.map((group) => (
            <button key={group} type="button" className="nebo-shelf-card" onClick={onOpenSounds}>
              <span className="nebo-shelf-art" style={{ backgroundImage: `url(${videoBackgroundPoster(`sounds-${group}` as VideoBackgroundId)})` }} />
              <strong>{SOUND_GROUP_LABELS[group].ru}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="nebo-shelf" aria-labelledby="rest-stories">
        <h2 id="rest-stories">Рассказы на ночь</h2>
        <div className="nebo-shelf-row">
          {SLEEP_STORIES.map((story, index) => (
            <button key={story.id} type="button" className="nebo-shelf-card is-tall" onClick={onOpenStories}>
              <span className="nebo-shelf-art" style={{ backgroundImage: `url(${videoBackgroundPoster(STORY_POSTERS[index % STORY_POSTERS.length])})` }} />
              <strong>{story.title.ru}</strong>
              <small>{story.free ? 'Сказка на ночь' : 'Plus'}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="nebo-shelf" aria-labelledby="rest-tests">
        <div className="nebo-shelf-head">
          <h2 id="rest-tests">Тесты</h2>
          <button type="button" onClick={() => onOpenTests()}>Все тесты</button>
        </div>
        <div className="nebo-shelf-row">
          {SELF_TESTS.map((test, index) => (
            <button key={test.id} type="button" className="nebo-test-card" style={{ background: TEST_TINTS[index % TEST_TINTS.length] }} onClick={() => onOpenTests(test.id)}>
              {index === 0 ? <span className="nebo-test-badge">Тест недели</span> : null}
              <img src={TEST_IMAGES[test.id] || '/assets/rest/test_friends.webp'} alt="" loading="lazy" />
              <strong>{test.title.ru}</strong>
              <small>{test.questions.length} вопросов · 2 мин</small>
            </button>
          ))}
        </div>
      </section>

      <section className="nebo-shelf" aria-labelledby="rest-calm">
        <h2 id="rest-calm">Антистресс и дыхание</h2>
        <div className="nebo-calm-grid">
          <button type="button" className="nebo-calm-card" onClick={onOpenAntistress}>
            <img src="/assets/rest/rest_breath.webp" alt="" loading="lazy" />
            <strong>Дыхание 3 минуты</strong>
            <small>вдох 4, выдох 6</small>
          </button>
          <button type="button" className="nebo-calm-card" onClick={onOpenAntistress}>
            <img src="/assets/rest/rest_bubbles.webp" alt="" loading="lazy" />
            <strong>Пузыри</strong>
            <small>лопать и выдыхать</small>
          </button>
        </div>
      </section>

      {onOpenMoon ? (
        <button type="button" className="nebo-rest-card nebo-rest-card--moon nebo-rest-moon" onClick={onOpenMoon}>
          <span className="nebo-rest-card-copy">
            <strong>Лунные календари</strong>
            <span>Сад, стрижка, здоровье, дела и дом по фазам Луны</span>
          </span>
        </button>
      ) : null}
    </div>
  );
}
