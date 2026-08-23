# Exact implementation tasks for parallel worktrees

These tasks are intentionally not implemented here because they touch parallel
auth, Android, forecast, compatibility or production-infrastructure work.

## P0-1 — separate consent and durable evidence

- **File/component:** current onboarding/auth acceptance component; new
  migration next to `lib/migrations.ts`; auth/account service.
- **Current problem:** no separate, explicit personal-data consent and no
  durable version/timestamp/account/withdrawal evidence was found. A combined
  agreement/policy/consent checkbox is not acceptable after 1 September 2025.
- **Required change:** show Terms acceptance separately from PD consent; link
  the exact document versions; prevent account completion until required
  choices are recorded; store `user_id`, consent purpose/scope, document ID and
  version, text hash, timestamp, source/channel and withdrawal timestamp. Do
  not treat Privacy Policy acknowledgement as consent.
- **Acceptance criteria:** two independent controls; unchecked by default;
  keyboard/screen-reader accessible; API rejects absent/stale required consent;
  evidence is queryable and survives document updates; withdrawal disables
  consent-only processing without deleting evidence needed to prove withdrawal;
  tests cover accept, reject, new version and withdrawal.

## P0-2 — move production PD compute/storage/logs to Russia

- **File/component:** deployment service, PostgreSQL, reverse proxy, stable
  `api.tvoi-goroskop.ru`, environment/secrets and backup runbook.
- **Current problem:** live API/edge is Amsterdam and current DB evidence points
  to Railway; Railway captures IP/UA and stdout/stderr abroad.
- **Required change:** deploy existing container to RF VDS/managed platform;
  Russian PostgreSQL/private network; RF log and backup storage; configure TLS,
  health/readiness, one scheduler, secret rotation, finite log retention and
  deletion-aware restore procedure; fix stable-domain certificate.
- **Acceptance criteria:** provider letter/contract identifies RF data-centre
  and backup locations; DNS/TLS clean; live auth/chart/forecast/delete smoke;
  no Railway hostname in signed release; database row-count/restore proof;
  Railway writes frozen and old service removed only after verified rollback
  window.

## P0-3 — remove PII from logs

- **File/component:** `lib/errorTracking.ts`, `lib/logger.ts`, direct
  `console.*` calls in API/chart/calculation/auth paths, reverse-proxy config.
- **Current problem:** user IDs, chart IDs, endpoint/error data can reach hosted
  stdout; access logs include IP/UA and paths.
- **Required change:** centrally hash/omit direct IDs, strip query/body/tokens,
  add explicit safe-field allowlist, prevent birth/email/name/question logging,
  configure IP masking and retention.
- **Acceptance criteria:** automated canary values never appear in application
  or proxy logs; secrets/token patterns blocked; documented retention and
  access; security events remain diagnosable via rotating pseudonymous IDs.

## P0-4 — minimise foreign AI payload

- **File/component:** `lib/personalForecastGeneration.ts`,
  `lib/personalForecastQuestionGeneration.ts`, natal/synastry generation routes,
  `lib/openaiResponses.ts`.
- **Current problem:** OpenAI prompt can include name and exact raw birth date,
  time, place/time zone plus history and question. `store:false` reduces product
  state but not default abuse-monitoring logs.
- **Required change:** define per-feature payload schema; omit email/account/
  device/IP always; replace name with neutral second-person voice or local
  pseudonym; prefer calculated chart facts over raw place/coordinates and remove
  fields not needed for output; bound history; keep `store:false`; pursue
  approved MAM/ZDR if commercially available.
- **Acceptance criteria:** snapshot tests prove forbidden identity fields cannot
  enter provider JSON; representative Today/Week/Month/natal/compat/question
  quality tests still pass; provider/retention recorded in the transfer register.

## P0-5 — RF geocoding boundary

- **File/component:** city autocomplete client and
  `lib/swisseph-calculator.ts` Open-Meteo/Nominatim fallbacks.
- **Current problem:** direct client calls disclose IP and typed birthplace to
  foreign infrastructure; fallback recipient can be variable.
