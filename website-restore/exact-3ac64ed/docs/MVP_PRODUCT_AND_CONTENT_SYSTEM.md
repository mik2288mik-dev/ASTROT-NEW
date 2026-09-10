# NEBO product and content system

This reference defines the current product boundaries.

## 1. MVP products

- Personal Today, Week, and Month forecasts.
- Zodiac Today, Week, and Month forecasts.
- Natal chart and permanent natal reading.
- Questions about the user's saved natal chart.
- Sign compatibility and two-chart compatibility.
- Matrix of Destiny and astrology encyclopedia.
- Account, Premium, support, notifications, and deletion.

## 2. Personal forecast feed — active product

`views/Dashboard.tsx` owns the personal forecast. Today renders 4-6 ordered
fragments without visible categories or fragment headings. Week and Month each
render one cohesive story.

The model returns `title`, `punchline`, `forecast`, and `closing`. The UI does
not add Love/Work/Mood categories, polls, feedback, chat, hourly structure, or
calendar stages.

## 3. Navigation

The persistent bottom bar is `Сегодня`, `Зодиак`, `Натальная карта`,
`Сравнить`, `Меню`.

Inside `Натальная карта`, keep `Карта`, `Разбор`, `Спросить о себе`,
`Матрица судьбы` in that order.

## 4. Free and Premium

Free access includes a usable product without mandatory registration. Premium
unlocks the full personal forecast, Week and Month, deeper natal content,
questions, and two-chart compatibility according to the current server access
rules.

RuStore supplies subscription prices and periods. The server validates purchase
ownership before granting Premium.

## 5. Questions

`Спросить о себе` belongs to the natal flow. It accepts only questions that can
be answered from the saved chart. Premium users receive up to five accepted
questions per day. Rejected off-topic questions do not consume the limit.

## 6. Data, calculation, and caching

Swiss Ephemeris calculates the natal chart. Personal forecast generation uses
raw birth fields to create a hidden period brief, then gives that brief to the
writer. It does not pass calculated natal placements or invent period transits.

Cache identity changes with the user, profile, period, language, model,
contract, prompt, and voice versions. Startup prewarm is non-blocking.

## 7. Voice and content rules

Use direct, concrete Russian without mystical guarantees, generic coaching,
diagnoses, invented biography, or professional medical, legal, psychological,
or financial claims. `lib/appVoice.ts` is the runtime source of truth.

## 8. Visual rules

Forecast prose remains readable and outside imagery. Today keeps the current
old-TV clock and still broadcasts. Do not add promotional banners, chat, games,
feedback controls, or decorative navigation.

## 9. Account and platform

Android is the primary platform. Email, VK ID, and Yandex identities attach to
one internal user. Account deletion and subscription cancellation remain
separate actions.

## 10. Architecture sources

- `App.tsx`
- `views/Dashboard.tsx`
- `views/v2/NatalMagazine.tsx`
- `lib/personalForecastGeneration.ts`
- `lib/personalForecastContract.ts`
- `lib/personalForecastCache.ts`
- `lib/appVoice.ts`
- `lib/rustorePayments.ts`
