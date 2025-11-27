# Исправление сохранения и загрузки данных из БД

## Проблема

При запуске приложения страница с полями ввода данных пользователя (Onboarding) отображалась **даже для существующих пользователей**, у которых данные уже были сохранены в базе данных.

## Причина

Обнаружена **критическая ошибка в API** `/pages/api/users/[id].ts`:

- База данных хранит данные в **snake_case** формате (`is_setup`)
- Клиент ожидает данные в **camelCase** формате (`isSetup`)
- При GET запросе API **не преобразовывал** формат данных из БД в формат клиента
- В результате клиент получал объект с полем `is_setup`, но проверял поле `isSetup`
- Проверка `if (storedProfile && storedProfile.isSetup)` всегда возвращала `false` (undefined)
- Приложение показывало Onboarding для всех пользователей

## Решение

### 1. Исправлен API `/pages/api/users/[id].ts`

**Было:**
```typescript
if (req.method === 'GET') {
  const user = await db.users.get(userId);
  // ...
  return res.status(200).json(user); // ❌ Возвращает snake_case
}
```

**Стало:**
```typescript
if (req.method === 'GET') {
  const user = await db.users.get(userId);
  // ...
  
  // Преобразуем snake_case в camelCase для клиента
  const clientUser = {
    id: user.id,
    name: user.name,
    birthDate: user.birth_date,        // ✅ birth_date → birthDate
    birthTime: user.birth_time,        // ✅ birth_time → birthTime
    birthPlace: user.birth_place,      // ✅ birth_place → birthPlace
    isSetup: user.is_setup,           // ✅ is_setup → isSetup
    language: user.language,
    theme: user.theme,
    isPremium: user.is_premium,       // ✅ is_premium → isPremium
    isAdmin: user.is_admin,           // ✅ is_admin → isAdmin
    threeKeys: user.three_keys,       // ✅ three_keys → threeKeys
    evolution: user.evolution,
  };
  
  return res.status(200).json(clientUser); // ✅ Возвращает camelCase
}
```

### 2. Улучшено логирование

Добавлено детальное логирование для отладки:

- В `storageService.ts`: логируются полные данные профиля при загрузке
- В `App.tsx`: логируются данные из БД и значение `isSetup`
- В `pages/api/users/[id].ts`: логируется значение `is_setup` при загрузке

### 3. Создан тестовый скрипт

Добавлен файл `/scripts/test-db.ts` для проверки корректности работы БД:

```bash
npm run test-db
```

Скрипт проверяет:
- ✅ Сохранение пользователя в БД
- ✅ Загрузку пользователя из БД
- ✅ Корректность поля `is_setup`
- ✅ Сохранение и загрузку карты
- ✅ Обработку несуществующих пользователей

## Логика работы после исправления

### Для новых пользователей:
1. Пользователь открывает приложение
2. `getProfile()` → возвращает `null` (404)
3. Показывается **Onboarding** (форма ввода данных)
4. Пользователь вводит данные и отмечает "Запомнить данные" ✅
5. `isSetup = true` → данные сохраняются в БД
6. При следующем входе → **Dashboard** (онбординг пропускается)

### Для существующих пользователей:
1. Пользователь открывает приложение
2. `getProfile()` → возвращает профиль с `isSetup: true`
3. Проверка `if (storedProfile && storedProfile.isSetup)` → **true**
4. Показывается **Dashboard** (онбординг пропускается) ✅

### Если пользователь НЕ отметил "Запомнить данные":
1. `isSetup = false` → данные НЕ сохраняются
2. При следующем входе → **Onboarding** снова показывается

## Файлы, которые были изменены

1. ✅ `/pages/api/users/[id].ts` - исправлено преобразование данных
2. ✅ `/services/storageService.ts` - улучшено логирование
3. ✅ `/App.tsx` - улучшено логирование
4. ✅ `/scripts/test-db.ts` - создан тестовый скрипт
5. ✅ `/package.json` - добавлена команда `test-db`

## Проверка исправления

### Способ 1: Автоматический тест
```bash
npm run test-db
```

### Способ 2: Ручное тестирование
1. Запустить приложение: `npm run dev`
2. Открыть в Telegram WebApp
3. Пройти Onboarding, отметить "Запомнить данные"
4. Закрыть приложение
5. Открыть снова → должен показаться Dashboard (не Onboarding)

### Способ 3: Проверка логов
Открыть консоль браузера и найти логи:
```
[StorageService] [getProfile] Successfully loaded profile from database
  isSetup: true ✅
  
[App] Loaded data from database:
  hasProfile: true ✅
  profileIsSetup: true ✅
  
[App] User data found in database, preparing to show chart ✅
```

## Дополнительные улучшения

### Защита от регрессии

В будущем при добавлении новых полей в профиль пользователя:
1. Добавить поле в БД (snake_case)
2. Добавить преобразование в API GET метод (camelCase)
3. Добавить преобразование в API POST метод (snake_case)

### Рекомендации

- ✅ Использовать единую функцию преобразования форматов
- ✅ Добавить TypeScript типы для данных БД
- ✅ Регулярно запускать `npm run test-db` для проверки

## Итог

✅ **Проблема решена**: Теперь приложение корректно определяет существующих пользователей и не показывает им Onboarding при повторном входе.

✅ **API исправлен**: Данные корректно преобразуются между форматами БД и клиента.

✅ **Логирование улучшено**: Теперь легко отслеживать процесс загрузки данных.

✅ **Тесты добавлены**: Можно проверить работу БД автоматически.
