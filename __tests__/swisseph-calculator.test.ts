/**
 * Тесты для астрологических расчетов
 * 
 * Тестирует ключевые функции расчета натальной карты
 */

import { getZodiacSign, getDegreeInSign } from '../lib/swisseph-calculator';

// Экспортируем внутренние функции для тестирования
// В реальности эти функции могут быть приватными, но для тестов мы их тестируем

describe('Swiss Ephemeris Calculator', () => {
  describe('getZodiacSign', () => {
    it('должен правильно определять знак для каждого диапазона 30 градусов', () => {
      // Тестируем середину каждого знака
      expect(getZodiacSign(15)).toBe('Aries');    // 15° = середина Овна
      expect(getZodiacSign(45)).toBe('Taurus');    // 45° = середина Тельца
      expect(getZodiacSign(75)).toBe('Gemini');    // 75° = середина Близнецов
      expect(getZodiacSign(105)).toBe('Cancer');   // 105° = середина Рака
      expect(getZodiacSign(135)).toBe('Leo');      // 135° = середина Льва
      expect(getZodiacSign(165)).toBe('Virgo');    // 165° = середина Девы
      expect(getZodiacSign(195)).toBe('Libra');    // 195° = середина Весов
      expect(getZodiacSign(225)).toBe('Scorpio');  // 225° = середина Скорпиона
      expect(getZodiacSign(255)).toBe('Sagittarius'); // 255° = середина Стрельца
      expect(getZodiacSign(285)).toBe('Capricorn'); // 285° = середина Козерога
      expect(getZodiacSign(315)).toBe('Aquarius');  // 315° = середина Водолея
      expect(getZodiacSign(345)).toBe('Pisces');    // 345° = середина Рыб
    });

    it('должен правильно обрабатывать граничные значения', () => {
      expect(getZodiacSign(0)).toBe('Aries');      // 0° = начало Овна
      expect(getZodiacSign(30)).toBe('Taurus');    // 30° = начало Тельца
      expect(getZodiacSign(360)).toBe('Aries');    // 360° = начало Овна (нормализуется)
      expect(getZodiacSign(359.99)).toBe('Pisces'); // Почти 360° = конец Рыб
    });

    it('должен нормализовать отрицательные значения', () => {
      expect(getZodiacSign(-15)).toBe('Pisces');   // -15° нормализуется до 345°
      expect(getZodiacSign(-30)).toBe('Pisces');   // -30° нормализуется до 330° (330/30 = 11 = Pisces)
      expect(getZodiacSign(-45)).toBe('Aquarius'); // -45° нормализуется до 315° (315/30 = 10.5 = Aquarius)
    });

    it('должен нормализовать значения больше 360', () => {
      expect(getZodiacSign(375)).toBe('Aries');    // 375° нормализуется до 15°
      expect(getZodiacSign(720)).toBe('Aries');    // 720° нормализуется до 0°
    });
  });

  describe('getDegreeInSign', () => {
    it('должен правильно вычислять градус внутри знака', () => {
      expect(getDegreeInSign(15)).toBe(15);       // 15° в Овне = 15°
      expect(getDegreeInSign(45)).toBe(15);        // 45° в Тельце = 15° (45 - 30)
      expect(getDegreeInSign(75)).toBe(15);        // 75° в Близнецах = 15° (75 - 60)
      expect(getDegreeInSign(0)).toBe(0);         // 0° = 0° в знаке
      expect(getDegreeInSign(30)).toBe(0);        // 30° = 0° в знаке (граница)
    });

    it('должен возвращать значения в диапазоне 0-29.99...', () => {
      const degree = getDegreeInSign(45);
      expect(degree).toBeGreaterThanOrEqual(0);
      expect(degree).toBeLessThan(30);
    });
  });
});
