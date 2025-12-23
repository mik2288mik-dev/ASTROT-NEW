import type { NextApiRequest, NextApiResponse } from 'next';

interface WeatherApiResponse {
  location: {
    name: string;
    region: string;
    country: string;
  };
  current: {
    temp_c: number;
    temp_f: number;
    condition: {
      text: string;
      icon: string;
      code: number;
    };
    humidity: number;
    cloud: number;
    feelslike_c: number;
    feelslike_f: number;
  };
  astronomy: {
    astro: {
      moon_phase: string;
      moon_illumination: string;
    };
  };
}

interface WeatherResponse {
  success: boolean;
  data?: {
    condition: string;
    temp: number;
    humidity: number;
    city: string;
    moonPhase?: {
      phase: string;
      illumination: number;
    };
  };
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WeatherResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { city } = req.query;

  if (!city || typeof city !== 'string') {
    return res.status(400).json({ 
      success: false, 
      error: 'City parameter is required' 
    });
  }

  const apiKey = process.env.WEATHER_API;

  if (!apiKey) {
    console.error('[Weather API] WEATHER_API key is not configured');
    return res.status(500).json({ 
      success: false, 
      error: 'Weather API is not configured' 
    });
  }

  try {
    // WeatherAPI.com endpoint для текущей погоды и астрономии
    const weatherUrl = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(city)}&aqi=no`;
    const astronomyUrl = `https://api.weatherapi.com/v1/astronomy.json?key=${apiKey}&q=${encodeURIComponent(city)}`;

    // Запрашиваем погоду и астрономию параллельно с таймаутом
    let weatherResponse, astronomyResponse;
    try {
      [weatherResponse, astronomyResponse] = await Promise.all([
        fetch(weatherUrl, { 
          signal: AbortSignal.timeout(10000) // 10 секунд таймаут
        }),
        fetch(astronomyUrl, { 
          signal: AbortSignal.timeout(10000) 
        })
      ]);
    } catch (fetchError: any) {
      console.error('[Weather API] Fetch error:', fetchError);
      if (fetchError.name === 'AbortError' || fetchError.name === 'TimeoutError') {
        return res.status(408).json({ 
          success: false, 
          error: 'Request timeout. Please try again later.' 
        });
      }
      throw fetchError;
    }

    if (!weatherResponse.ok) {
      const errorData = await weatherResponse.json().catch(() => ({}));
      console.error('[Weather API] Weather request failed:', weatherResponse.status, errorData);
      
      if (weatherResponse.status === 400) {
        const errorMessage = errorData?.error?.message || 'Invalid city name';
        return res.status(400).json({ 
          success: false, 
          error: errorMessage.includes('No matching location') || errorMessage.includes('Invalid')
            ? `City "${city}" not found. Please check the spelling and try again.`
            : 'Invalid city name. Please check the city name and try again.'
        });
      }
      
      if (weatherResponse.status === 401 || weatherResponse.status === 403) {
        return res.status(500).json({ 
          success: false, 
          error: 'Weather API authentication failed. Please contact support.' 
        });
      }
      
      return res.status(weatherResponse.status).json({ 
        success: false, 
        error: `Failed to fetch weather data (${weatherResponse.status})` 
      });
    }

    const weatherData: WeatherApiResponse = await weatherResponse.json();
    
    // Пытаемся получить данные о луне, но не критично если не получится
    let moonPhase: { phase: string; illumination: number } | undefined;
    if (astronomyResponse.ok) {
      try {
        const astronomyData = await astronomyResponse.json();
        if (astronomyData?.astronomy?.astro) {
          const illumination = parseFloat(astronomyData.astronomy.astro.moon_illumination || '0');
          moonPhase = {
            phase: astronomyData.astronomy.astro.moon_phase || 'Unknown',
            illumination: Math.round(illumination)
          };
        }
      } catch (error) {
        console.warn('[Weather API] Failed to parse astronomy data:', error);
        // Не критично, продолжаем без данных о луне
      }
    }

    const result = {
      condition: weatherData.current.condition.text,
      temp: Math.round(weatherData.current.temp_c),
      humidity: weatherData.current.humidity,
      city: weatherData.location.name,
      moonPhase: moonPhase
    };

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error: any) {
    console.error('[Weather API] Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch weather data' 
    });
  }
}
