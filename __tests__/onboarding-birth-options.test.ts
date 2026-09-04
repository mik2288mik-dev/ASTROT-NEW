import fs from 'fs';
import path from 'path';
import { onboardingCalculationStatus } from '../lib/onboardingCalculationStatus';

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'views/Onboarding.tsx'), 'utf8');
const previewSource = fs.readFileSync(path.join(root, 'components/ui-preview/UiPreviewApp.tsx'), 'utf8');

describe('onboarding birth options', () => {
  it('shows an optional persisted gender choice and every supported time precision', () => {
    expect(source).toContain('Пол <span>(необязательно)</span>');
    expect(source).toContain("setGender((current) => current === value ? 'unspecified' : value)");
    expect(source).toContain("['exact', 'Знаю']");
    expect(source).toContain("['approximate', 'Примерно']");
    expect(source).toContain("['unknown', 'Не знаю']");
    expect(previewSource).toContain('<legend>Пол (необязательно)</legend>');
    expect(previewSource).toContain("['male', 'Мужчина']");
    expect(previewSource).toContain("['female', 'Женщина']");
    expect(previewSource).toContain('aria-pressed={gender === value}');
    expect(previewSource).toContain("current === value ? 'unspecified' : value");
    expect(previewSource).toContain('<span aria-hidden="true">✓ </span>');
  });

  it('keeps custom Russian validation in control while exposing native input hints', () => {
    expect(source).toContain('<form className="meou-birth-form" noValidate');
    expect(source).toContain('minLength={2}');
    expect(source).toContain('maxLength={100}');
    expect(source).toContain('min="1900-01-01"');
  });

  it('uses truthful staged calculation status without fake progress', () => {
    expect(onboardingCalculationStatus(0, 'unknown')).toContain('начинаем расчёт');
    expect(onboardingCalculationStatus(10, 'unknown')).toContain('несколько моментов');
    expect(onboardingCalculationStatus(10, 'exact')).toContain('продолжается');
    expect(onboardingCalculationStatus(45, 'approximate')).toContain('всё ещё идёт');
  });
});
