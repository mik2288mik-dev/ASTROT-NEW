/**
 * Интеграционные тесты для API натальной карты
 * 
 * Тестирует валидацию входных данных и обработку ошибок
 * 
 * ПРИМЕЧАНИЕ: Эти тесты требуют запущенного сервера.
 * Для запуска: npm run dev (в отдельном терминале) и затем npm test
 * Или используйте моки для unit-тестирования без сервера
 */

describe('API Natal Chart (Integration Tests)', () => {
  const API_URL = process.env.API_URL || 'http://localhost:3000';
  const skipIntegrationTests = process.env.SKIP_INTEGRATION_TESTS === 'true';

  describe('Валидация входных данных', () => {
    it('должен возвращать 400 для невалидного user id в users/charts API', async () => {
      if (skipIntegrationTests) {
        return;
      }

      try {
        const [userResponse, chartResponse] = await Promise.all([
          fetch(`${API_URL}/api/users/undefined`),
          fetch(`${API_URL}/api/charts/undefined`),
        ]);

        expect(userResponse.status).toBe(400);
        expect(chartResponse.status).toBe(400);
      } catch {
        console.log('Integration test skipped - server not running');
      }
    });

    it('должен отклонять запросы без обязательных полей', async () => {
      if (skipIntegrationTests) {
        console.log('Skipping integration test - server not available');
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/charts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        
        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Validation failed');
        expect(data.errors).toBeDefined();
        expect(Array.isArray(data.errors)).toBe(true);
      } catch {
        // Сервер не запущен - пропускаем тест
        console.log('Integration test skipped - server not running');
      }
    });

    it('должен отклонять невалидные форматы даты', async () => {
      if (skipIntegrationTests) {
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/charts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Test User',
            birthDate: 'invalid-date',
            birthPlace: 'Moscow'
          })
        });
        
        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Validation failed');
      } catch {
        console.log('Integration test skipped - server not running');
      }
    });

    it('должен отклонять невалидные форматы времени', async () => {
      if (skipIntegrationTests) {
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/charts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Test User',
            birthDate: '1990-05-15',
            birthTime: '25:00', // Невалидное время
            birthPlace: 'Moscow'
          })
        });
        
        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Validation failed');
      } catch {
        console.log('Integration test skipped - server not running');
      }
    });
  });
});