- **Required change:** RF-hosted geocoder/dataset or RF backend proxy/cache with
  no account ID, short query retention and rate limits. Remove client-direct
  foreign request.
- **Acceptance criteria:** network trace from Android shows only the MEOU RF API;
  provider/location/retention evidenced; city selection and timezone/natal
  calculation tests unchanged.

## P0-6 — another person's compatibility data

- **File/component:** compatibility add-person form and persistence API.
- **Current problem:** user can submit another person's name/date/time/place/
  coordinates without an authority acknowledgement or excess-data warning.
- **Required change:** explain that the user must have a lawful basis/permission;
  request a nickname/label instead of full legal name; prohibit special/excess
  free text; make time/place optional where product can degrade gracefully;
  provide per-person delete/edit.
- **Acceptance criteria:** concise pre-submit notice; accessible separate
  acknowledgement if legal review selects consent evidence; no full-name
  requirement; saved counterpart can be deleted independently; policy/Terms
  wording matches the UI.

## P0-7 — MEOU/store-installed identity consistency

- **File/component:** `capacitor.config.ts`, Android string resources, launcher
  labels, RuStore listing/config and public website config.
- **Current problem:** website name is MEOU; installed/store draft name remains
  `Твой гороскоп: натальная карта`; RuStore requires presented identity to match.
- **Required change:** owner chooses final public name, then update installed app,
  store listing and site in the Android release worktree without changing the
  package/signing identity unintentionally.
- **Acceptance criteria:** signed APK label, launcher title, RuStore name/icon and
  website name verified side-by-side; package remains
  `ru.tvoygoroskop.app` unless an explicitly approved migration is performed.

## P0-8 — retention/deletion closure

- **File/component:** `lib/accountDeletion.ts`, support storage/mailbox, log
  platform, DB backup/restore scripts and retention policy.
- **Current problem:** the transaction correctly removes user-owned rows and
  scrubs provider events, but support free text, foreign logs and backups can
  retain identity; no deletion-replay after restore.
- **Required change:** approve a purpose-based schedule; scan/anonymise support
  text or delete it; expire log identifiers; maintain deletion tombstones outside
  ordinary backups and replay them after restore; create destruction evidence.
- **Acceptance criteria:** integration test covers every user-linked table;
  restored backup cannot resurrect deleted account; support mailbox/tickets and
  logs follow documented periods; privacy page states the same periods.

## P0-9 — production dependency vulnerabilities

- **File/component:** `package.json`, `package-lock.json`, Next.js runtime,
  image processing and `swisseph-v2` native build chain.
- **Current problem:** `npm audit --omit=dev --audit-level=high` on 23 August
  2026 reports 14 production vulnerabilities: 1 moderate, 12 high and 1
  critical. A critical `tar` chain is pulled through
  `swisseph-v2 -> node-gyp -> tar` and has no automatic fix in the current
  dependency graph. The non-force audit fix would also change 223 packages,
  update `swisseph-v2` and remove 521 packages, so it is not a safe scoped fix.
- **Required change:** in an isolated dependency worktree, upgrade the supported
  Next.js line and direct vulnerable packages; test `swisseph-v2` 1.1.0 or a
  maintained replacement against the deterministic natal fixtures; remove the
  native build toolchain from the public website image if it is not required at
  runtime. Do not use `npm audit fix --force` blindly.
- **Acceptance criteria:** clean install on Node 22, deterministic natal tests,
  app and website production builds, targeted auth/payment regression tests,
  and no unresolved critical/high runtime vulnerability or a documented,
  owner-approved exception with an exposure analysis and expiry date.

## P1 — age/rating and Premium activation

- **File/component:** onboarding/Terms acknowledgement; RuStore rating form;
  `NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED` and purchase presentation.
- **Current problem:** no implemented age gate was found; Premium is deliberately
  disabled and must not be described as sold.
- **Required change:** owner/legal selects minimum age and parental-consent flow;
  complete RuStore questionnaire; enable Premium only after products, prices,
  auto-renewal/cancel/restore texts and production callbacks are verified.
- **Acceptance criteria:** UI, Terms, store rating and actual build agree; first
  free release contains no purchase CTA or false subscription disclosure.
