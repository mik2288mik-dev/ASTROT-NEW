# RuStore listing draft

> Legal/data declarations are superseded by
> [`RUSTORE_LEGAL_RELEASE_CHECKLIST.md`](../../../RUSTORE_LEGAL_RELEASE_CHECKLIST.md).
> The approved public identity for this RuStore release is `MEOU`. Keep the
> Android system label and Console listing identical before submission.

All product, payment and legal values are `OWNER_REQUIRED`; this file does not
invent them.

## Store text

| Field | Draft |
|---|---|
| Name | `MEOU` |
| Short description | `Личные ИИ-прогнозы по контексту натальной карты.` |
| Full description | `MEOU создаёт личный ИИ-рассказ на сегодня, неделю и месяц по выбранному периоду и контексту сохранённой натальной карты. В приложении есть персональные прогнозы, разбор натальной карты, совместимость и вопросы по карте. Прогнозы дают повод посмотреть на ситуацию по-новому и не являются медицинской, психологической или финансовой рекомендацией. В настройках доступны поддержка, политика конфиденциальности, пользовательское соглашение, выход и удаление аккаунта.` |
| Search tags | `гороскоп`, `натальная карта`, `астрология`, `совместимость`, `прогноз` — confirm availability in the current Console UI. |
| Category / age rating | `OWNER_REQUIRED`: choose only after reviewing the current RuStore category and rating questionnaire. |
| Release notes | `Первая Android-версия: прогнозы, натальная карта, совместимость и управление аккаунтом.` |

## Payment setup

1. In RuStore Console, create the application using the final signed package
   name and enable monetisation.
2. Create the approved subscriptions/products. Supply each final product ID and
   map it in `NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_MONTH`,
   `...QUARTER`, `...YEAR` plus server-only `RUSTORE_ALLOWED_PRODUCT_IDS`.
3. Copy Console application ID to server-only `RUSTORE_CONSOLE_APP_ID`; put the
   final package in `RUSTORE_PACKAGE_NAME`; store the Public API key ID in
   `RUSTORE_KEY_ID` and the PKCS#8 RSA private key as base64 in server-only
   `RUSTORE_PRIVATE_KEY_BASE64`. The backend obtains short-lived JWE tokens.
4. Register the HTTPS callback
   `https://<owner-domain>/api/payments/rustore/notifications` and store its
   AES-256 key only as `RUSTORE_NOTIFICATION_AES_KEY`.
5. Do not configure a trial for the first release. Add owner-provided test VK IDs,
   install the sandbox build with RuStore, and
   test purchase, cancel, restore and callback processing. A client success
   never grants Premium until server validation succeeds.

## Console checklist

- `OWNER_REQUIRED`: legal entity/payment details, final package name, permanent
  signing key, Console application ID, products, prices, periods, trial terms,
  Public API credentials, callback key, sandbox VK IDs, privacy/terms/deletion
  URLs, support contact, final rating, release notes and store assets.
- The build uses current RuStore Pay SDK, not deprecated BillingClient. Google
  Play payment is deliberately not part of this flavor.
