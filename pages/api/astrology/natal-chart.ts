import type { NextApiRequest, NextApiResponse } from 'next';
import { calculateNatalChart } from '../../../lib/swisseph-calculator';
import { validateNatalChartInput, formatValidationErrors } from '../../../lib/validation';
import { withRateLimit, RATE_LIMIT_CONFIGS } from '../../../lib/rateLimit';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/astrology/natal-chart] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/astrology/natal-chart] ERROR: ${message}`, error || '');
  },
};

// УДАЛЕНО: generateMockChart - больше не используем mock данные

/**
 * ЧЕТКАЯ ЛОГИКА ОБРАБОТКИ ЗАПРОСА НАТАЛЬНОЙ КАРТЫ:
 * 1. Валидация метода запроса
 * 2. Валидация входных данных
 * 3. Расчет натальной карты через Swiss Ephemeris
 * 4. Обработка ошибок с понятными сообщениями
 * 5. Возврат результата с правильными заголовками кэширования
 */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  log.info('Request received', {
    method: req.method,
    path: req.url
  });

  // Шаг 1: Валидация метода запроса
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST method is allowed'
    });
  }

  try {
    const { name, birthDate, birthTime, birthPlace, language } = req.body;

    // Шаг 2: Строгая валидация входных данных
    const validation = validateNatalChartInput({
      name,
      birthDate,
      birthTime,
      birthPlace,
      language: language || 'ru'
    });

    if (!validation.isValid) {
      const userLanguage = language === 'en' ? 'en' : 'ru';
      const errorMessage = formatValidationErrors(validation.errors, userLanguage);
      
      log.error('Validation failed', {
        errors: validation.errors,
        userLanguage,
        input: { name, birthDate, birthTime, birthPlace }
      });
      
      return res.status(400).json({ 
        error: 'Validation failed',
        message: errorMessage,
        errors: validation.errors
      });
    }

    log.info('Calculating natal chart with Swiss Ephemeris', {
      name,
      birthDate,
      birthTime: birthTime || '12:00 (default)',
      birthPlace,
      language: language || 'ru'
    });

    // Шаг 3: Расчет натальной карты
    try {
      const startTime = Date.now();
      
      const chartData = await calculateNatalChart(
        name,
        birthDate,
        birthTime || '12:00',
        birthPlace
      );

      const duration = Date.now() - startTime;

      // Валидация результата расчета
      if (!chartData || !chartData.sun || !chartData.moon || !chartData.rising) {
        throw new Error('Invalid chart data: missing essential planets');
      }

      log.info('Natal chart calculated successfully', {
        duration: `${duration}ms`,
        hasSun: !!chartData.sun,
        hasMoon: !!chartData.moon,
        hasRising: !!chartData.rising,
        element: chartData.element,
        sunSign: chartData.sun.sign,
        moonSign: chartData.moon.sign,
        risingSign: chartData.rising.sign
      });

      // Шаг 4: Установка заголовков кэширования
      // Натальная карта статична для пользователя - кэшируем на долго
      // Но так как это персональные данные, кэшируем только на клиенте
      res.setHeader('Cache-Control', 'private, max-age=31536000, immutable'); // 1 год
      
      return res.status(200).json(chartData);
      
    } catch (calculationError: any) {
      // Шаг 5: Обработка ошибок расчета
      log.error('Swiss Ephemeris calculation failed', {
        error: calculationError.message,
        stack: calculationError.stack,
        name: calculationError.name,
        code: calculationError.code,
        input: { name, birthDate, birthTime, birthPlace }
      });
      
      const userLanguage = language === 'en' ? 'en' : 'ru';
      
      // Классификация ошибок для более точных сообщений
      const errorMsg = (calculationError.message || '').toLowerCase();
      let errorMessage = '';
      let statusCode = 500;
      
      if (errorMsg.includes('location not found') || 
          errorMsg.includes('coordinates') || 
          errorMsg.includes('не удалось найти') ||
          errorMsg.includes('nominatim')) {
        // Ошибка геокодинга
        statusCode = 400;
        errorMessage = userLanguage === 'ru'
          ? 'Не удалось найти указанное место рождения. Пожалуйста, проверьте правильность написания (например: "Москва, Россия" или "Moscow, Russia").'
          : 'Location not found. Please check the spelling of your birth place (e.g., "Moscow, Russia").';
      } else if (errorMsg.includes('инициализац') || 
                 errorMsg.includes('initialize') || 
                 errorMsg.includes('ephemeris') || 
                 errorMsg.includes('swiss') ||
                 errorMsg.includes('instance')) {
        // Ошибка инициализации Swiss Ephemeris
        statusCode = 500;
        errorMessage = userLanguage === 'ru'
          ? 'Ошибка инициализации астрономических расчетов. Пожалуйста, попробуйте позже или обновите страницу.'
          : 'Astronomical calculation initialization error. Please try again later or refresh the page.';
      } else if (errorMsg.includes('time') || 
                 errorMsg.includes('date') || 
                 errorMsg.includes('время') || 
                 errorMsg.includes('дата') ||
                 errorMsg.includes('invalid date')) {
        // Ошибка обработки даты/времени
        statusCode = 400;
        errorMessage = userLanguage === 'ru'
          ? 'Ошибка обработки даты или времени. Пожалуйста, проверьте правильность введенных данных.'
          : 'Date or time processing error. Please check your input data.';
      } else if (errorMsg.includes('timeout') || 
                 errorMsg.includes('network') ||
                 errorMsg.includes('connection')) {
        // Сетевые ошибки
        statusCode = 503;
        errorMessage = userLanguage === 'ru'
          ? 'Ошибка соединения с сервисом геолокации. Пожалуйста, проверьте интернет-соединение и попробуйте позже.'
          : 'Connection error with geolocation service. Please check your internet connection and try again later.';
      } else {
        // Общая ошибка
        // Используем сообщение из ошибки, если оно есть и понятное
        if (calculationError.message && calculationError.message.length < 200) {
          errorMessage = calculationError.message;
        } else {
          errorMessage = userLanguage === 'ru'
            ? 'Не удалось рассчитать натальную карту. Пожалуйста, проверьте правильность введенных данных и попробуйте снова.'
            : 'Failed to calculate natal chart. Please check your input data and try again.';
        }
      }
      
      return res.status(statusCode).json({ 
        error: 'Calculation failed',
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? calculationError.message : undefined
      });
    }
  } catch (error: any) {
    // Обработка неожиданных ошибок
    log.error('Unexpected error in natal chart handler', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    
    const userLanguage = req.body?.language === 'en' ? 'en' : 'ru';
    const errorMessage = userLanguage === 'ru'
      ? 'Произошла ошибка при расчете натальной карты. Пожалуйста, попробуйте позже.'
      : 'An error occurred while calculating the natal chart. Please try again later.';
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Применяем rate limiting: 10 запросов в минуту для всех
export default withRateLimit(handler, RATE_LIMIT_CONFIGS.FREE);
