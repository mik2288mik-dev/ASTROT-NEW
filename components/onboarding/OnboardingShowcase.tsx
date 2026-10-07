import React from 'react';
import { Check } from 'lucide-react';

/**
 * The welcome slides sell the app: one promise per slide, big and plain, on top of a calm
 * full-screen clip. No interface mock-ups: people should feel what they get, not read a tour.
 */

export type ShowcaseSlide = 'hello' | 'natal' | 'future' | 'compat' | 'calm' | 'more';

type SlideCopy = {
  title: string;
  text: string;
};

const SLIDES: Record<ShowcaseSlide, SlideCopy> = {
  hello: {
    title: 'Знай свой день до того, как он начался',
    text: 'Личный прогноз на сегодня, неделю и месяц. Считается по твоей дате, времени и городу рождения, поэтому он только про тебя.',
  },
  natal: {
    title: 'Поймёшь себя простыми словами',
    text: 'Натальная карта без тумана: твои сильные стороны, привычные реакции и что тебе подходит в любви, деньгах и работе.',
  },
  future: {
    title: 'Выбирай удачный момент заранее',
    text: 'Календарь важных дней: когда лучше назначить встречу, сделать покупку или начать трудный разговор.',
  },
  compat: {
    title: 'Поймёшь, почему у вас так',
    text: 'Совместимость с партнёром, другом и семьёй: где вам легко, о чём спорите и как договориться.',
  },
  calm: {
    title: 'Выдохни за две минуты',
    text: 'Антистресс: дыхание, расслабление тела и звуки природы. Помогает, когда тревожно, злишься или не можешь уснуть.',
  },
  more: {
    title: 'Сериалы и тесты на каждый день',
    text: 'Короткие истории с продолжением и тесты о себе: на пять минут в дороге или за чашкой кофе.',
  },
};

export function OnboardingShowcase({ slide }: { slide: ShowcaseSlide }) {
  const copy = SLIDES[slide];
  return (
    <div className="ob-slide">
      <h1 className="ob-title">{copy.title}</h1>
      <p className="ob-lead">{copy.text}</p>
    </div>
  );
}

/** The last welcome screen: why start now, what it costs (a minute), and the three ways to go on. */
export function OnboardingReady({ onCreate, onLook, onSignIn }: { onCreate: () => void; onLook: () => void; onSignIn: () => void }) {
  return (
    <div className="ob-slide ob-ready">
      <h1 className="ob-title">Твоё небо за одну минуту</h1>
      <p className="ob-lead">Нужны имя, дата и город рождения. Время, если знаешь.</p>
      <ul className="ob-proof">
        <li><Check size={16} aria-hidden="true" />Данные хранятся в России (152-ФЗ)</li>
        <li><Check size={16} aria-hidden="true" />Расчёт по тем же эфемеридам, что у астрологов</li>
        <li><Check size={16} aria-hidden="true" />Можно сначала посмотреть без данных</li>
      </ul>
      <div className="ob-actions">
        <button type="button" className="ob-cta" onClick={onCreate}>Создать мой прогноз</button>
        <button type="button" className="ob-cta is-ghost" onClick={onLook}>Сначала посмотреть</button>
        <button type="button" className="ob-signin" onClick={onSignIn}>Уже есть аккаунт, <span>войти</span></button>
      </div>
    </div>
  );
}
