# MEOU — Google Play ASO Market Decisions

Research date: 2026-08-26  
Decision status: capture complete with pending `Calc` rows; metadata not published; Premium copy blocked by missing Google Play Billing  
Raw data: [ASO_ASODESK_MARKET_MATRIX_2026-08-26.csv](./ASO_ASODESK_MARKET_MATRIX_2026-08-26.csv)  
Extended EN core: [ASO_EN_KEYWORDS_2026-08-26.csv](./ASO_EN_KEYWORDS_2026-08-26.csv)

## 1. What was measured

- 135 country-keyword rows in ASOdesk Find & Track.
- Seven Google Play countries: Russia, Kazakhstan, Belarus, United States, United Kingdom, Canada, Australia.
- 30 Russian and 30 English queries in the baseline markets; 15 Tier S queries in each secondary market.
- The tracked benchmark is `com.matricasudbu.app.astro`, because MEOU (`ru.tvoygoroskop.app`) has no confirmed live Google Play rank in this research.
- The benchmark rank must never be reported as MEOU's rank.
- RuStore is a separate evidence stream: 150 live-result rows for 15 queries are stored in [ASO_BATTLE_MAP_2026-08-26.csv](./ASO_BATTLE_MAP_2026-08-26.csv).

ASOdesk defines Daily Impressions as an approximate daily keyword-view estimate and Difficulty as its promotion-difficulty index. `Calc` means the platform had not finished calculating the value at capture time. A displayed `0` is the estimator's current value, not proof that real demand is literally zero. The `Total apps` values visible in this capture are normally 20–30 results and must not be treated as the full number of indexed competitors.

## 2. Head-query market comparison

| Market | `astrology` / `астрология` | Difficulty | `horoscope` / `гороскоп` | Difficulty | `natal chart` / `натальная карта` | Difficulty |
|---|---:|---:|---:|---:|---:|---:|
| Russia | 0 | 57 | 2,171 | 66 | 221 | 57 |
| Kazakhstan | 0 | 50 | 9 | 53 | 3 | 22 |
| Belarus | 0 | 0 | 70 | 49 | 0 | 32 |
| United States | 1,894 | 70 | 1,446 | 72 | 0 | 58 |
| United Kingdom | 261 | 72 | 167 | 68 | 0 | 59 |
| Canada | 188 | 85 | 38 | 77 | 0 | 64 |
| Australia | 95 | 63 | 56 | 58 | 0 | 44 |

All figures are ASOdesk estimates for the named country, captured on one date. Do not average them across countries.

Important anomaly: Belarus showed `гороскоп на месяц` at 711 Daily Impressions and Difficulty 46. This is a strong validation candidate, but one country/date estimate is not enough to replace MEOU's primary positioning.

## 3. Decisions from the data

### Russian listing

Keep `натальная карта` as the primary acquisition cluster.

Why:

- It is the closest match to MEOU's durable product value.
- Russia has measurable demand at 221 and lower difficulty than the head query `гороскоп`.
- The benchmark ranks 13 for `натальная карта`, while lower-volume long tails already show reachable benchmark positions: 3 for `расшифровка натальной карты`, 4 for `рассчитать натальную карту`, 5 for `совместимость натальных карт` and 6 for `натальная карта с расшифровкой`.
- `гороскоп` has much more estimated demand (2,171) but also higher difficulty (66) and a broader user expectation. It belongs in the short/full description and screenshot narrative, not as MEOU's only identity.

Recommended launch metadata:

- Name, 21/30: `MEOU: натальная карта`
- Short description, 65/80: `Натальная карта, личный гороскоп и совместимость по дате рождения`
- Full description: the balanced chosen variant in [ASO_COPY_BANK_2026-08-26.md](./ASO_COPY_BANK_2026-08-26.md).

Country handling:

- Russia is the Russian baseline.
- Kazakhstan and Belarus should be read as separate cohorts, not copies of Russia.
- Do not rewrite the title for Kazakhstan from a 9-impression `гороскоп` estimate.
- In Belarus, test screenshot/short-copy emphasis on Today–Week–Month only after stable listing traffic confirms the `гороскоп на месяц` signal.

### English listing

Lead with the lower-difficulty, product-specific chart intent and use `horoscope` as the secondary promise.

Recommended launch name:

- Name, 29/30: `MEOU: Birth Chart & Horoscope`
- Controlled title challenger, 29/30: `MEOU: Natal Chart & Horoscope`
- Short description, 64/80: `Birth chart, personal daily horoscope, and zodiac compatibility.`

