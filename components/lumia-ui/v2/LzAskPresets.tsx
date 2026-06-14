import React from 'react';
import { lumiaSelectionHaptic } from '../../../lib/haptics';

type LzAskPresetsProps = {
  title: string;
  questions: string[];
  onPick: (question: string) => void;
};

export function LzAskPresets({ title, questions, onPick }: LzAskPresetsProps) {
  return (
    <section className="mt-8 pb-2">
      <h3 className="text-[22px] font-bold tracking-[-0.02em] text-mono-ink">{title}</h3>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide">
        {questions.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => {
              lumiaSelectionHaptic();
              onPick(question);
            }}
            className="shrink-0 rounded-full border border-mono-line bg-mono-white px-4 py-2.5 text-left text-[13px] font-semibold leading-snug text-mono-ink active:scale-[0.98]"
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
