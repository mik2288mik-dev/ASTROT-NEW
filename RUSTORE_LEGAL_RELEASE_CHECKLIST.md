# MEOU RuStore legal release checklist

Prepared from repository/API/Android inspection on 23 August 2026. Re-run the
checks against the final signed APK: RuStore requires disclosure of data
collected/transferred by the app, SDKs and backend—not merely Manifest
permissions.

## Identity and public links

- [ ] Final name selected. Current mismatch: website **MEOU** versus installed/
  draft store name **Твой гороскоп: натальная карта**.
- [ ] Package verified as `ru.tvoygoroskop.app`; signing key/certificate checked.
- [ ] Website: `https://tvoi-goroskop.ru/` returns 200 with valid TLS.
- [ ] Privacy: `/privacy`; Terms: `/terms`; deletion: `/delete-account`;
  separate consent: `/personal-data-consent`; support: `/support`.
- [ ] Real IP/operator, support and privacy contacts visible; no
  `OWNER_REQUIRED`/placeholder text; published document versions archived.

## Final APK permissions and SDKs

- Manifest currently declares only:
  - `android.permission.INTERNET`
  - `android.permission.ACCESS_NETWORK_STATE`
- Native dependencies found: Capacitor network/app/preferences, Yandex Login SDK,
  VK ID SDK and RuStore Pay SDK/config. No analytics, advertising, location
  permission or crash-reporting SDK was found in the inspected source.
- [ ] Run `npm run android:validate:release` and inspect the **merged release
  manifest** plus a real device/proxy network trace; transitive SDK manifests
  can add declarations.

## Data categories to declare from actual flows

| RuStore category | MEOU data/use | Collected | Shared/transferred |
|---|---|---:|---:|
| Personal info — name | Profile, chart and personalised generation | Yes | Yes, currently OpenAI |
| Personal info — email | Email registration/login/recovery | Yes | Yes, Resend and selected auth flow |
| Personal info — user ID | Account/session/provider IDs | Yes | Yes, auth/RuStore as required; must not be sent to AI |
| Other personal info / date of birth | Birth date/time/place, coordinates/time zone, other-person compatibility data | Yes | Yes, current AI/geocoding flows |
| User content / other messages | AI question, support text, generated-history context | Yes | Yes, OpenAI; mail provider for email support |
| App activity / interactions | Forecast/history/content use and server events | Yes | Potentially hosting/logging; no advertising analytics found |
| Diagnostics | Error message/endpoint and technical metadata | Yes | Current hosting/logging provider |
| Device or other identifiers | Session/provider/SDK identifier; IP/UA in network logs | Yes | Hosting and selected auth/store SDKs |
| Purchases | RuStore purchase/product/subscription ID and state | Only when Premium enabled | RuStore and MEOU backend |
| Precise/approximate device location | No Android location permission or GPS use found | No | No; birthplace coordinates are user-provided profile data, not device location |
| Contacts/photos/files/health/financial-card data | Not required/found | No | No |

Mark purposes consistently: app functionality/personalisation, account
management/security, developer communications and purchases only where active.
Do not declare advertising or analytics unless the final build adds them.

## Consent, deletion and security

- [ ] Separate PD consent is explicit, unchecked, versioned and stored; Terms
  acceptance is a different action.
- [ ] Policy is readable before consent and from the app/site without login.
- [ ] Account deletion works in-app and at the public URL; authenticated delete
  smoke confirms profile/charts/history/questions/sessions/purchases disappear.
- [ ] Support text, logs and backup rotation follow the published retention
  schedule; restored backups cannot resurrect a deleted account.
- [ ] HTTPS only; no secrets in APK/client; release logging disabled; API domain
  certificate valid; primary DB/API/logs/backups evidenced in Russia.
- [ ] Article 22 operator and Article 12 cross-border submissions/receipts are
  archived before release.

## Premium/subscriptions

- First-release config is `NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED=0`; therefore do
  not advertise or expose a fake Premium purchase/restore flow.
- If Premium is enabled later: declare purchases, actual price/period/trial,
  auto-renewal, cancellation and restore exactly as RuStore implements them;
  server-validate purchase ownership and callbacks; never claim MEOU stores card
  data.

## Age, content and listing consistency

- [ ] Owner completes the current RuStore age questionnaire from actual AI/user
  content; chosen age matches Terms/onboarding.
- [ ] Listing describes only released features: personal Today/Week/Month
  forecast, natal chart/personality reading and compatibility. Questions and
  Premium appear only if enabled in the signed build.
- [ ] Lifestyle/entertainment wording and no medical, psychological, financial,
  guaranteed-event or “100% accuracy” claims.
- [ ] Final screenshots, app title, feature names, support email and legal URLs
  match the website and installed build.

Official references:
[requirements](https://www.rustore.ru/help/developers/publishing-and-verifying-apps/requirement-apps),
[permission declaration](https://www.rustore.ru/help/developers/publishing-and-verifying-apps/app-publication/new-version-app/declare-app-permissions),
[data categories](https://www.rustore.ru/help/developers/publishing-and-verifying-apps/app-publication/new-version-app/declare-app-permissions/data-categories).
