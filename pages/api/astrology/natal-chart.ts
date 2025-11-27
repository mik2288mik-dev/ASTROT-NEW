import type { NextApiRequest, NextApiResponse } from 'next';
import { calculateNatalChart } from '../../../lib/swisseph-calculator';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/astrology/natal-chart] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/astrology/natal-chart] ERROR: ${message}`, error || '');
  },
};

// Моковые данные как fallback
function generateMockChart(name: string): any {
  const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  const randomSign = () => signs[Math.floor(Math.random() * signs.length)];
  const elements = ['Fire', 'Water', 'Air', 'Earth'];
  const planets = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Jupiter'];

  return {
    sun: { planet: 'Sun', sign: randomSign(), degree: Math.random() * 30, description: 'Your core essence and identity.' },
    moon: { planet: 'Moon', sign: randomSign(), degree: Math.random() * 30, description: 'Your emotional nature and inner self.' },
    rising: { planet: 'Ascendant', sign: randomSign(), degree: Math.random() * 30, description: 'Your outer personality and first impressions.' },
    mercury: { planet: 'Mercury', sign: randomSign(), degree: Math.random() * 30, description: 'Your communication style and thinking patterns.' },
    venus: { planet: 'Venus', sign: randomSign(), degree: Math.random() * 30, description: 'Your love language and values.' },
    mars: { planet: 'Mars', sign: randomSign(), degree: Math.random() * 30, description: 'Your drive and passion.' },
    element: elements[Math.floor(Math.random() * elements.length)],
    rulingPlanet: planets[Math.floor(Math.random() * planets.length)],
    summary: `This is a mystical reading for ${name}. The stars reveal a complex and beautiful soul journey.`
  };
}

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

    // Validate required fields
    if (!name || !birthDate || !birthPlace) {
      log.error('Missing required fields', {
        hasName: !!name,
        hasBirthDate: !!birthDate,
        hasBirthPlace: !!birthPlace
      });
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'Name, birthDate, and birthPlace are required'
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

      return res.status(200).json(chartData);
    } catch (swissephError: any) {
      // Если расчет Swiss Ephemeris не удался, используем mock данные
      log.error('Swiss Ephemeris calculation failed, falling back to mock data', {
        error: swissephError.message
      });
      
      const mockData = generateMockChart(name);
      log.info('Returning mock natal chart data');
      
      return res.status(200).json(mockData);
    }
  } catch (error: any) {
    log.error('Error calculating natal chart', {
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
