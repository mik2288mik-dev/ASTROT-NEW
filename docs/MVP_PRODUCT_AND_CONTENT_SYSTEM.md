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
- Every period opens with one visible common hook of 2–5 words. Today continues it as a continuous feed of 4–6 sequential untitled fragments, no more than 150 visible words in total. The first fragment is `overview`; the following fragments are ordered `sections`. The final fragment closes with practical value without a visible advice rubric. Love/Work/Mood and other categories are never visible.
- Week and Month each receive one cohesive personal story for their exact range. They are not multi-card feeds and have no Monday-to-Sunday, week-part, or month-part breakdown.
- None of the three periods uses a fixed set of life themes, preselected behavioural patterns, separate advice blocks, or generic newspaper-horoscope categories. Internal post-hoc service keys are allowed only for diversity validation and are never rendered.
- Swiss Ephemeris calculates the saved natal chart. That chart supplies private context for the model; it does not produce a separate transit/evidence payload for the forecast period.
- OpenAI Luna receives the selected period plus available birth details, saved natal context, and up to 15 recent fragments for the same user and chart across `day`, `week`, and `month` via the Responses API. It writes the forecast itself; recent excerpts are negative anti-repeat context, not factual biography or fallback copy.
- Strict JSON Schema and server validation control the fragment count, required typed closing, 150-word limit, language, forecast-specific voice, safety, unsupported claims, and repetition. The request uses `store: false`; rejected draft text remains inside server validation and is not sent back to Luna. The writer has at most two attempts.
- Each Today fragment carries hidden `presentationStyle`: the first and final fragments are `prose`, with at most one 6–18-word `pull_quote` and one 4–12-word `paper_note`. The schema validates these values, but the current Today renderer does not branch on them and displays every fragment as continuous prose. Week and Month omit the metadata.
- `lib/appVoice.ts` is the runtime voice source. Its v3 personal-forecast layer may be sharper and occasionally ironic without changing the global app voice. Ten period-local runtime examples guide form — four Today and three each for Week and Month — while anti-copy validation prevents template reuse.

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
- Body prose remains primary and never sits on an image or in an additional card. Fragment titles and presentation metadata stay hidden in the active Today UI.

## Android accounts

- Email uses password registration/login, one-time email codes for confirmation and reset, scrypt password hashing, HMAC-protected codes, rate limits, and brute-force protection. The former passwordless email-code login is disabled.
- Google uses Android Credential Manager, Yandex uses LoginSDK 3.1.3, and VK uses VK ID SDK 2.7.2 with OAuth 2.1, PKCE, and state. The server verifies every provider credential.
- One internal `users.id` may own several verified identities. Matching email does not merge accounts, and a provider identity cannot move from another user. The canonical account owns the natal chart, forecast history, Premium state, and saved data.
- Migration `mvp_043_password_authentication` is part of the schema sequence. Live provider credentials, email delivery, Railway secrets, production migration execution, release signing, and device tests are deployment responsibilities.