The title/short description are metadata recommendations, not publication approval. The current Google Play flavor does not provide Google Play Billing: its paywall loads the RuStore catalog, while Google Play purchase/restore is outside the current flavor. Therefore any Google Play text or screenshot promising purchasable Premium is blocked until Play Billing, server validation, entitlement and restore are implemented and verified end to end.

Why:

- US `astrology` and `horoscope` have the largest measured demand but high Difficulty 70–72.
- `birth chart` is easier than `natal chart` in the US snapshot (48 vs 58).
- Product-specific opportunities are materially easier: US `zodiac compatibility` Difficulty 30, `AI astrologer` 47, `natal chart compatibility` 48, and `weekly horoscope` 51.
- Canada is the hardest head market in the sample (`astrology` 85, `horoscope` 77); do not use Canada as the first organic rank benchmark.
- Australia is the easiest English head market in this sample (`horoscope` 58; `natal chart` 44), making it a useful secondary launch cohort after US baseline instrumentation.

## 4. English full descriptions

### Current-flavor safe draft

This version excludes every Premium promise. Use it only if the product owner deliberately releases the current free Google Play capability before Play Billing; a product QA/release decision is still required.

```text
MEOU brings your birth chart, personal Today reading, zodiac horoscopes, and sign compatibility together in one clear app.

BIRTH CHART

Enter your birth date, time, and place to create a natal chart based on your saved details. Start with the essential reading and return to your chart whenever you need it.

PERSONAL TODAY READING

Open Today for the beginning of a personal reading written from your saved birth context. It is presented as one connected story, not a set of generic category cards.

ZODIAC HOROSCOPE

Read the daily horoscope for any zodiac sign and switch signs without rebuilding your own chart.

SIGN COMPATIBILITY

Check compatibility between two zodiac signs and see where the connection feels easy or needs more attention.

You can begin without creating an account. MEOU does not promise guaranteed events, live consultations, tarot, numerology, or features that are not shown in the app.
```

### Post-Play-Billing draft — BLOCKED

The following 1,571-character version may be used only after Google Play Billing purchase, restore, entitlement persistence, server validation and device flows have passed release verification.

```text
MEOU brings your birth chart, personal forecasts, and compatibility readings together in one clear app.

BIRTH CHART

Enter your birth date, time, and place to create a natal chart based on your saved details. Start with the essential reading, then unlock a deeper personal report with Premium.

PERSONAL FORECASTS

Open Today for a personal reading written as one connected story. The free version includes the opening fragments; Premium unlocks the complete Today reading and full Week and Month forecasts.

ZODIAC HOROSCOPE

Read the daily horoscope for any zodiac sign. The sign horoscope is available without Premium.

COMPATIBILITY

Check zodiac-sign compatibility for free. Premium can compare two saved birth charts for a deeper relationship reading.

ASK ABOUT YOUR CHART

Premium lets you ask questions about a saved chart and receive an AI-generated answer based on that chart. This is not a live human astrologer or a chat service.

SAVE THE PEOPLE WHO MATTER

Keep your own chart and, with Premium, save up to five additional people so you can return to their charts and compatibility readings.

FREE AND PREMIUM

You can begin without creating an account. Core chart access, the opening of Today, sign horoscopes, and sign compatibility are available free. Deeper natal reports, complete personal forecasts, two-chart compatibility, chart questions, and additional saved people require Premium.

MEOU uses your saved birth details to personalize readings. It does not promise guaranteed events, live consultations, or features that are not shown in the app.
```

## 5. Screenshot message hierarchy

Do not translate screenshots word for word. Preserve the same product truth while localizing the user promise.

| Order | RU message | EN message | Purpose |
|---:|---|---|---|
| 1 | `Твоя натальная карта — без общих фраз` | `Your birth chart, made personal` | Primary conversion promise |
| 2 | `Разбор карты по твоим данным рождения` | `A reading based on your birth details` | Explain input and personalization |
| 3 | `Личный прогноз на сегодня` | `Your personal daily horoscope` | Retention value |
| 4 | `Гороскоп для каждого знака` | `Daily horoscope for every sign` | Free zodiac value |
| 5 | `Совместимость знаков` | `Zodiac-sign compatibility` | Free second acquisition cluster |

Blocked until verified Google Play Billing:

