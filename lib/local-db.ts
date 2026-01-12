
import fs from 'fs';
import path from 'path';

// Path to local JSON DB file
const DB_FILE = path.join(process.cwd(), 'local-db.json');

// Interface for the DB structure
interface LocalDB {
  users: Record<string, any>;
  charts: Record<string, any>;
  userSettings: Record<string, any>;
  dailyHoroscope: Record<string, Record<string, any>>; // userId -> date -> content
  synastryCache: Record<string, any>;
  forecastsCache: Record<string, any>;
  regenerations: any[];
  deepDiveAnalyses: Record<string, Record<string, string>>; // userId -> topic -> analysis
  dailyHoroscopesCache: Record<string, Record<string, any>>; // sign -> date -> content
}

// Initial state
const INITIAL_DB: LocalDB = {
  users: {},
  charts: {},
  userSettings: {},
  dailyHoroscope: {},
  synastryCache: {},
  forecastsCache: {},
  regenerations: [],
  deepDiveAnalyses: {},
  dailyHoroscopesCache: {}
};

// Helper to read/write DB
class JsonStorage {
  private data: LocalDB;

  constructor() {
    this.data = this.load();
  }

  private load(): LocalDB {
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(fileContent);
      }
    } catch (error) {
      console.error('Failed to load local DB:', error);
    }
    return JSON.parse(JSON.stringify(INITIAL_DB));
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Failed to save local DB:', error);
    }
  }

  // Users
  getUser(id: string) {
    return this.data.users[id] || null;
  }

  setUser(id: string, data: any) {
    // Merge logic similar to Postgres
    const existing = this.data.users[id] || {};
    
    // Handle specific fields
    let generatedContent = data.generated_content;
    if (generatedContent === undefined) {
        generatedContent = existing.generated_content;
    } else if (generatedContent && typeof generatedContent === 'string') {
        try { generatedContent = JSON.parse(generatedContent); } catch {}
    }

    let evolution = data.evolution;
    if (evolution === undefined) {
        evolution = existing.evolution;
    } else if (evolution && typeof evolution === 'string') {
        try { evolution = JSON.parse(evolution); } catch {}
    }

    const updated = {
      ...existing,
      ...data,
      id,
      generated_content: generatedContent,
      evolution: evolution,
      updated_at: new Date().toISOString()
    };

    if (!updated.created_at) updated.created_at = new Date().toISOString();

    this.data.users[id] = updated;
    this.save();
    return updated;
  }

  getAllUsers() {
    return Object.values(this.data.users).sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  // Charts
  getChart(userId: string) {
    return this.data.charts[userId] || null;
  }

  setChart(userId: string, chartData: any, birthDate?: string, birthTime?: string, birthPlace?: string) {
    const data = chartData.chart_data || chartData;
    const inputHash = birthDate && birthPlace 
          ? Buffer.from(`${birthDate}|${birthTime || '12:00'}|${birthPlace}`).toString('base64').substring(0, 64)
          : null;

    const record = {
      user_id: userId,
      chart_data: data,
      birth_date: birthDate,
      birth_time: birthTime,
      birth_place: birthPlace,
      input_hash: inputHash,
      calculated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_at: this.data.charts[userId]?.created_at || new Date().toISOString()
    };

    this.data.charts[userId] = record;
    this.save();
    return record;
  }

  // Settings
  getUserSettings(userId: string) {
    const settings = this.data.userSettings[userId];
    if (!settings) return null;
    
    return {
      userId: settings.user_id,
      weatherCity: settings.weather_city,
      weatherLat: settings.weather_lat,
      weatherLon: settings.weather_lon,
      weatherUnits: settings.weather_units,
      timezone: settings.timezone,
      updatedAt: settings.updated_at
    };
  }

  setUserWeatherCity(userId: string, city: string | null, lat?: number, lon?: number) {
    const existing = this.data.userSettings[userId] || { user_id: userId, created_at: new Date().toISOString() };
    
    existing.weather_city = city;
    if (lat) existing.weather_lat = lat;
    if (lon) existing.weather_lon = lon;
    existing.updated_at = new Date().toISOString();

    this.data.userSettings[userId] = existing;
    this.save();
    return {
        userId,
        weatherCity: city,
        weatherLat: lat,
        weatherLon: lon,
        updatedAt: existing.updated_at
    };
  }

  // Daily Horoscope
  getDailyHoroscope(userId: string, dateKey: string) {
    const userHoroscopes = this.data.dailyHoroscope[userId] || {};
    const record = userHoroscopes[dateKey];
    if (!record) return null;

    return {
        content: record.content,
        zodiacSign: record.zodiac_sign,
        createdAt: record.created_at
    };
  }

  setDailyHoroscope(userId: string, dateKey: string, content: any, zodiacSign?: string) {
    if (!this.data.dailyHoroscope[userId]) {
        this.data.dailyHoroscope[userId] = {};
    }
    
    const record = {
        user_id: userId,
        date_key: dateKey,
        content: content,
        zodiac_sign: zodiacSign,
        created_at: new Date().toISOString()
    };

    this.data.dailyHoroscope[userId][dateKey] = record;
    this.save();
    return {
        content: record.content,
        zodiacSign: record.zodiac_sign,
        createdAt: record.created_at
    };
  }

  // Cached Texts (stored in user record)
  setCachedText(userId: string, field: string, value: string) {
    const user = this.data.users[userId];
    if (user) {
        user[field] = value;
        user[`${field}_updated_at`] = new Date().toISOString();
        this.save();
    }
  }

  getCachedText(userId: string, field: string) {
    const user = this.data.users[userId];
    if (user && user[field]) {
        return {
            data: user[field],
            updatedAt: user[`${field}_updated_at`]
        };
    }
    return null;
  }
}

export const jsonDb = new JsonStorage();
