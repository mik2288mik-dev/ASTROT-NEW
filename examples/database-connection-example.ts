/**
 * Примеры подключения к базе данных PostgreSQL через process.env.DATABASE_URL
 * 
 * Этот файл содержит примеры использования DATABASE_URL из переменных окружения
 */

import { Client, Pool } from 'pg';

// ============================================================================
// Пример 1: Простое подключение через Client (для тестирования)
// ============================================================================

async function example1_SimpleClientConnection() {
  // Чтение DATABASE_URL из переменных окружения
  const client = new Client({
    connectionString: process.env.DATABASE_URL, // Чтение переменной из окружения
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Выполнение простого запроса
    const result = await client.query('SELECT NOW()');
    console.log('Current database time:', result.rows[0].now);
    
    await client.end();
  } catch (err: any) {
    console.error('❌ Database connection error:', err.stack);
    await client.end().catch(() => {}); // Закрываем соединение при ошибке
  }
}

// ============================================================================
// Пример 2: Использование Pool (рекомендуется для production)
// ============================================================================

async function example2_PoolConnection() {
  // Pool управляет несколькими соединениями автоматически
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Чтение из окружения
    max: 20, // Максимум соединений
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  try {
    // Тест подключения
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Pool connection successful');
    console.log('Current database time:', result.rows[0].now);
    
    // Выполнение запроса
    const users = await pool.query('SELECT COUNT(*) FROM users');
    console.log('Total users:', users.rows[0].count);
    
  } catch (err: any) {
    console.error('❌ Pool connection error:', err.stack);
  } finally {
    await pool.end(); // Закрываем pool
  }
}

// ============================================================================
// Пример 3: Проверка наличия DATABASE_URL перед подключением
// ============================================================================

async function example3_WithValidation() {
  // Проверяем, что DATABASE_URL установлен
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set in environment variables');
    console.error('Please set DATABASE_URL in Railway Variables or .env file');
    return;
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Парсинг информации о подключении (без пароля)
    const urlMatch = process.env.DATABASE_URL.match(/^postgres(ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
    if (urlMatch) {
      const [, , user, , host, port, database] = urlMatch;
      console.log(`Connected to: ${host}:${port}/${database} (user: ${user})`);
    }
    
    await client.end();
  } catch (err: any) {
    console.error('❌ Database connection error:', err.message);
    await client.end().catch(() => {});
  }
}

// ============================================================================
// Пример 4: Использование с SSL (для production)
// ============================================================================

async function example4_WithSSL() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: false } // Для Railway production
      : false, // Для локальной разработки
  });

  try {
    await client.connect();
    console.log('✅ Connected with SSL');
    await client.end();
  } catch (err: any) {
    console.error('❌ SSL connection error:', err.stack);
    await client.end().catch(() => {});
  }
}

// ============================================================================
// Запуск примеров (раскомментируйте нужный)
// ============================================================================

// example1_SimpleClientConnection();
// example2_PoolConnection();
// example3_WithValidation();
// example4_WithSSL();

export {
  example1_SimpleClientConnection,
  example2_PoolConnection,
  example3_WithValidation,
  example4_WithSSL,
};
