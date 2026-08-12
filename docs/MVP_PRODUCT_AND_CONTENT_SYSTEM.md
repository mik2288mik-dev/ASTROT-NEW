# MVP product and content system

## Products

- Android is the primary platform; the Telegram Mini App remains a supported distribution channel.
- Personal diary: Today, Week, and Month are periods of one personal AI-reading screen, selected from its drawer.
- Zodiac: a separate sign-based horoscope product.
- Natal chart and permanent natal reading.
- Compatibility by sign and a Premium chart-based relationship reading.
- Settings, onboarding, Premium access, support, notifications, administration, and mobile-shell functionality.

## Personal forecast

- The reader lives in `views/Dashboard.tsx`; there is no separate forecast page, period switcher on the main screen, question block, feedback prompt, “hit/miss” control, chat, game, or time-of-day forecast.
- Today is a continuous personal feed: one 3–8-word shared headline and 4–6 sequential untitled text fragments, no more than 150 visible words in total. The first fragment is `overview`; the following fragments are ordered `sections`. Love/Work/Mood and other categories are never visible.
- Week and Month each receive one cohesive personal story for their exact range. They are not multi-card feeds and have no Monday-to-Sunday, week-part, or month-part breakdown.
- None of the three periods uses a fixed set of life themes, preselected behavioural patterns, separate advice blocks, or generic newspaper-horoscope categories. Internal post-hoc service keys are allowed only for diversity validation and are never rendered.
- Swiss Ephemeris calculates the saved natal chart. That chart supplies private context for the model; it does not produce a separate transit/evidence payload for the forecast period.
- OpenAI Luna receives the selected period plus available birth details, saved natal context, and bounded recent forecast excerpts via the Responses API, and writes the forecast itself. Recent excerpts are negative anti-repeat context, not factual biography and not fallback copy.
- Strict JSON Schema and server validation control the fragment count, 150-word limit, language, forecast-specific voice, safety, unsupported claims, and repetition. The writer has at most two attempts.
- Each Today fragment carries hidden `presentationStyle`: the first fragment and at least one more are `prose`, with at most one 6–18-word `pull_quote` and at most one 4–12-word `paper_note`. Week and Month stay ordinary prose. A paper note is runtime text over an empty application-owned template, never text baked into an image.
- `lib/appVoice.ts` is the runtime voice source. Its personal-forecast layer may be sharper and occasionally ironic without changing the global app voice.

## Access and cache

- `/api/content/forecast/personal` owns cache lookup and generation under locks.
- The client renders a usable local package first and refreshes it in the background.
- The server slices the package for access tier; client locks are presentation only.
- Cache identity includes user, chart, period, language, model, prompt version, and voice version.
- Existing Premium slicing and local-first behavior remain unchanged; history lookup does not bypass access control or replace the current-period cache entry.

## Product boundaries

- Zodiac remains on its separate DeepSeek route.
- Swiss Ephemeris remains required for natal calculation and permanent natal interpretation.
- “Question for the astrologer” belongs to the natal-reading flow. Old forecast-question server routes are legacy surfaces and must not be restored in the diary UI without a dedicated migration.
- Applied database migrations and data are not removed as a code-cleanup step.

## Visual rules

- Primary navigation lives in the left drawer. Forecast periods are internal to the diary.
- Today uses one app-owned editorial system with five deterministic compositions: `editorial_right`, `editorial_left`, `quote_first`, `visual_overlap`, and image-free `editorial_clean`. Luna does not choose layouts, assets, colours, coordinates, or composition.
- Side-column compositions use compact portrait/square, non-wide assets. Open quote/overlap compositions may use landscape material.
- The original eligible universe remains the 83 mascot stickers, 24 object stickers, and all 788 approved main editorial assets (photo, associative, surreal, graphic, psychedelic-humor). `editorial-v2` contributes 195 non-brand visual entries: 142 text-free visuals enter generic automatic selection, while 53 embedded-copy entries await locale/copy metadata. It also contributes 19 empty paper templates; seven packaged review-required assets are disabled by manifest metadata. Synastry and zodiac collections remain purpose-specific. Common visuals dominate; surreal forms appear periodically and psychedelic humor is rare but reachable.
- The stable seed is `userId + periodKey + contractVersion`; the same day reopens identically, adjacent days cannot repeat a layout or asset, and no visual state is stored in the database.
- Body prose remains primary and never sits on an image or in an additional card. A `paper_note` is the deliberate live-text-on-empty-paper exception; its deterministic template supplies only the paper surface and safe area. Today has at most one strong visual and some days are deliberately image-free. Assets live in `public/stickers/`, `public/stickers/editorial-v2/`, and `public/assets/forecast-feed/editorial-stickers/main/`.

## Android accounts

- Email uses password registration/login, one-time email codes for confirmation and reset, scrypt password hashing, HMAC-protected codes, rate limits, and brute-force protection. The former passwordless email-code login is disabled.
- Google uses Android Credential Manager, Yandex uses LoginSDK 3.1.3, and VK uses VK ID SDK 2.7.2 with OAuth 2.1, PKCE, and state. The server verifies every provider credential.
- One internal `users.id` may own several verified identities. Matching email does not merge accounts, and a provider identity cannot move from another user. The canonical account owns the natal chart, forecast history, Premium state, and saved data.
- Migration `mvp_043_password_authentication` is part of the schema sequence. Live provider credentials, email delivery, Railway secrets, production migration execution, release signing, and device tests are deployment responsibilities.
