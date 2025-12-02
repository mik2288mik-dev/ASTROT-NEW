/**
 * Тесты для валидации входных данных
 */

import {
  validateDate,
  validateTime,
  validateName,
  validateBirthPlace,
  validateLanguage,
  validateNatalChartInput,
  validateSynastryInput
} from '../lib/validation';

describe('Validation', () => {
  describe('validateDate', () => {
    it('должен принимать валидные даты в формате YYYY-MM-DD', () => {
      expect(validateDate('1990-05-15').isValid).toBe(true);
      expect(validateDate('2000-12-31').isValid).toBe(true);
      expect(validateDate('2024-01-01').isValid).toBe(true);
    });

    it('должен отклонять невалидные форматы дат', () => {
      expect(validateDate('1990/05/15').isValid).toBe(false);
      expect(validateDate('15-05-1990').isValid).toBe(false);
      expect(validateDate('1990-5-15').isValid).toBe(false);
      expect(validateDate('invalid').isValid).toBe(false);
    });

    it('должен отклонять даты в будущем', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateString = futureDate.toISOString().split('T')[0];
      expect(validateDate(futureDateString).isValid).toBe(false);
    });

    it('должен отклонять даты до 1900 года', () => {
      expect(validateDate('1899-12-31').isValid).toBe(false);
      expect(validateDate('1800-01-01').isValid).toBe(false);
    });

    it('должен отклонять пустые значения', () => {
      expect(validateDate('').isValid).toBe(false);
      expect(validateDate(null as any).isValid).toBe(false);
      expect(validateDate(undefined as any).isValid).toBe(false);
    });
  });

  describe('validateTime', () => {
    it('должен принимать валидное время в формате HH:MM', () => {
      expect(validateTime('00:00').isValid).toBe(true);
      expect(validateTime('12:30').isValid).toBe(true);
      expect(validateTime('23:59').isValid).toBe(true);
    });

    it('должен отклонять невалидные форматы времени', () => {
      expect(validateTime('25:00').isValid).toBe(false); // Час > 23
      expect(validateTime('12:60').isValid).toBe(false); // Минута > 59
      expect(validateTime('1:30').isValid).toBe(false);   // Одна цифра для часа
      expect(validateTime('12:5').isValid).toBe(false);   // Одна цифра для минуты
      expect(validateTime('invalid').isValid).toBe(false);
    });

    it('должен отклонять пустые значения', () => {
      expect(validateTime('').isValid).toBe(false);
      expect(validateTime(null as any).isValid).toBe(false);
    });
  });

  describe('validateName', () => {
    it('должен принимать валидные имена', () => {
      expect(validateName('John').isValid).toBe(true);
      expect(validateName('Иван').isValid).toBe(true);
      expect(validateName('Mary-Jane').isValid).toBe(true);
      expect(validateName("O'Brien").isValid).toBe(true);
    });

    it('должен отклонять слишком короткие имена', () => {
      expect(validateName('A').isValid).toBe(false);
      expect(validateName('').isValid).toBe(false);
    });

    it('должен отклонять слишком длинные имена', () => {
      const longName = 'A'.repeat(101);
      expect(validateName(longName).isValid).toBe(false);
    });

    it('должен отклонять имена с недопустимыми символами', () => {
      expect(validateName('John123').isValid).toBe(false);
      expect(validateName('John@Doe').isValid).toBe(false);
      expect(validateName('John#Doe').isValid).toBe(false);
    });
  });

  describe('validateBirthPlace', () => {
    it('должен принимать валидные места рождения', () => {
      expect(validateBirthPlace('Moscow').isValid).toBe(true);
      expect(validateBirthPlace('New York').isValid).toBe(true);
      expect(validateBirthPlace('Москва, Россия').isValid).toBe(true);
    });

    it('должен отклонять слишком короткие названия', () => {
      expect(validateBirthPlace('A').isValid).toBe(false);
      expect(validateBirthPlace('').isValid).toBe(false);
    });

    it('должен отклонять слишком длинные названия', () => {
      const longPlace = 'A'.repeat(201);
      expect(validateBirthPlace(longPlace).isValid).toBe(false);
    });
  });

  describe('validateLanguage', () => {
    it('должен принимать валидные языки', () => {
      expect(validateLanguage('ru').isValid).toBe(true);
      expect(validateLanguage('en').isValid).toBe(true);
    });

    it('должен отклонять невалидные языки', () => {
      expect(validateLanguage('fr').isValid).toBe(false);
      expect(validateLanguage('de').isValid).toBe(false);
      expect(validateLanguage('invalid').isValid).toBe(false);
    });
  });

  describe('validateNatalChartInput', () => {
    it('должен принимать валидные данные для натальной карты', () => {
      const result = validateNatalChartInput({
        name: 'John Doe',
        birthDate: '1990-05-15',
        birthTime: '14:30',
        birthPlace: 'Moscow',
        language: 'ru'
      });
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('должен возвращать ошибки для невалидных данных', () => {
      const result = validateNatalChartInput({
        name: '',
        birthDate: 'invalid',
        birthPlace: '',
        language: 'invalid'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('должен обрабатывать отсутствующие обязательные поля', () => {
      const result = validateNatalChartInput({
        name: undefined,
        birthDate: undefined,
        birthPlace: undefined
      } as any);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateSynastryInput', () => {
    it('должен принимать валидные данные для синастрии', () => {
      const result = validateSynastryInput({
        profile: {
          name: 'John',
          birthDate: '1990-05-15',
          birthPlace: 'Moscow'
        },
        partnerName: 'Jane',
        partnerDate: '1992-08-20',
        language: 'ru'
      });
      expect(result.isValid).toBe(true);
    });

    it('должен возвращать ошибки для невалидных данных', () => {
      const result = validateSynastryInput({
        profile: null,
        partnerName: '',
        partnerDate: 'invalid'
      } as any);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
