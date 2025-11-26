# Astrot - Soulful Astrology App

Astrology application built with Next.js, React, and TypeScript.

## Migration from Vite to Next.js

This project has been migrated from Vite to Next.js to enable:
- Server-side rendering (SSR)
- API Routes for backend logic
- Better integration with Railway Database
- Improved data persistence (no more localStorage fallback)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Railway account (for database)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

3. Configure your `.env` file:
- `DATABASE_URL`: Your Railway Database connection string
- `OPENAI_API_KEY`: (Optional) For AI features
- `EPHE_PATH`: (Optional) Path to Swiss Ephemeris files
- `USE_SWE_WASM`: Set to 'true' to use WebAssembly version

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
├── pages/
│   ├── api/              # API Routes
│   │   ├── users/       # User management endpoints
│   │   ├── charts/       # Chart data endpoints
│   │   └── astrology/   # Astrology calculation endpoints
│   ├── _app.tsx         # Next.js app wrapper
│   ├── _document.tsx    # Next.js document wrapper
│   └── index.tsx        # Home page
├── components/          # React components
├── views/              # Page views/components
├── services/           # Business logic services
├── lib/                # Utility libraries (DB, etc.)
├── styles/             # Global styles
└── types.ts            # TypeScript type definitions
```

## Database Setup

The application uses Railway Database for data persistence. 

### Setting up Railway Database

1. Create a PostgreSQL or MySQL database on Railway
2. Copy the connection string to `DATABASE_URL` in your `.env` file
3. Install the appropriate database driver:
   ```bash
   # For PostgreSQL
   npm install pg @types/pg
   
   # OR for MySQL
   npm install mysql2
   ```
4. Update `lib/db.ts` - uncomment the appropriate database connection code (PostgreSQL or MySQL)
5. The application will automatically create necessary tables on first run (when `initializeDatabase()` is called)

### Database Schema

- **users**: User profiles and settings
  - id (VARCHAR PRIMARY KEY)
  - name, birth_date, birth_time, birth_place
  - is_setup, language, theme
  - is_premium, is_admin
  - three_keys (JSONB)
  - evolution (JSONB)
  - created_at, updated_at

- **charts**: Natal chart data per user
  - user_id (VARCHAR PRIMARY KEY, FOREIGN KEY)
  - chart_data (JSONB)
  - created_at, updated_at

**Note**: Currently using in-memory fallback until database driver is installed and configured.

## API Routes

### Users
- `GET /api/users/[id]` - Get user profile
- `POST /api/users/[id]` - Create/update user profile
- `GET /api/users` - Get all users (admin)

### Charts
- `GET /api/charts/[id]` - Get user's chart
- `POST /api/charts/[id]` - Save user's chart

### Astrology
- `POST /api/astrology/natal-chart` - Calculate natal chart
- `POST /api/astrology/three-keys` - Get three keys
- `POST /api/astrology/synastry` - Calculate synastry
- `POST /api/astrology/daily-horoscope` - Get daily horoscope
- `POST /api/astrology/weekly-horoscope` - Get weekly horoscope
- `POST /api/astrology/monthly-horoscope` - Get monthly horoscope
- `POST /api/astrology/deep-dive` - Deep dive analysis
- `POST /api/astrology/chat` - Chat with AI

## Features

- **User Profiles**: Store user birth data and preferences
- **Natal Charts**: Calculate and display natal charts
- **Three Keys**: Personalized astrology insights
- **Synastry**: Compatibility analysis
- **Horoscopes**: Daily, weekly, and monthly horoscopes
- **Premium Subscriptions**: Telegram Stars integration
- **Admin Panel**: User management

## Logging

All API routes and services include comprehensive logging:
- Request/response logging
- Error tracking
- Performance metrics
- Database operation logs

Check server console and browser console for detailed logs.

## Migration Notes

### What Changed

1. **Build System**: Vite → Next.js
2. **API Calls**: Direct external API → Next.js API Routes
3. **Data Storage**: localStorage fallback → Database only
4. **Styling**: Tailwind via CDN → Tailwind via PostCSS

### Breaking Changes

- All API calls now go through `/api/*` routes
- No more localStorage fallback (data must be saved to database)
- Environment variables use Next.js conventions

### Next Steps

1. Install database driver (pg for PostgreSQL or mysql2 for MySQL)
2. Update `lib/db.ts` with actual database connection
3. Implement real Swiss Ephemeris integration
4. Add OpenAI API integration for chat features
5. Set up Railway deployment

## License

Private project
