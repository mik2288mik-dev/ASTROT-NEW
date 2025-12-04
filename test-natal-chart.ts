/**
 * Простой скрипт для проверки расчета натальной карты
 * Тестирует конкретный случай: 6 марта 1989 года = Рыбы
 */

import { calculateNatalChart } from './lib/swisseph-calculator';
import { getApproximateSunSignByDate } from './lib/zodiac-utils';

async function testNatalChart() {
  console.log('='.repeat(80));
  console.log('ТЕСТ РАСЧЕТА НАТАЛЬНОЙ КАРТЫ');
  console.log('='.repeat(80));
  console.log('');

  // Тестовые данные
  const testCases = [
    {
      name: 'Тест 1: 6 марта 1989 года',
      birthDate: '1989-03-06',
      birthTime: '12:00',
      birthPlace: 'Moscow, Russia',
      expectedSign: 'Pisces'
    },
    {
      name: 'Тест 2: 6 марта 1989 года (утро)',
      birthDate: '1989-03-06',
      birthTime: '08:00',
      birthPlace: 'Moscow, Russia',
      expectedSign: 'Pisces'
    },
    {
      name: 'Тест 3: 6 марта 1989 года (вечер)',
      birthDate: '1989-03-06',
      birthTime: '20:00',
      birthPlace: 'Moscow, Russia',
      expectedSign: 'Pisces'
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`${testCase.name}`);
    console.log(`${'─'.repeat(80)}`);
    
    try {
      // Проверяем приблизительный знак по дате
      const [year, month, day] = testCase.birthDate.split('-').map(Number);
      const approximateSign = getApproximateSunSignByDate(year, month, day);
      console.log(`✓ Приблизительный знак по дате: ${approximateSign}`);
      console.log(`  Ожидаемый знак: ${testCase.expectedSign}`);
      console.log(`  Совпадение: ${approximateSign === testCase.expectedSign ? '✓ ДА' : '✗ НЕТ'}`);
      
      // Рассчитываем натальную карту
      console.log(`\nРассчитываем натальную карту...`);
      console.log(`  Дата: ${testCase.birthDate}`);
      console.log(`  Время: ${testCase.birthTime}`);
      console.log(`  Место: ${testCase.birthPlace}`);
      
      const chart = await calculateNatalChart(
        'Test User',
        testCase.birthDate,
        testCase.birthTime,
        testCase.birthPlace
      );

      console.log(`\n✓ Натальная карта рассчитана успешно!`);
      console.log(`\n📊 РЕЗУЛЬТАТЫ:`);
      console.log(`  ☀️  Солнце: ${chart.sun.sign} (${chart.sun.degree.toFixed(2)}°)`);
      console.log(`  🌙 Луна: ${chart.moon.sign} (${chart.moon.degree.toFixed(2)}°)`);
      console.log(`  ⬆️  Асцендент: ${chart.rising.sign} (${chart.rising.degree.toFixed(2)}°)`);
      console.log(`  🌟 Элемент: ${chart.element}`);
      console.log(`  🪐 Управляющая планета: ${chart.rulingPlanet}`);

      // Проверка результата
      const isCorrect = chart.sun.sign === testCase.expectedSign;
      console.log(`\n${'='.repeat(80)}`);
      if (isCorrect) {
        console.log(`✅ ТЕСТ ПРОЙДЕН! Знак Солнца правильный: ${chart.sun.sign}`);
      } else {
        console.log(`❌ ТЕСТ НЕ ПРОЙДЕН!`);
        console.log(`   Ожидалось: ${testCase.expectedSign}`);
        console.log(`   Получено: ${chart.sun.sign}`);
      }
      console.log(`${'='.repeat(80)}`);

    } catch (error: any) {
      console.error(`\n❌ ОШИБКА при расчете:`, error.message);
      console.error(`   Stack trace:`, error.stack);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('ТЕСТИРОВАНИЕ ЗАВЕРШЕНО');
  console.log('='.repeat(80));
}

// Запускаем тест
testNatalChart()
  .then(() => {
    console.log('\n✓ Все тесты выполнены');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Критическая ошибка:', error);
    process.exit(1);
  });
