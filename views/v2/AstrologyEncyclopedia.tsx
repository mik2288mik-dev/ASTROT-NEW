import React, { useMemo, useRef, useState } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import type { UserProfile } from '../../types';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { PlanetIcon } from '../../components/icons/PlanetIcon';
import {
  EditorialCurve,
  EditorialProfileButton,
} from '../../components/editorial/EditorialScreenChrome';

type EncyclopediaTopic = {
  id: string;
  title: string;
  eyebrow: string;
  tags: string[];
  paragraphs: string[];
  simple: string;
};

const TOPICS_RU: EncyclopediaTopic[] = [
  {
    id: 'mercury-retrograde',
    title: 'Меркурий ретроградный',
    eyebrow: 'Наблюдаемое движение',
    tags: ['Планета', 'Коммуникации'],
    paragraphs: [
      'Это кажущееся обратное движение Меркурия с точки зрения Земли. В астрологической традиции этот период связывают с более медленным темпом в общении, информации, транспорте и технике.',
      'Это не «плохое» время, а повод перепроверить договорённости, вернуться к незавершённому и оставить решениям чуть больше пространства.',
    ],
    simple: 'Полезно не торопить ясность: перечитать сообщение, уточнить адрес и дать плану возможность измениться.',
  },
  {
    id: 'mercury-signs',
    title: 'Меркурий в знаках',
    eyebrow: 'Натальная карта',
    tags: ['Планета', 'Мышление'],
    paragraphs: [
      'Положение Меркурия в знаке описывает привычный способ собирать информацию, формулировать мысли и вести разговор.',
      'Это не оценка ума и не жёсткий тип личности. Один и тот же человек может говорить по-разному в зависимости от ситуации, опыта и собеседника.',
    ],
    simple: 'Знак Меркурия — это скорее привычный почерк мысли, чем готовый сценарий поведения.',
  },
  {
    id: 'mercury-houses',
    title: 'Меркурий в домах',
    eyebrow: 'Натальная карта',
    tags: ['Планета', 'Дома'],
    paragraphs: [
      'Дом показывает область жизни, где темы Меркурия — вопросы, обмен информацией и обучение — чаще оказываются заметны.',
      'Дома зависят от времени и места рождения. Если время неизвестно или приблизительно, положение дома нельзя считать точно определённым.',
    ],
    simple: 'Знак описывает стиль мышления, а дом — где этот стиль чаще включается.',
  },
  {
    id: 'retrograde-routine',
    title: 'Как прожить ретроградный Меркурий',
    eyebrow: 'Практика',
    tags: ['Ритм', 'Проверка'],
    paragraphs: [
      'Не нужен особый режим жизни. Достаточно оставлять запас времени, сохранять важные данные и проговаривать то, что легко понять по-разному.',
      'Если всё идёт по плану, не стоит искать проблему специально. Астрологический символ полезен только тогда, когда помогает внимательнее смотреть на реальную ситуацию.',
    ],
    simple: 'Проверить важное — разумно. Останавливать жизнь из-за периода — нет.',
  },
];

