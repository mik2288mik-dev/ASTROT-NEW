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
    ];
  }
  return [
    'На чём сфокусироваться сегодня?',
    'Что ждёт в любви?',
    'Как поговорить с партнёром?',
    'Куда уходит моя энергия?',
    'Чего лучше избегать сегодня?',
  ];
}
