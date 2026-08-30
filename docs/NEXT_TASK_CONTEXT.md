# Current NEBO release context

This short checklist records active release work that is not yet part of a
published update.

## RuStore

- Version `1.0.0 (2)` remains in moderation.
- Publication mode remains manual with a 100% audience.
- Do not withdraw, replace, or publish this version without a new user command.
- Prepare `versionCode 3` locally. Upload it only after the moderation result or
  another explicit release decision.
- The submitted listing and RuStore release branch promise five accepted natal
  questions per day. `origin/main` still enforces the legacy limit of three;
  merge and deploy the release change, then verify the live API before claiming
  production parity.

## Version 3 preparation

- Remove draft markers and placeholders from public and packaged legal pages.
- Add a separate unchecked personal-data consent before profile data is sent.
- Store the consent version, timestamp, source, language, and revocation state.
- Keep Terms acceptance separate from personal-data consent.
- Verify the age value, merged Android permissions, data declaration, signing,
  package ID, API URL, and RuStore products in the finished artifact.

## Device QA

Check safe areas, startup, onboarding, purchase, restore, account linking, deletion, back/swipe behavior, deep links, process restart, and slow network states on a physical Android device.
