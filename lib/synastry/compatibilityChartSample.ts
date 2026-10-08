import type { CompatibilityAnswerRow } from '../../components/CompatibilityAnswers';

// Fictitious Alina (1990-03-14 09:41, Moscow) and Artem (1987-08-05 18:20, Москва, Россия).
// Saved Swiss Ephemeris charts from readingSamples.json, interpreted by the production
// calculateCompatibility/buildCompatibilityPreview functions. No user data or requests.
export const COMPATIBILITY_CHART_SAMPLE: Record<'ru' | 'en', {
  names: { subject: string; partner: string };
  overallScore: number;
  questions: CompatibilityAnswerRow[];
}> = {
  "ru": {
    "names": {
      "subject": "Алина",
      "partner": "Артём"
    },
    "overallScore": 39,
    "questions": [
      {
        "id": "romance_attraction",
        "question": "Есть ли взаимное притяжение?",
        "score": 68,
        "answer": "likely",
        "answerLabel": "скорее да",
        "text": "Вам весело вместе, и общий отдых получается. При этом у вас разные вкусы: в отдыхе, в покупках, в том, что считать красивым."
      },
      {
        "id": "romance_quarrels",
        "question": "Из-за чего можете поссориться?",
        "score": 13,
        "answer": "hard",
        "answerLabel": "непросто",
        "text": "В споре легко перейти на резкий тон, особенно когда кто-то устал или спешит. Слова одного иногда звучат для другого резче, чем задумано."
      }
    ]
  },
  "en": {
    "names": {
      "subject": "Alina",
      "partner": "Artem"
    },
    "overallScore": 39,
    "questions": [
      {
        "id": "romance_attraction",
        "question": "Is there mutual attraction?",
        "score": 68,
        "answer": "likely",
        "answerLabel": "mostly yes",
        "text": "You have fun together, and shared free time works out. At the same time: your tastes differ: in rest, in shopping, in what you find beautiful."
      },
      {
        "id": "romance_quarrels",
        "question": "What could you argue about?",
        "score": 13,
        "answer": "hard",
        "answerLabel": "not easy",
        "text": "Arguments easily turn sharp, especially when one of you is tired or in a hurry. One person’s words sometimes sound harsher to the other than intended."
      }
    ]
  }
};
