# Current repository context

## Product

Your Horoscope is an Android-first Capacitor application backed by Next.js/React and PostgreSQL. The Telegram Mini App remains a supported distribution channel, including Telegram Stars, but Android is the primary product platform.

## Personal AI forecast

The active personal forecast experience lives in `views/Dashboard.tsx`. The period is selected in the diary drawer; the main screen has no period tabs, cards, or separate reader pages. Today is a continuous reading feed of 4–6 AI-written fragments. Week and Month are each one cohesive AI-written personal story.

- UI: `components/PersonalForecastFeed/` and `styles/personalForecastFeed.css`
- Contract and cache identity: `lib/personalForecastContract.ts`
- Generation: `lib/personalForecastGeneration.ts` sends OpenAI Luna the selected date/range, saved personal/natal context, and bounded recent-copy anti-repeat context. Luna authors all visible forecast prose. The old generic `profileNarrativeDirection`/editorial-topic rotation is not part of the product.

Swiss Ephemeris calculates and stores the natal chart. It does not calculate a separate transit/evidence package for every forecast period. The model must never present its interpretation as a deterministic calculation or invent astrological facts not supplied by the server.

OpenAI Luna through the Responses API is the route for personal forecast prose. Strict structured output returns one shared headline, visible fragments, post-hoc diversity keys, and hidden `presentation_style`. Today maps that field to optional `ForecastSection.presentationStyle`: the first fragment and at least one more are `prose`, with at most one `pull_quote` and at most one `paper_note`; it is never a visible category. Week and Month stay prose stories. Zodiac remains a separate sign-based product with its DeepSeek route.

## Current visual direction

Forecast copy is clean and readable: a short shared heading and at most 150 words in total. Today reads top-to-bottom as 4–6 untitled fragments with no visible Love/Work/Mood categories; Week and Month remain single stories. The app owns five deterministic Today compositions and keeps the approved 895-asset visual universe while adding `public/stickers/editorial-v2/`: 195 non-brand visual entries, of which 142 text-free visuals enter generic automatic selection, plus 19 empty paper templates. The 53 embedded-copy visuals stay packaged but await per-asset locale/copy metadata; seven review-required assets are excluded by manifest metadata. Selection uses `userId + periodKey + contractVersion`, honours rarity, weight, orientation, and layout compatibility, and never uses random state. Luna never chooses assets, layout, coordinates, or colours. Some days are image-free, every day has at most one strong visual, and adjacent days do not repeat layout or asset. Body prose is never placed over imagery or inside a card. A paper note is the explicit exception: runtime text on an empty paper template, never text baked into PNG/WebP. Do not add promo banners, feedback prompts, questions, “hit/miss” controls, chat, games, or morning/day/evening segmentation without an explicit product decision.

## Android accounts

Android supports email registration and password login with code-confirmed email/reset flows, Google through Credential Manager, Yandex through LoginSDK 3.1.3, and VK through VK ID SDK 2.7.2 with OAuth 2.1, PKCE, and state validation. Multiple verified identities may link to one internal `users.id`; matching email alone never merges accounts. Natal chart, history, Premium, and saved data belong to that internal account. Migration `mvp_043_password_authentication` adds password authentication state. Live provider credentials, email delivery, Railway secrets, and the production migration remain owner-operated setup.

## Useful commands

```bash
npx tsc --noEmit
npm test -- --runInBand
npm run lint
npm run build
```

Use targeted tests first for a scoped UI change. Deployment and Railway checks require an explicit request.
