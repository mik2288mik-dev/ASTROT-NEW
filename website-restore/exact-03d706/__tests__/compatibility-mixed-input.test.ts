import fs from 'fs';
import path from 'path';
import {
  classifyCompatibilityPerson,
  resolveCompatibilityPairLevel,
} from '../lib/synastry/compatibilityInput';
import { computeSynastryAspects } from '../lib/synastry/synastryAspects';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('mixed compatibility input', () => {
  it('classifies exact, unknown-time, date-only and sign-only people honestly', () => {
    expect(classifyCompatibilityPerson({ source: 'birth', date: '1992-08-12', time: '08:40', place: 'Москва' }).level).toBe('exact');
    expect(classifyCompatibilityPerson({ source: 'birth', date: '1992-08-12', time: '08:40', place: 'Москва', birthTimeQuality: 'approximate' }).level).toBe('unknown_time');
    expect(classifyCompatibilityPerson({ source: 'birth', date: '1992-08-12', place: 'Москва' }).level).toBe('unknown_time');
    expect(classifyCompatibilityPerson({ source: 'birth', date: '1992-08-12' }).level).toBe('date_only');
    expect(classifyCompatibilityPerson({ source: 'sign', sign: 'libra' }).level).toBe('sign');
  });

  it('uses the weakest available data without presenting a hybrid as full synastry', () => {
    const exact = classifyCompatibilityPerson({ source: 'birth', date: '1989-03-06', time: '23:15', place: 'Сергиев Посад' });
    const unknownTime = classifyCompatibilityPerson({ source: 'birth', date: '1992-08-12', place: 'Москва' });
    const dateOnly = classifyCompatibilityPerson({ source: 'birth', date: '1992-08-12' });
    const sign = classifyCompatibilityPerson({ source: 'sign', sign: 'leo' });

    expect(resolveCompatibilityPairLevel(exact, exact)).toBe('full');
    expect(resolveCompatibilityPairLevel(exact, unknownTime)).toBe('reduced');
    expect(resolveCompatibilityPairLevel(exact, dateOnly)).toBe('date_only');
    expect(resolveCompatibilityPairLevel(exact, sign)).toBe('hybrid_sign');
    expect(resolveCompatibilityPairLevel(sign, sign)).toBe('sign_only');
  });

  it('does not use a planet position that changes across an unknown birth-time interval', () => {
    const first = {
      sun: { longitude: 10, sign: 'Aries', reliability: 'exact' },
      moon: { longitude: 10, sign: 'Aries', reliability: 'variable_in_range' },
    } as any;
    const second = {
      sun: { longitude: 10, sign: 'Aries', reliability: 'exact' },
    } as any;

    const aspects = computeSynastryAspects(first, second);

    expect(aspects.some((aspect) => aspect.a === 'Луна')).toBe(false);
    expect(aspects.some((aspect) => aspect.a === 'Солнце')).toBe(true);
  });

  it('offers saved or new people for full compatibility and keeps signs on the free route', () => {
    const room = read('views/v2/UnionRoom.tsx');
    const service = read('services/astrologyService.ts');

    expect(room).toContain("type CompatibilityPersonSource = 'birth' | 'saved' | 'sign'");
    expect(room.match(/<PersonSourcePicker/g)).toHaveLength(2);
    const picker = room.split('function PersonSourcePicker')[1].split('function PersonBirthFields')[0];
    expect(picker).toContain("value: 'saved'");
    expect(picker).toContain("value: 'birth'");
    expect(picker).not.toContain("value: 'sign'");
    expect(room).toContain('compat-person-source-option');
    expect(room).toContain('aria-pressed={active}');
    expect(picker).toContain("ru ? 'Мои карты' : 'My charts'");
    expect(picker).toContain("ru ? 'Новый' : 'New person'");
    expect(room).toContain("subjectResolvedSource === 'sign' && partnerResolvedSource === 'sign'");
    expect(room).toContain("calculationLevel: 'sign_only'");
    expect(room).toContain('getSignCompatibility(');
    expect(room).toContain('compat-reading-intro');
    expect(service).toContain('subjectSource');
    expect(service).toContain('partnerSource');
    expect(service).toContain('subjectSign');
    expect(service).toContain('partnerSign');
    expect(service).toContain('subjectBirthTimeQuality');
    expect(service).toContain('partnerBirthTimeQuality');
  });
});
