import { calculateCompatibility } from '../lib/synastry/compatibilityEngine';
import {
  buildCompatibilityResult, selectCompatibilityWriterEvidence,
  type CompatibilityNarrativeInput,
} from '../lib/synastry/compatibilityNarrative';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';
import { compatibilityStory } from './fixtures/compatibilityStory';

const calculated = calculateCompatibility({
  subjectChart: canonicalNatalChart(), partnerChart: canonicalNatalChart({ birthDate: '1990-08-22' }),
  calculationLevel: 'full', relationshipContext: 'romance', language: 'ru', subjectName: 'Лина', partnerName: 'Саша',
});
const context: CompatibilityNarrativeInput = {
  subjectName: 'Лина', subjectGender: 'female', partnerName: 'Саша', partnerGender: 'unspecified', language: 'ru',
};
function candidate(addition = '') {
  const writer = compatibilityStory(selectCompatibilityWriterEvidence(calculated));
  if (addition) writer.paragraphs[0].text += ` ${addition}`;
  return writer;
}

describe('compatibility reader perspective and explicit grammatical gender', () => {
  it.each([
    'Саша тоже способен воспринимать тебя внимательно.', 'Саша способна ответить сразу.',
    'Саша не всегда готов к разговору.', 'Саша может быть готова к разговору.',
    'Саша предложил другой вариант.', 'Саша предложила другой вариант.',
    'Саша сам выбирает время.', 'Саша сама выбирает время.',
    'Если Саша первым предлагает конкретный шаг, тебе проще ответить.',
    'Саша в этом сценарии не обязан говорить много.',
  ])('rejects named gender inference for an unspecified partner: %s', (addition) => {
    expect(() => buildCompatibilityResult(calculated, candidate(addition), context)).toThrow('unspecified_gender_inferred');
  });

  it.each([
    'Саша может предложить другой вариант.', 'Саша готовит ужин, а ты выбираешь музыку.',
    'Саша обычно замечает, когда разговор совсем готов закончиться.',
    'Саша слушает, пока коллега говорит, что он готов.',
    'Для Саши важен готовый результат, а тебе интересно обсудить детали.',
  ])('keeps neutral grammar and unrelated masculine nouns valid: %s', (addition) => {
    expect(buildCompatibilityResult(calculated, candidate(addition), context).storyParagraphs).toHaveLength(8);
  });

  it.each([
    ['male', 'Саша способен ответить.', 'Саша способна ответить.'],
    ['female', 'Саша способна ответить.', 'Саша способен ответить.'],
  ] as const)('accepts the supplied %s gender and rejects its opposite', (partnerGender, valid, invalid) => {
    expect(buildCompatibilityResult(calculated, candidate(valid), { ...context, partnerGender }).summary).toContain(valid);
    expect(() => buildCompatibilityResult(calculated, candidate(invalid), { ...context, partnerGender })).toThrow('reader_gender_mismatch');
  });

  it('applies the same bounded predicate rule to direct address of the subject', () => {
    expect(buildCompatibilityResult(calculated, candidate('Ты способна ответить прямо.'), context).summary).toContain('Ты способна');
    expect(() => buildCompatibilityResult(calculated, candidate('Ты способен ответить прямо.'), context)).toThrow('reader_gender_mismatch');
    expect(() => buildCompatibilityResult(calculated, candidate('Ты готова обсуждать детали.'), { ...context, subjectGender: 'unspecified' })).toThrow('unspecified_gender_inferred');
  });

  it('rejects a story with no direct reader address, even when it contains valid chapters and evidence', () => {
    const writer = candidate();
    for (const paragraph of writer.paragraphs) {
      paragraph.text = paragraph.text.replace(/(?:^|[^\p{L}])(ты|тебя|тебе|тобой|тобою|твой|твоя|твоё|твое|твои|твоего|твоей|твоих|твоему|твоим|твою|твоими)(?=$|[^\p{L}])/giu, ' Лина');
    }
    expect(() => buildCompatibilityResult(calculated, writer, context)).toThrow('reader_address_missing');
  });

  it('rejects repeated narration about the subject despite a token direct address', () => {
    const writer = candidate();
    writer.paragraphs[0].text += ' Лина замечает детали.';
    writer.paragraphs[1].text += ' Лине интересно продолжить разговор.';
    writer.paragraphs[2].text += ' С Линой можно обсудить другой вариант.';
    expect(() => buildCompatibilityResult(calculated, writer, context)).toThrow('reader_third_person');
    expect(buildCompatibilityResult(calculated, candidate('Лина, ты можешь увидеть разницу.'), context).summary).toContain('Лина, ты');
  });

  it('does not mistake a partner with the same first name for third-person narration of the reader', () => {
    const writer = candidate('Саша замечает детали. Саша предлагает новый вариант. Саше интересно продолжить разговор.');
    expect(buildCompatibilityResult(calculated, writer, { ...context, subjectName: 'Саша' }).storyParagraphs).toHaveLength(8);
  });

  it('does not treat the nameless-person placeholder as a real given name', () => {
    const writer = candidate('Первый вариант можно обсудить. Первый шаг не обязательно заканчивает разговор. Первый ответ бывает коротким.');
    expect(buildCompatibilityResult(calculated, writer, { ...context, subjectName: 'Первый человек' }).storyParagraphs).toHaveLength(8);
  });

  it('requires English you/your and allows known he/she while rejecting unknown named apposition', () => {
    const english = { ...context, language: 'en' as const, subjectName: 'Lina', partnerName: 'Sasha' };
    expect(() => buildCompatibilityResult(calculated, candidate(), english)).toThrow('reader_address_missing');
    expect(buildCompatibilityResult(calculated, candidate('You may enjoy the conversation. Sasha, he can offer another idea.'), { ...english, partnerGender: 'male' }).summary).toContain('he can');
    expect(buildCompatibilityResult(calculated, candidate('You may enjoy the conversation. Sasha, she can offer another idea.'), { ...english, partnerGender: 'female' }).summary).toContain('she can');
    expect(() => buildCompatibilityResult(calculated, candidate('You may enjoy the conversation. Sasha, he can offer another idea.'), english)).toThrow('unspecified_gender_inferred');
  });

  it('preserves the old evidence-only validator contract for callers without reader context', () => {
    expect(buildCompatibilityResult(calculated, candidate('Саша способен ответить.')).storyParagraphs).toHaveLength(8);
  });
});
