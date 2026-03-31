# Legacy daily forecast — инвентаризация вызовов

Мост: [`pages/api/astrology/daily-horoscope.ts`](../pages/api/astrology/daily-horoscope.ts) (заголовки `X-Lumia-Legacy-Endpoint`, `Warning`). Основной контракт: [`pages/api/content/forecast/daily.ts`](../pages/api/content/forecast/daily.ts).

## Клиентский слой

| Место | Что вызывается |
|-------|----------------|
| [services/astrologyService.ts](../services/astrologyService.ts) | `legacyGetDailyHoroscopeViaAstrologyEndpoint`, `legacyGetCachedDailyHoroscopeViaAstrologyEndpoint` из `getDailyHoroscope` / `getCachedDailyHoroscope`, если включён fallback ([lib/forecastLegacyConfig.ts](../lib/forecastLegacyConfig.ts)). |
| [views/Horoscope.tsx](../views/Horoscope.tsx) | `getCachedDailyForecastLayer` → при неудаче `getCachedDailyHoroscope` → `getDailyForecastLayer` → при неудаче `getDailyHoroscope`. |
| [services/contentGenerationService.ts](../services/contentGenerationService.ts) | `getDailyHoroscope`, `getCachedDailyHoroscope` (например предзагрузка / обновление `generatedContent`). |

## Сервер / инфра

| Место | Назначение |
|-------|------------|
| [lib/serverLocks.ts](../lib/serverLocks.ts) | Ключ блокировки `daily-horoscope:*` для legacy генерации. |
| [lib/cache.ts](../lib/cache.ts) | Тег кэша `daily-horoscope` (legacy путь). |

## Отключение моста на клиенте

В `.env` / окружении сборки:

```bash
NEXT_PUBLIC_FORECAST_LEGACY_FALLBACK=0
```

После проверки в проде можно оставить `0` по умолчанию в шаблоне `.env.example` (отдельный PR).

## Следующие шаги cleanup

- Убрать дублирующий вызов `getDailyHoroscope` в `Horoscope.tsx`, когда v2 стабилен (один контракт).
- Удалить legacy API только при подтверждении отсутствия внешних клиентов и миграции `daily_natal_cards` при необходимости.
