import { calculateCompatibility } from '../lib/synastry/compatibilityEngine';
import { buildCompatibilityPreview } from '../lib/synastry/compatibilityPreview';
import { compatibilityQuestionsFor } from '../lib/synastry/compatibilityQuestions';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';

const preview = (context: 'romance' | 'relationship' | 'friendship' | 'family' | 'work') => buildCompatibilityPreview(
  calculateCompatibility({
    subjectChart: canonicalNatalChart(), partnerChart: canonicalNatalChart({ birthDate: '1990-08-22' }),
    calculationLevel: 'full', relationshipContext: context, language: 'ru', subjectName: 'Анна', partnerName: 'Максим',
  }),
  { subject: 'Анна', partner: 'Максим' },
  'ru',
);

describe('free compatibility answers', () => {
  it.each(['romance', 'relationship', 'friendship', 'family', 'work'] as const)('answers the questions of %s', (context) => {
    const result = preview(context);
    expect(result.questions.map((item) => item.id)).toEqual(compatibilityQuestionsFor(context).map((item) => item.id));
    expect(result.questions.every((item) => item.answerLabel.length > 0)).toBe(true);
  });

  it('opens at most two explanations and locks the other answered questions', () => {
    const result = preview('relationship');
    const explained = result.questions.filter((item) => item.explanation);
    expect(explained.length).toBeGreaterThan(0);
    expect(explained.length).toBeLessThanOrEqual(2);
    for (const item of result.questions) {
      expect(item.locked).toBe(item.score != null && !item.explanation);
    }
  });

  it('writes explanations in plain words without astrology terms or numbers', () => {
    for (const context of ['romance', 'relationship', 'friendship', 'family', 'work'] as const) {
      for (const item of preview(context).questions) {
        if (!item.explanation) continue;
        expect(item.explanation).not.toMatch(/планет|аспект|Венер|Марс|Луна|Сатурн|Плутон|(?<!\p{L})дом(?:е|а|у)?(?!\p{L})|\d/iu);
      }
    }
  });

  it('names who affects whom only in the locked extras, not as open text', () => {
    const result = preview('relationship');
    expect(result.lockedExtras.length).toBeGreaterThan(0);
    expect(result.lockedExtras.at(-1)).toContain('На каких данных');
  });
});
