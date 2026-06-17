import React from 'react';
import { lumiaSelectionHaptic } from '../../../lib/haptics';

type LzAskPresetsProps = {
  title: string;
  questions: string[];
  onPick: (question: string) => void;
};

export function LzAskPresets({ title, questions, onPick }: LzAskPresetsProps) {
  return (
    <section className="lz-ask-section mt-10 pb-2">
      <p className="lz-kicker">{title}</p>
      <div className="-mx-1 mt-4 flex gap-2.5 overflow-x-auto px-1 pb-1 scrollbar-hide">
        {questions.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => {
              lumiaSelectionHaptic();
              onPick(question);
            }}
            className="lz-ask-pill shrink-0 max-w-[240px] text-left active:scale-[0.98]"
          >
            {question}
          </button>
        ))}
      </div>
    </section>
  );
}

export function getAskPresetQuestions(language: 'ru' | 'en'): string[] {
  if (language === 'en') {
    return [
      'What should I focus on today?',
      'What is waiting in love?',
      'How do I talk to my partner?',
      'Where is my energy going?',
      'What should I avoid today?',
      'What am I like in relationships?',
      'What is my strongest side?',
      'What holds me back?',
      'Is today good for an important talk?',
      'How can I improve things with people close to me?',
      'What matters at work right now?',
      'Should I take a risk today?',
      'Why do I react the way I do in conflict?',
      'What gives me energy?',
      'How do I make decisions better?',
      'What should I watch this week?',
      'Is it a good time to start something new?',
      'What matters for my money right now?',
      'Where is my potential for growth?',
      'How do I get through this hard stretch?',
      'How can I take better care of myself?',
      'What lesson does today hold for me?',
      'How do I let go of what worries me?',
      'What is the right next step for me?',
    ];
  }
  return [
    'На чём сфокусироваться сегодня?',
    'Что ждёт меня в любви?',
    'Как поговорить с партнёром?',
    'Куда уходит моя энергия?',
    'Чего лучше избегать сегодня?',
    'Какой я в отношениях?',
    'В чём моя сильная сторона?',
    'Что мешает мне двигаться вперёд?',
    'Подходящий ли день для важного разговора?',
    'Как наладить отношения с близкими?',
    'Что важно в работе прямо сейчас?',
    'Стоит ли рисковать сегодня?',
    'Почему я так реагирую в конфликтах?',
    'Что меня заряжает?',
    'Как лучше принимать решения?',
    'На что обратить внимание на этой неделе?',
    'Подходящее ли время начать новое?',
    'Что важно в моих финансах сейчас?',
    'Где сейчас мой потенциал роста?',
    'Как пережить этот непростой период?',
    'Как лучше заботиться о себе?',
    'Какой урок несёт мне этот день?',
    'Как отпустить то, что тревожит?',
    'Какой мой следующий шаг?',
  ];
}