| Order | RU message | EN message | Gate |
|---:|---|---|---|
| 6 | `Неделя и месяц — одна цельная история` | `Week and Month, written as one story` | Premium periods |
| 7 | `Совместимость двух карт` | `Compare two birth charts` | Premium two-chart entitlement |
| 8 | `Спроси о сохранённой карте` | `Ask about a saved chart` | Premium chart questions |
| 9 | `Сохрани карты близких` | `Keep the charts that matter` | Premium additional people |

No screenshot may imply tarot, numerology, Matrix of Destiny, a live astrologer, guaranteed events, social features, or unlimited free Premium readings.

## 6. Google Play rollout structure

Official current Play Console limits used here:

- App name: 30 characters.
- Short description: 80 characters.
- Full description: 4,000 characters.

Sources: [Create and set up your app](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en), [Store listing best practices](https://support.google.com/googleplay/android-developer/answer/13393723?hl=en).

Recommended structure:

1. Maintain complete manual translations for `ru-RU` and `en-US`; do not rely on automatic translation.
2. Measure country cohorts separately in Play Console even when they share a language listing.
3. Do not create four English custom listings on day one. Create a country-specific custom listing only after conversion data proves a material country-level message difference.
4. If needed later, use one North America variant (US/Canada) and one UK/Australia hypothesis, ensuring no country is targeted by two custom listings.

Google supports country-targeted custom store listings and up to 50 custom pages; their text and graphics can differ by audience. Source: [Custom store listings](https://support.google.com/googleplay/android-developer/answer/9867158?hl=en).

## 7. Experiment order

Google Play has native store listing experiments. A published app can test default graphics or localized text/graphics; up to two variants may be compared, and Google recommends changing one asset type at a time. Source: [Run A/B tests on your store listing](https://support.google.com/googleplay/android-developer/answer/12053285?hl=en).

Run in this order:

1. Baseline for at least 14 days or until traffic is sufficient.
2. Localized short description only: `Birth chart...` vs `Natal chart...`; keep every graphic unchanged.
3. Screenshot 1 only: chart-first promise A vs personal-forecast promise B.
4. Title `Birth Chart` vs `Natal Chart` only as sequential metadata iterations with separate stable baselines. Native Store Listing Experiments do not test app name.
5. Apply a native experiment result only when Play Console reports a conclusive outcome; do not call a directional fluctuation a win.

## 8. Rank targets

`Top 1` is a goal, not a guarantee. Use phased targets:

- RU first wave: TOP-10, then TOP-3, then TOP-1 for `расшифровка натальной карты`, `рассчитать натальную карту`, `натальная карта с расшифровкой`, `совместимость натальных карт`.
- RU head wave: `натальная карта` TOP-10 before fighting `гороскоп`.
- EN first wave: TOP-10 for `birth chart calculator`, `zodiac compatibility`, `natal chart compatibility`, `AI astrologer`, then TOP-3/TOP-1 where conversion holds.
- EN head wave: use `astrology` and `horoscope` for visibility and copy coverage, but do not make launch success depend on immediate TOP-1 for Difficulty 70+ queries.

## 9. Publication gates

- Owner approval for both proposed public names.
- Android label, Play Console name, screenshots, and in-app brand must remain synchronized.
- P0 before any Premium listing: implement and verify Google Play Billing purchase, server validation, entitlement persistence and restore. Until then use only the current-flavor safe copy/assets or do not publish the Google listing.
- End-to-end English localization QA is required before an English listing is published, including onboarding, natal report, personal forecasts, compatibility, paywall, purchase/restore, errors, privacy, and support text.
- Store text does not prove live Google Play distribution, signed bundle, Console products, billing, review approval, indexation, or device behavior.
- Re-export ASOdesk after every major metadata version; keep country and date in every row.

## 10. Decision lock

- RU primary cluster: `натальная карта`.
- RU head expansion: `гороскоп`, but not at the cost of product fit.
- EN primary phrase for the first controlled launch: `Birth Chart`.
- EN secondary phrase: `Horoscope`.
- Compatibility is the first lower-difficulty expansion cluster in both languages.
- Premium Google Play copy/assets remain blocked until Play Billing is real and release-verified.
- App-name testing is sequential; Google native Store Listing Experiments are for descriptions/graphics, not title.
- ASOdesk `0` and `Calc` values are never silently converted into demand facts.
- No metadata has been published and no app code has been changed by this research.
