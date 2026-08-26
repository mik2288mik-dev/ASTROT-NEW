# MVP product and content system

## Products

- Android is the primary platform; the Telegram Mini App remains a supported distribution channel.
- Personal diary: Today, Week, and Month are periods of one personal AI-reading screen, selected by one controlled switcher inside the Diary.
- Zodiac: a separate sign-based horoscope product.
- Natal chart and permanent natal reading.
- Compatibility by sign and a Premium chart-based relationship reading.
- Settings, onboarding, Premium access, support, notifications, administration, and mobile-shell functionality.

## Personal forecast

- The reader lives in `views/Dashboard.tsx`; one Today/Week/Month tablist sits directly below its header. There is no separate forecast page, question block, feedback prompt, “hit/miss” control, chat, game, or time-of-day forecast.
- Every period uses the same visible order: a generated title, a separate sharp punchline, the forecast body, and a separate conclusion/advice. Today materializes as a continuous feed of 4–6 sequential text fragments: `overview` stores the first/main fragment and ordered `sections` store the rest. Love/Work/Mood and other fixed categories are never visible.
- Week and Month each receive one cohesive personal story for their exact range followed by separate concrete advice. Week is longer than Today, and Month is longer than Week. They are not multi-card feeds and have no Monday-to-Sunday, week-part, or month-part breakdown.
- None of the three periods uses fixed life themes, preselected behavioural patterns, generic newspaper-horoscope categories, or visible astrological terminology. The saved natal context personalizes the story without becoming a technical explanation in the UI.
- Swiss Ephemeris calculates the saved natal chart. That chart supplies private context for the model; it does not produce a separate transit/evidence payload for the forecast period.
- OpenAI Luna receives the selected period plus available birth details, saved natal context, and up to 15 recent fragments for the same user and chart across `day`, `week`, and `month` via the Responses API. It writes the forecast itself; recent excerpts are negative anti-repeat context, not factual biography or fallback copy.
- Strict JSON Schema requires exactly `title`, `punchline`, `forecast`, and `closing`. Server validation controls period-specific length, sentence and fragment counts, language, forecast-specific voice, unsupported claims, visible astrology, and repetition. The request uses `store: false`; rejected draft text remains inside server validation and is not sent back to Luna. The writer has at most two attempts.
- `lib/appVoice.ts` owns the runtime voice identity. The only personal-forecast reference corpus is `lib/personalForecastExamples.ts`: 21 Today, 15 Week, and 20 Month examples. The developer instruction receives every reference for the selected period, while anti-copy validation prevents template reuse.

## Access and cache

- `/api/content/forecast/personal` owns cache lookup and generation under locks.
- The client renders a usable local package first and refreshes it in the background.
- The server slices the package for access tier; client locks are presentation only.
- Cache identity includes the authenticated user, owned chart ID, full saved-natal fingerprint, hash of sanitized profile fields, period and timezone-aware key, language, model, and calculation, contract, prompt, and voice versions.
- Existing Premium slicing and local-first behavior remain unchanged; history lookup does not bypass access control or replace the current-period cache entry.
- The client checks the server cache with `GET`, starts generation with `POST`, and after a `202` polls with the same `POST` and `regenerate: false`.
- Startup prewarm is non-blocking. Free prewarms only the current `day`; Premium sequentially prewarms the current `day`, `week`, and `month`.

## Product boundaries

- Zodiac remains on its separate DeepSeek route.
- Swiss Ephemeris remains required for natal calculation and permanent natal interpretation.
- “Question for the astrologer” belongs to the natal-reading flow. Old forecast-question server routes are legacy surfaces and must not be restored in the diary UI without a dedicated migration.
- Applied database migrations and data are not removed as a code-cleanup step.

## Visual rules

- One shared `LumiaBottomTabBar` owns primary navigation on the main screens; the old drawer is not mounted. Personal and sign horoscopes are on the left, the product hub is in the centre, Settings/Store/Premium are on the right, and the top profile action opens personal data and saved charts. Forecast periods remain internal to the Diary tablist.
- Active Today uses one deterministic `calendar-editorial` composition. `TodayLineField` selects one of 12 line presets and `TodayCalendarClock` selects one of 15 clock presets from `userId + periodKey`; the continuous fragments follow as ordinary prose.
- The former five-layout planner, 309 assets under `/assets/personal-editorial/`, and 19 paper templates under `/assets/personal-paper-templates/` remain library-only and inactive. The current Today path does not mount its image or paper renderers.
- Zodiac is the only product that can use retained legacy newspaper imagery. Its separate source contains 48 explicitly allowlisted assets under `/assets/zodiac-legacy-special/`: 24 psychedelic images and 24 approved funny-animal images. The personal manifests and selectors never import this pool, and the Zodiac selector cannot see any other retired newspaper asset.
- Clock and line selection is deterministic for the user and date, and no visual state is stored in the database. Luna never chooses either preset, an asset, coordinates, colour, or composition.
- Body prose remains primary and never sits on an image or in an additional card. The generated title, separate punchline, forecast body, and conclusion/advice remain distinct in the active UI.

## Android accounts

- Email uses password registration/login, one-time email codes for confirmation and reset, scrypt password hashing, HMAC-protected codes, rate limits, and brute-force protection. The former passwordless email-code login is disabled.
- Google uses Android Credential Manager, Yandex uses LoginSDK 3.1.3, and VK uses VK ID SDK 2.7.2 with OAuth 2.1, PKCE, and state. The server verifies every provider credential.
- One internal `users.id` may own several verified identities. Matching email does not merge accounts, and a provider identity cannot move from another user. The canonical account owns the natal chart, forecast history, Premium state, and saved data.
- Migration `mvp_043_password_authentication` is part of the schema sequence. Live provider credentials, email delivery, Railway secrets, production migration execution, release signing, and device tests are deployment responsibilities.
