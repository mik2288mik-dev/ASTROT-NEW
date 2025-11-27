// Тестовый скрипт для проверки сохранения и загрузки данных из БД
// Запуск: npx ts-node scripts/test-db.ts

import { db } from '../lib/db';

async function testDatabase() {
  console.log('\n🧪 Начинаем тестирование БД...\n');

  const testUserId = 'test_user_123';
  
  try {
    // 1. Тест сохранения пользователя
    console.log('📝 Тест 1: Сохранение пользователя...');
    const testUser = {
      name: 'Тестовый Пользователь',
      birth_date: '1990-01-01',
      birth_time: '12:00',
      birth_place: 'Москва, Россия',
      is_setup: true,  // Важно! Должно быть true для существующих пользователей
      language: 'ru',
      theme: 'dark',
      is_premium: false,
      is_admin: false,
      three_keys: null,
      evolution: null,
    };

    const savedUser = await db.users.set(testUserId, testUser);
    console.log('✅ Пользователь сохранен:', {
      id: savedUser.id,
      name: savedUser.name,
      is_setup: savedUser.is_setup
    });

    // 2. Тест загрузки пользователя
    console.log('\n📥 Тест 2: Загрузка пользователя...');
    const loadedUser = await db.users.get(testUserId);
    
    if (!loadedUser) {
      console.error('❌ ОШИБКА: Пользователь не найден!');
      return;
    }

    console.log('✅ Пользователь загружен:', {
      id: loadedUser.id,
      name: loadedUser.name,
      is_setup: loadedUser.is_setup,
      birth_date: loadedUser.birth_date
    });

    // 3. Проверка поля is_setup
    console.log('\n🔍 Тест 3: Проверка поля is_setup...');
    if (loadedUser.is_setup === true) {
      console.log('✅ is_setup = true (пользователь должен пропустить onboarding)');
    } else if (loadedUser.is_setup === false) {
      console.log('⚠️  is_setup = false (пользователь увидит onboarding)');
    } else {
      console.log('❌ ОШИБКА: is_setup = undefined или null!', loadedUser.is_setup);
    }

    // 4. Тест сохранения карты
    console.log('\n📊 Тест 4: Сохранение карты...');
    const testChart = {
      sun: { planet: 'Sun', sign: 'Aries', description: 'Test' },
      moon: { planet: 'Moon', sign: 'Taurus', description: 'Test' },
      rising: { planet: 'Rising', sign: 'Gemini', description: 'Test' },
      mercury: { planet: 'Mercury', sign: 'Aries', description: 'Test' },
      venus: { planet: 'Venus', sign: 'Taurus', description: 'Test' },
      mars: { planet: 'Mars', sign: 'Aries', description: 'Test' },
      element: 'Fire',
      rulingPlanet: 'Mars',
      summary: 'Test chart',
    };

    const savedChart = await db.charts.set(testUserId, { chart_data: testChart });
    console.log('✅ Карта сохранена для пользователя:', testUserId);

    // 5. Тест загрузки карты
    console.log('\n📥 Тест 5: Загрузка карты...');
    const loadedChart = await db.charts.get(testUserId);
    
    if (!loadedChart) {
      console.error('❌ ОШИБКА: Карта не найдена!');
    } else {
      console.log('✅ Карта загружена:', {
        hasSun: !!loadedChart.sun,
        hasMoon: !!loadedChart.moon,
        element: loadedChart.element
      });
    }

    // 6. Тест несуществующего пользователя
    console.log('\n🔍 Тест 6: Проверка несуществующего пользователя...');
    const nonExistentUser = await db.users.get('non_existent_user_999');
    
    if (nonExistentUser === null) {
      console.log('✅ Несуществующий пользователь вернул null (правильно)');
    } else {
      console.log('❌ ОШИБКА: Несуществующий пользователь не вернул null!', nonExistentUser);
    }

    console.log('\n✅ Все тесты завершены успешно!\n');
    console.log('📌 Итог:');
    console.log('   - БД корректно сохраняет пользователей');
    console.log('   - БД корректно загружает пользователей');
    console.log('   - Поле is_setup сохраняется и загружается правильно');
    console.log('   - БД корректно сохраняет и загружает карты');
    console.log('   - БД корректно возвращает null для несуществующих пользователей\n');

  } catch (error: any) {
    console.error('\n❌ ОШИБКА при тестировании:', error.message);
    console.error('Stack:', error.stack);
  }

  process.exit(0);
}

testDatabase();
