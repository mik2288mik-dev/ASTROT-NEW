# Current architecture

## Runtime

- `App.tsx` restores the authenticated profile and a saved natal chart without making generation a startup gate.
- `Dashboard` is the only personal-reading surface. Today, Week, and Month are internal periods selected from the diary drawer, not tabs on the main screen.
- The client is local-first: it keeps a usable cached reading visible while a server refresh runs in the background.

## Personal forecasts

- `lib/swisseph-calculator.ts` remains the deterministic source for the saved natal chart. It is not called to calculate forecast-period transits or evidence.
- `lib/personalForecastGeneration.ts` builds one private prompt input from the selected date/range, available birth details, saved natal positions/aspects, and bounded anti-repeat history, then asks OpenAI Luna to author the reading. It does not inject a preselected generic psychological topic.
- Luna uses the Responses API with strict JSON Schema through `lib/openaiResponses.ts`.
- For Today the model writes one shared headline plus 4–6 ordered fragments. The server materializes the first fragment as `overview` and the remaining fragments as untitled `sections`. Week and Month require one cohesive fragment and no additional sections.
- The structured writer also returns hidden post-hoc keys for the used main idea, life plot, advice, and comparison. They are never rendered. Server validation combines compact exact/token signatures from these keys with headline checks, normalized openings, and text similarity to reject repeats.
- Every Today fragment also returns strict hidden `presentation_style`. The server maps it to optional `ForecastSection.presentationStyle`; a current-contract package may omit the optional field and render as prose, while older prompt/voice cache identities remain invalid. The first fragment and at least one more fragment are prose; Today allows at most one pull quote and at most one short paper note. The Week/Month strict schema omits presentation metadata.
- The model is the author of the personal forecast, not a renderer of precomputed themes or a calculator of period events. The server validates format, length, language, forecast voice, safety, unsupported claims, repetition, and visible astrology before persisting the result. Writer attempts remain capped at two.
- `lib/personalForecastCache.ts` caches one materialized package by user, chart, period, language, prompt, voice, and model identity. Before a miss is generated, it reads bounded same-period history with `allowExpired` plus one safe latest excerpt, including the previous headline; this history is negative prompt context only and is never served as the requested forecast. Compatible stale output must have the current prompt identity.
- `lib/appVoice.ts` contains the shared runtime voice and a separately versioned personal-forecast layer. Forecast-specific character and occasional irony do not make the global app voice comedic.

## Product separation

- `Зодиак` remains a separate sign-based product and keeps its DeepSeek compatibility route.
- Swiss Ephemeris remains required for natal-chart calculation and its permanent interpretations.
- “Вопрос астрологу” belongs to the natal reading and opens from that product; it is not a block inside the personal forecast.

## Visual and navigation boundaries

- The left drawer owns primary navigation. Forecast periods are internal to the diary.
- `lib/personalForecastVisuals/diaryVisualEngine.ts` derives a Today plan from `userId + periodKey + contractVersion`. It rotates five app-owned layouts and one weighted asset family without random state, client history, or database state; adjacent dates cannot repeat a layout or exact asset. Side-column layouts select compact portrait/square, non-wide compositions; the more open layouts may use landscape assets.
- The personal source contains 309 assets under `/assets/personal-editorial/`: 202 `editorial-v2` assets, 45 cats, 38 capybaras, and 24 objects. Its separate paper source contains 19 empty templates under `/assets/personal-paper-templates/`, with safe live-text areas. Embedded-text and review-excluded assets remain in the library but never enter automatic selection.
- `lib/personalForecastVisuals/personal.manifest.json`, `paper-templates.manifest.json`, and `editorialSelectors.ts` are the personal source of truth. They do not import the legacy Zodiac pool. Zodiac uses its own typed allowlist, `zodiac-legacy-special.manifest.json`, and `lib/zodiacLegacyVisuals/index.ts`; that pool contains only 24 psychedelic and 24 approved funny-animal assets under `/assets/zodiac-legacy-special/`.
- Text is the primary forecast presentation. Today uses at most one strong visual and `editorial_clean` uses none. Luna supplies runtime prose/quote/note text but never chooses an asset or design instruction.
- Body prose is never rendered over an image or inside a card/promo banner. A `paper_note` is the explicit exception: deterministic template selection plus live text within the template's safe area, never rasterised copy.

## Android accounts

- Android is the primary product platform. Email registration/password login, email-code confirmation and reset, Google Credential Manager, Yandex LoginSDK 3.1.3, and VK ID SDK 2.7.2 are implemented in the native shell with server-side credential verification.
- Auth capabilities are runtime-aware: Android uses native provider readiness, browser OAuth also requires its server secrets and HTTPS origin, and password login remains independently available when email-code delivery is not configured.
- `account_identities` maps verified email, Google, Yandex, VK, and Telegram identities to one canonical `users.id`. An email match alone never merges users, and an identity already owned by another user cannot be captured. Natal chart, forecast history, Premium, and saved data remain attached to the canonical user.
- Native sessions are restored from Android Keystore-backed storage and are revocable server-side. Login/link flows guard cancel, Back, repeated taps, cold start, and concurrent callbacks.
- Migration `mvp_043_password_authentication` adds password credentials and email-code state. Provider console credentials, email delivery, Railway secrets, production migration execution, release signing fingerprints, and live device verification remain manual deployment work.

## Persistence boundary

- Existing migrations and stored data are append-only history; do not delete database tables as a code-cleanup step.
- Legacy forecast-question server routes remain isolated until their shared natal-question utilities are explicitly migrated. They are not part of the rendered forecast UI.
