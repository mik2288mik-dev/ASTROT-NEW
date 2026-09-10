/**
 * Тесты для утилит работы со знаками зодиака
 */

import {
  getApproximateSunSignByDate,
  getRulingPlanet,
  getElementForSign,
  ZODIAC_SIGNS,
  RULING_PLANETS,
  SIGN_ELEMENTS
} from '../lib/zodiac-utils';

describe('Zodiac Utils', () => {
  describe('getApproximateSunSignByDate', () => {
    it('должен правильно определять знак для середины каждого знака', () => {
      // Тестируем середину каждого знака
      expect(getApproximateSunSignByDate(2000, 4, 5)).toBe('Aries');      // ~середина Овна
      expect(getApproximateSunSignByDate(2000, 5, 5)).toBe('Taurus');     // ~середина Тельца
      expect(getApproximateSunSignByDate(2000, 6, 5)).toBe('Gemini');     // ~середина Близнецов
      expect(getApproximateSunSignByDate(2000, 7, 5)).toBe('Cancer');     // ~середина Рака
      expect(getApproximateSunSignByDate(2000, 8, 5)).toBe('Leo');        // ~середина Льва
      expect(getApproximateSunSignByDate(2000, 9, 5)).toBe('Virgo');      // ~середина Девы
      expect(getApproximateSunSignByDate(2000, 10, 5)).toBe('Libra');    // ~середина Весов
      expect(getApproximateSunSignByDate(2000, 11, 5)).toBe('Scorpio');  // ~середина Скорпиона
      expect(getApproximateSunSignByDate(2000, 12, 5)).toBe('Sagittarius'); // ~середина Стрельца
      expect(getApproximateSunSignByDate(2000, 1, 5)).toBe('Capricorn'); // ~середина Козерога
      expect(getApproximateSunSignByDate(2000, 2, 5)).toBe('Aquarius');  // ~середина Водолея
      expect(getApproximateSunSignByDate(2000, 3, 5)).toBe('Pisces');    // ~середина Рыб
    });

    it('КРИТИЧЕСКИЙ ТЕСТ: должен правильно определять Рыбы для 6 марта 1989', () => {
      // Тест для репродукции бага: 6 марта 1989 должно быть Рыбы, а не Телец или Дева
      // Pisces: 19 февраля - 20 марта
      expect(getApproximateSunSignByDate(1989, 3, 6)).toBe('Pisces');
      
      // Дополнительные тесты для марта (период Рыб)
      expect(getApproximateSunSignByDate(1989, 2, 19)).toBe('Pisces'); // Начало Рыб
      expect(getApproximateSunSignByDate(1989, 2, 25)).toBe('Pisces'); // Середина февральской части
      expect(getApproximateSunSignByDate(1989, 3, 1)).toBe('Pisces');  // Начало мартовской части
      expect(getApproximateSunSignByDate(1989, 3, 10)).toBe('Pisces'); // Середина мартовской части
      expect(getApproximateSunSignByDate(1989, 3, 20)).toBe('Pisces'); // Конец Рыб
      expect(getApproximateSunSignByDate(1989, 3, 21)).toBe('Aries');  // Начало Овна
    });

    it('должен правильно определять знак на границах', () => {
      // Границы знаков (примерные)
      expect(getApproximateSunSignByDate(2000, 3, 21)).toBe('Aries');     // Начало Овна
      expect(getApproximateSunSignByDate(2000, 4, 19)).toBe('Aries');     // Конец Овна
      expect(getApproximateSunSignByDate(2000, 4, 20)).toBe('Taurus');    // Начало Тельца
      expect(getApproximateSunSignByDate(2000, 12, 22)).toBe('Capricorn'); // Начало Козерога
      expect(getApproximateSunSignByDate(2000, 1, 19)).toBe('Capricorn'); // Конец Козерога
      expect(getApproximateSunSignByDate(2000, 1, 20)).toBe('Aquarius');  // Начало Водолея
    });

    it('должен обрабатывать знаки, пересекающие границу года', () => {
      // Capricorn (22 декабря - 19 января)
      expect(getApproximateSunSignByDate(2000, 12, 25)).toBe('Capricorn');
      expect(getApproximateSunSignByDate(2001, 1, 10)).toBe('Capricorn');
      expect(getApproximateSunSignByDate(2001, 1, 19)).toBe('Capricorn');
      
      // Aquarius (20 января - 18 февраля)
      expect(getApproximateSunSignByDate(2001, 1, 20)).toBe('Aquarius');
      expect(getApproximateSunSignByDate(2001, 2, 10)).toBe('Aquarius');
      
      // Pisces (19 февраля - 20 марта)
      expect(getApproximateSunSignByDate(2001, 2, 19)).toBe('Pisces');
      expect(getApproximateSunSignByDate(2001, 3, 10)).toBe('Pisces');
    });
  });

  describe('getRulingPlanet', () => {
    it('должен возвращать правильную управляющую планету для каждого знака', () => {
      expect(getRulingPlanet('Aries')).toBe('Mars');
      expect(getRulingPlanet('Taurus')).toBe('Venus');
      expect(getRulingPlanet('Gemini')).toBe('Mercury');
      expect(getRulingPlanet('Cancer')).toBe('Moon');
      expect(getRulingPlanet('Leo')).toBe('Sun');
      expect(getRulingPlanet('Virgo')).toBe('Mercury');
      expect(getRulingPlanet('Libra')).toBe('Venus');
      expect(getRulingPlanet('Scorpio')).toBe('Pluto');
      expect(getRulingPlanet('Sagittarius')).toBe('Jupiter');
      expect(getRulingPlanet('Capricorn')).toBe('Saturn');
      expect(getRulingPlanet('Aquarius')).toBe('Uranus');
      expect(getRulingPlanet('Pisces')).toBe('Neptune');
    });
  });

  describe('getElementForSign', () => {
    it('должен возвращать правильный элемент для каждого знака', () => {
      // Fire signs
      expect(getElementForSign('Aries')).toBe('Fire');
      expect(getElementForSign('Leo')).toBe('Fire');
      expect(getElementForSign('Sagittarius')).toBe('Fire');
      
      // Earth signs
      expect(getElementForSign('Taurus')).toBe('Earth');
      expect(getElementForSign('Virgo')).toBe('Earth');
      expect(getElementForSign('Capricorn')).toBe('Earth');
      
      // Air signs
      expect(getElementForSign('Gemini')).toBe('Air');
      expect(getElementForSign('Libra')).toBe('Air');
      expect(getElementForSign('Aquarius')).toBe('Air');
      
      // Water signs
      expect(getElementForSign('Cancer')).toBe('Water');
      expect(getElementForSign('Scorpio')).toBe('Water');
      expect(getElementForSign('Pisces')).toBe('Water');
    });
  });

  describe('Константы', () => {
    it('должен содержать все 12 знаков зодиака', () => {
      expect(ZODIAC_SIGNS.length).toBe(12);
      expect(ZODIAC_SIGNS).toContain('Aries');
      expect(ZODIAC_SIGNS).toContain('Pisces');
    });

    it('должен иметь управляющую планету для каждого знака', () => {
      ZODIAC_SIGNS.forEach(sign => {
        expect(RULING_PLANETS[sign]).toBeDefined();
        expect(typeof RULING_PLANETS[sign]).toBe('string');
      });
    });

    it('должен иметь элемент для каждого знака', () => {
      ZODIAC_SIGNS.forEach(sign => {
        expect(SIGN_ELEMENTS[sign]).toBeDefined();
        expect(['Fire', 'Earth', 'Air', 'Water']).toContain(SIGN_ELEMENTS[sign]);
      });
    });
  });
});
