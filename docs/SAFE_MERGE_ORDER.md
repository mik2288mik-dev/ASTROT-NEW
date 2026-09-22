# Safe merge order

1. Finish and publish `feat/personal-forecast-feed-v3` from the local Codex workspace.
2. Review and merge documentation PR for onboarding/site/legal.
3. Create or rebase `feat/marketing-site-v1` onto the documentation commit; deploy independently using the `marketing-site` root directory.
4. Generate and approve final onboarding assets against `ONBOARDING_ASSET_PACK_V1.md`.
5. Create `feat/onboarding-v1` from the finished forecast branch and implement only the runtime onboarding integration.
6. Run full app tests, mobile build, store compliance and final binary data audit.

Never paste the uncommitted forecast working tree into the onboarding or website branches.
