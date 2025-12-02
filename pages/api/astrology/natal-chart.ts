import type { NextApiRequest, NextApiResponse } from 'next';
import { calculateNatalChart } from '../../../lib/swisseph-calculator';
import { validateNatalChartInput, formatValidationErrors } from '../../../lib/validation';

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  log.info('Request received', {
    method: req.method,
    path: req.url
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, birthDate, birthTime, birthPlace, language } = req.body;

    // Строгая валидация входных данных
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
        userLanguage
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
      birthTime: birthTime || 'not provided',
      birthPlace,
      language: language || 'ru'
    });

    try {
      // Используем реальные расчеты Swiss Ephemeris
      const chartData = await calculateNatalChart(
        name,
        birthDate,
        birthTime || '12:00',
        birthPlace
      );

      log.info('Natal chart calculated successfully with Swiss Ephemeris', {
        hasSun: !!chartData.sun,
        hasMoon: !!chartData.moon,
        hasRising: !!chartData.rising,
        element: chartData.element
      });

      // Натальная карта статична для пользователя - кэшируем на долго
      // Но так как это персональные данные, кэшируем только на клиенте
      res.setHeader('Cache-Control', 'private, max-age=31536000, immutable'); // 1 год
      
      return res.status(200).json(chartData);
    } catch (swissephError: any) {
      // Если расчет Swiss Ephemeris не удался, возвращаем понятную ошибку
      log.error('Swiss Ephemeris calculation failed', {
        error: swissephError.message,
        stack: swissephError.stack
      });
      
      const userLanguage = language === 'en' ? 'en' : 'ru';
      const errorMessage = userLanguage === 'ru'
        ? 'Не удалось рассчитать натальную карту. Пожалуйста, проверьте правильность введенных данных и попробуйте снова.'
        : 'Failed to calculate natal chart. Please check your input data and try again.';
      
      return res.status(500).json({ 
        error: 'Calculation failed',
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? swissephError.message : undefined
      });
    }
  } catch (error: any) {
    log.error('Error calculating natal chart', {
      error: error.message,
      stack: error.stack
    });
    
    const userLanguage = req.body.language === 'en' ? 'en' : 'ru';
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