const TOPICS_EN: EncyclopediaTopic[] = [
  {
    id: 'mercury-retrograde',
    title: 'Mercury retrograde',
    eyebrow: 'Apparent motion',
    tags: ['Planet', 'Communication'],
    paragraphs: [
      'This is Mercury appearing to move backwards from Earth. In astrological tradition, the period is associated with a slower pace in communication, information, transport, and technology.',
      'It is not inherently a bad time. It can be a useful cue to review agreements, return to unfinished work, and leave decisions a little more room.',
    ],
    simple: 'Do not rush clarity: reread the message, confirm the address, and let a plan change when it needs to.',
  },
  {
    id: 'mercury-signs',
    title: 'Mercury in the signs',
    eyebrow: 'Natal chart',
    tags: ['Planet', 'Thinking'],
    paragraphs: [
      'Mercury’s sign describes a familiar way of gathering information, shaping thoughts, and joining a conversation.',
      'It is neither an intelligence score nor a fixed personality type. Context, experience, and the other person still matter.',
    ],
    simple: 'Mercury’s sign is a familiar handwriting of thought, not a fixed script.',
  },
  {
    id: 'mercury-houses',
    title: 'Mercury in the houses',
    eyebrow: 'Natal chart',
    tags: ['Planet', 'Houses'],
    paragraphs: [
      'A house points to the area of life where Mercury themes—questions, information exchange, and learning—may be more visible.',
      'Houses depend on birth time and place. If time is unknown or approximate, the app should not present an unreliable house as a precise fact.',
    ],
    simple: 'The sign describes the style of thought; the house suggests where that style is often engaged.',
  },
  {
    id: 'retrograde-routine',
    title: 'Living through Mercury retrograde',
    eyebrow: 'Practice',
    tags: ['Pace', 'Review'],
    paragraphs: [
      'No special life protocol is required. Leave a little buffer, back up important information, and clarify anything that can be read in two ways.',
      'If everything is working, there is no need to invent a problem. An astrological symbol is useful only when it helps you notice the real situation more clearly.',
    ],
    simple: 'Checking what matters is sensible. Putting life on hold is not.',
  },
];

export function AstrologyEncyclopedia({
  profile,
  onOpenProfile,
}: {
  profile: UserProfile;
  onOpenProfile?: () => void;
}) {
  const ru = profile.language !== 'en';
  const topics = ru ? TOPICS_RU : TOPICS_EN;
  const [activeTopicId, setActiveTopicId] = useState('mercury-retrograde');
  const articleRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const activeTopic = topics.find((topic) => topic.id === activeTopicId) || topics[0];
  const related = useMemo(
    () => topics.filter((topic) => topic.id !== activeTopic.id).slice(0, 3),
    [activeTopic.id, topics],
  );
  const openTopic = (topicId: string) => {
    setActiveTopicId(topicId);
    window.requestAnimationFrame(() => {
      headingRef.current?.focus({ preventScroll: true });
      articleRef.current?.scrollIntoView({ block: 'start' });
    });
  };

  return (
    <div className="fresh-page encyclopedia-editorial-page">
      <AppTopBar
        title={ru ? 'Что это значит?' : 'What does this mean?'}
        rightAction={(
          <EditorialProfileButton
            label={ru ? 'Открыть профиль' : 'Open profile'}
            onClick={onOpenProfile}
          />
        )}
      />

      <p className="encyclopedia-subtitle">{ru ? 'Энциклопедия астрологии' : 'Astrology encyclopedia'}</p>
      <EditorialCurve className="encyclopedia-curve" />

      <article ref={articleRef} className="encyclopedia-article">
        <div className="encyclopedia-topic-icon" aria-hidden="true">
          <PlanetIcon planet="mercury" size={30} strokeWidth={1.35} />
        </div>
        <p className="encyclopedia-eyebrow">{activeTopic.eyebrow}</p>
        <h1 ref={headingRef} tabIndex={-1}>{activeTopic.title}</h1>
        <div className="encyclopedia-tags" aria-label={ru ? 'Категории статьи' : 'Article categories'}>
          {activeTopic.tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>

        <div className="encyclopedia-copy">
          {activeTopic.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>

        <aside className="encyclopedia-simple" aria-labelledby="encyclopedia-simple-title">
          <Sparkles aria-hidden="true" strokeWidth={1.35} />
          <div>
            <h2 id="encyclopedia-simple-title">{ru ? 'Простыми словами' : 'In simple words'}</h2>
            <p>{activeTopic.simple}</p>
          </div>
        </aside>

        <section className="encyclopedia-related" aria-labelledby="encyclopedia-related-title">
          <h2 id="encyclopedia-related-title">{ru ? 'См. также' : 'Related'}</h2>
          <div>
            {related.map((topic) => (
              <button key={topic.id} type="button" onClick={() => openTopic(topic.id)}>
                <span>{topic.title}</span>
                <ChevronRight aria-hidden="true" strokeWidth={1.35} />
              </button>
            ))}
          </div>
        </section>
      </article>
    </div>
  );
}
