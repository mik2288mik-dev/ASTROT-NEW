import { calculateCompatibility } from '../lib/synastry/compatibilityEngine';
import { buildCompatibilityResult, selectCompatibilityWriterEvidence } from '../lib/synastry/compatibilityNarrative';
import { buildCompatibilityStoryPrompt } from '../lib/synastry/compatibilityVoice';
import { normalizeRelationshipContext, type RelationshipContext } from '../lib/synastry/relationshipContext';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';
import { compatibilityStory } from './fixtures/compatibilityStory';

function calculation(context: RelationshipContext = 'romance') {
  return calculateCompatibility({
    subjectChart: canonicalNatalChart(), partnerChart: canonicalNatalChart({ birthDate: '1990-08-22' }),
    calculationLevel: 'full', relationshipContext: context, language: 'ru', subjectName: 'Анна', partnerName: 'Максим',
  });
}

describe('evidence-based compatibility story', () => {
  it.each([
    ['romance', 'Не считай их парой'],
    ['relationship', 'существующие отношения'],
    ['ex', 'Не подталкивай к примирению'],
    ['friendship', 'Не превращай дружбу в скрытый роман'],
    ['family', 'Степень родства и возраст неизвестны'],
    ['work', 'Не добавляй романтику'],
  ] as const)('uses a distinct relationship brief for %s', (context, boundary) => {
    const calculated = calculation(context);
    const prompt = buildCompatibilityStoryPrompt({ calculated, language: 'ru', subject: { name: 'Анна', gender: 'female', birthTimeQuality: 'exact' }, partner: { name: 'Максим', gender: 'male', birthTimeQuality: 'exact' } });
    expect(prompt.system).toContain(boundary);
    expect(prompt.system).toContain('450–650 слов');
    expect(JSON.parse(prompt.user).relationshipContext).toBe(context);
    expect(normalizeRelationshipContext(context)).toBe(context);
    expect(JSON.parse(prompt.user)).not.toHaveProperty('overallScore');
    expect(JSON.parse(prompt.user)).not.toHaveProperty('sectionPlan');
  });

  it.each(['Совместимость: 87 баллов.', 'Он тайно любит тебя.', 'Она обязательно вернётся.', 'He still loves you.', 'Что делать дальше?', '**Ваши сильные стороны**'])('rejects unsupported or templated visible prose: %s', (addition) => {
    const calculated = calculation();
    const writer = compatibilityStory(selectCompatibilityWriterEvidence(calculated));
    writer.paragraphs[0].text += ` ${addition}`;
    expect(() => buildCompatibilityResult(calculated, writer)).toThrow('SYNASTRY_NARRATIVE_INVALID');
  });

  it('rejects nonexistent evidence and repeated paragraphs instead of filling gaps', () => {
    const calculated = calculation();
    const writer = compatibilityStory(selectCompatibilityWriterEvidence(calculated));
    writer.paragraphs[0].evidenceIds = ['made-up-contact'];
    expect(() => buildCompatibilityResult(calculated, writer)).toThrow('unknown_evidence');
    writer.paragraphs[0] = { ...writer.paragraphs[1] };
    expect(() => buildCompatibilityResult(calculated, writer)).toThrow('repeated_paragraph');
  });

  it('rejects a story that repeatedly substitutes caveats about feelings for the pair narrative', () => {
    const calculated = calculation();
    const writer = compatibilityStory(selectCompatibilityWriterEvidence(calculated));
    for (let index = 0; index < 3; index += 1) writer.paragraphs[index].text += ' Это не доказательство взаимности.';
    expect(() => buildCompatibilityResult(calculated, writer)).toThrow('repeated_relationship_caveat');
  });

  it('does not derive an asymmetric role from a mutual aspect', () => {
    const calculated = calculation();
    calculated.directionalPatterns = [];
    const writer = compatibilityStory(selectCompatibilityWriterEvidence(calculated));
    writer.paragraphs[0].direction = 'partner_to_subject';
    expect(() => buildCompatibilityResult(calculated, writer)).toThrow('unsupported_direction');
  });

  it('accepts an actual directional fact only in its supported direction', () => {
    const calculated = calculation();
    const evidence = selectCompatibilityWriterEvidence(calculated);
    const mutual = evidence.find((item) => item.direction === 'mutual')!;
    calculated.directionalPatterns = [{ id: 'test-direction', direction: 'subject_to_partner', title: 'Анна → Максим', fact: 'Fixture direction', evidenceIds: [mutual.id] }];
    const writer = compatibilityStory(selectCompatibilityWriterEvidence(calculated));
    writer.paragraphs[0].direction = 'subject_to_partner';
    writer.paragraphs[0].evidenceIds = [mutual.id];
    const result = buildCompatibilityResult(calculated, writer);
    expect(result.narrativeEvidenceIds).toContain(mutual.id);
    writer.paragraphs[0].direction = 'partner_to_subject';
    expect(() => buildCompatibilityResult(calculated, writer)).toThrow('unsupported_direction');
  });
});
