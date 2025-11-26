# Database Migrations Guide

## Автоматические миграции

Система автоматических миграций настроена для Railway. Миграции запускаются автоматически при деплое.

## Как это работает

### 1. При деплое на Railway

Миграции запускаются автоматически через `postbuild` скрипт:
```json
"postbuild": "npm run migrate"
```

Это означает, что после успешной сборки (`npm run build`) автоматически запускается `npm run migrate`, который выполняет все миграции.

### 2. При старте приложения

Миграции также могут запускаться при старте приложения (если `RUN_MIGRATIONS=true`), но основной способ - через postbuild.

### 3. Ручной запуск миграций

Вы можете запустить миграции вручную:

**Через скрипт:**
```bash
npm run migrate
```

**Через API endpoint:**
```bash
POST /api/migrations/run
```

## Структура миграций

Все миграции находятся в `lib/migrations.ts`:

1. **001_create_users_table** - Создает таблицу users
2. **002_create_charts_table** - Создает таблицу charts
3. **003_create_indexes** - Создает индексы для производительности

## Добавление новой миграции

1. Создайте новую функцию миграции в `lib/migrations.ts`:
```typescript
async function migration004(pool: Pool): Promise<void> {
  const migrationName = '004_your_migration_name';
  
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info(`Applying migration ${migrationName}...`);
  
  // Ваш SQL код здесь
  await pool.query('ALTER TABLE users ADD COLUMN new_field VARCHAR(255)');
  
  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied successfully`);
}
```

2. Добавьте вызов в функцию `runMigrations()`:
```typescript
await migration004(pool);
```

## Проверка статуса миграций

Миграции отслеживаются в таблице `migrations`:
```sql
SELECT * FROM migrations ORDER BY applied_at DESC;
```

## Откат миграций

Для отката создайте новую миграцию, которая отменяет изменения:
```typescript
async function migration005_rollback(pool: Pool): Promise<void> {
  // Откат изменений из migration004
  await pool.query('ALTER TABLE users DROP COLUMN IF EXISTS new_field');
}
```

## Логирование

Все операции миграций логируются:
- `[Migrations]` - успешные операции
- `[Migrations] ERROR` - ошибки
- `[Migrations] WARNING` - предупреждения

Проверяйте логи Railway для отслеживания миграций.

## Troubleshooting

### Миграции не запускаются

1. Проверьте что `DATABASE_URL` установлен в Railway
2. Проверьте логи Railway build/deploy
3. Запустите миграции вручную через API: `POST /api/migrations/run`

### Ошибка подключения к БД

1. Убедитесь что Railway Database создан и подключен к проекту
2. Проверьте `DATABASE_URL` в переменных окружения Railway
3. Проверьте что драйвер `pg` установлен

### Миграция уже применена

Система автоматически пропускает уже примененные миграции. Если нужно перезапустить миграцию, удалите запись из таблицы `migrations`:
```sql
DELETE FROM migrations WHERE name = '001_create_users_table';
```
