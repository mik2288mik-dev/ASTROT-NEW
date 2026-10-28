import fs from 'fs';
import path from 'path';
import { onboardingCalculationStatus } from '../lib/onboardingCalculationStatus';

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'views/Onboarding.tsx'), 'utf8');

describe('onboarding birth options', () => {
  it('asks only the birth date, time and city on one screen, as on the canvas entry', () => {
    expect(source).toContain('Когда у тебя день рождения?');
    expect(source).toContain('<DateWheel value={date}');
    expect(source).toContain("chooseTimeMode(event.target.checked ? 'unknown' : 'exact')");
    expect(source).toContain('Не знаю время рождения');
    expect(source).toContain('Посчитаем без Асцендента и домов. Время можно добавить потом.');
  });

  it('keeps custom Russian validation in control while exposing native input hints', () => {
    expect(source).toContain('<form className="nebo-entry-card" noValidate');
    expect(source).toContain('minLength={2}');
    expect(source).toContain('maxLength={100}');
    expect(fs.readFileSync(path.join(root, 'components/nebo/DateWheel.tsx'), 'utf8')).toContain('minYear = 1930');
  });

  it('uses truthful staged calculation status without fake progress', () => {
    expect(onboardingCalculationStatus(0, 'unknown')).toContain('начинаем расчёт');
    expect(onboardingCalculationStatus(10, 'unknown')).toContain('несколько моментов');
    expect(onboardingCalculationStatus(10, 'exact')).toContain('продолжается');
    expect(onboardingCalculationStatus(45, 'approximate')).toContain('всё ещё идёт');
  });
});
