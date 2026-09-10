# Current NEBO architecture

This reference describes active NEBO paths.

## Runtime and navigation

- `App.tsx` restores the app session, profile, saved charts, and current screen.
- `LumiaBottomTabBar` renders the production navigation in this order:
  `Сегодня`, `Зодиак`, `Натальная карта`, `Сравнить`, `Меню`.
- Today, Week, and Month are period tabs inside the personal forecast.
- `Меню` opens the full menu screen.
- The active natal flow is `App.tsx` to `views/v2/NatalMagazine.tsx` and its
  `Карта`, `Разбор`, `Спросить о себе`, and `Матрица судьбы` tabs.

## Personal forecast generation

The active generation chain is:

```text
raw birth profile + selected period
-> hidden astrologer brief
-> personal forecast writer
-> strict validation and anti-repeat
-> PersonalForecastPackage
-> current UI
```

The brief receives raw birth fields and the exact period. The writer receives
the accepted brief, reader name and language, period, and bounded history. It
does not receive the calculated natal chart, Swiss Ephemeris output, positions,
houses, aspects, transits, or text from another user.

The strict writer output contains `title`, `punchline`, `forecast`, and
`closing`. The server materializes the result as `PersonalForecastPackage` end to end.
Today renders the forecast body as 4-6 ordered fragments; Week and
Month remain one cohesive story each.

## Cache and delivery

- `lib/personalForecastCache.ts` owns the server cache.
- The cache does not use a `saved-natal fingerprint`; it uses
  `birthProfileFingerprint`, the hash of sanitized profile fields, with the
  user ID, access tier, period, timezone-aware period key, language, model, and
  calculation, contract, prompt, voice, and cache versions.
- The old phrase `15 recent fragments for the same user and chart` is
  inaccurate: history is bounded to the same user and access tier, with no
  chart-ID filter.
- The client checks the server cache with `GET`, then starts generation with `POST`.
- A `202` response is polled with `POST` and `regenerate: false`.
- The client keeps compatible local content visible while refreshing.

## Product engines

- Swiss Ephemeris calculates and stores natal charts. It does not calculate
  period transits for the personal forecast.
- Zodiac uses the separate sign-based generation and cache path.
- Natal questions accept only questions answerable from the saved natal chart.
- Compatibility keeps sign compatibility separate from two-chart synastry.
- RuStore Pay grants Premium only after server validation of an allowed product.

## Android and backend

- Capacitor owns the Android shell.
- Package ID is `ru.tvoygoroskop.app`.
- The RuStore flavor includes RuStore Pay; other flavors do not.
- Email, VK ID, Yandex ID, Google, and Telegram identities can map to one
  canonical `users.id`; enabled sign-in buttons depend on the build channel.
- Railway currently runs the API, PostgreSQL, scheduled jobs, and public site.
- `/api/health` reports process health. `/api/readiness` checks PostgreSQL and
  Swiss Ephemeris.

## Data boundaries

- Server routes authenticate the current app user and verify chart ownership.
- Secrets stay server-side and never use `NEXT_PUBLIC_*`.
- Account deletion revokes sessions and removes account-owned product data.
- Applied migrations remain append-only history.
