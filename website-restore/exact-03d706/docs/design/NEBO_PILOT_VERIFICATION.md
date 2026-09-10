# Admin design pilot verification — 2026-09-07

Base main: `653908a21395e73626cff9b725a7132f712bfcd3`.

## What was exercised

The actual React/Motion layer controller, natal catalog presentation, preference store and admin control were run in an isolated Chromium page, with synthetic fixtures and an explicitly mocked API transport. Eight scenarios were repeated three times: 24 successful executions, no captured page errors.

Scenarios: light and dark layer expansion/collapse, keyboard operation, internal scroll and scroll retention, card activation; light and dark free reading, saving/restoring the reading place and a deliberate paywall request; premium chapter reading and native-back event; classic/new/theme switching; touch and reduced-motion at 320x640 and 430x932. Standard reading viewport: 390x844. Screenshots exposed browser button vertical centering; it was corrected so titles no longer overlap illustration tiles.

Local TypeScript passed. The focused admin/concurrency/natal/navigation contracts passed 26 assertions. Two other shared-navigation suites passed nine assertions with two failures already present in the original main; no added failures in those suites after adapting their source-contract checks to the admin wrapper.

## Existing baseline is not green

The separately recorded full original-main run had 38 failed suites and 60 failed assertions. They predate this pilot and were not silently disabled or represented as passing. Publishing an opt-in admin preview is not certification that every application feature or every legacy test is complete.

## Release boundary

Classic is the default. The server verifies administrator access for preferences. Preferences do not grant Premium or chart ownership. Database migration is additive and user-linked; selected content is still controlled by existing services and payment validation.

Main new screens: dashboard, own natal overview/chapters/reading, common layers/navigation and menu hub. Existing saved-person, compatibility, matrix, onboarding and service detail flows are retained where not migrated. The 34-tile atlas includes twelve zodiac assets from the supplied boards; final high-resolution illustration polishing remains.

Real device gestures, real Telegram identity in this new mode, an actual payment charge and complete visual parity with all forty render states are not claimed as verified. The offline test fixture under scripts is not an application route and must never be used as a production authentication mechanism.
