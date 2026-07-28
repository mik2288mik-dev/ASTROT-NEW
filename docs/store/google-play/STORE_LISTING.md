# Google Play listing draft

All marked `OWNER_REQUIRED` fields must be confirmed in Play Console immediately
before upload. Do not claim a function that is absent from the submitted flavor.

## Store text

| Field | RU | EN |
|---|---|---|
| Name | `Твой Гороскоп` | `Your Horoscope` |
| Short description | `Персональные астрологические прогнозы по данным натальной карты.` | `Personal astrology forecasts based on your natal chart.` |
| Full description | `Твой Гороскоп помогает посмотреть на день, неделю, месяц и год через натальную карту и расчёты периода. В приложении есть персональные прогнозы, разбор натальной карты, совместимость и вопросы по карте. Прогнозы — это понятный ориентир для размышления, а не медицинская, психологическая или финансовая рекомендация. В настройках доступны поддержка, политика конфиденциальности, пользовательское соглашение, выход и удаление аккаунта.` | `Your Horoscope offers personal daily, weekly, monthly and yearly astrology forecasts based on your natal chart and the selected period. Explore your natal chart, compatibility and questions about your chart. Forecasts are for reflection and are not medical, psychological or financial advice. Settings provide support, privacy policy, terms, sign-out and account deletion.` |
| Release notes | `Первая Android-версия: прогнозы, натальная карта, совместимость и управление аккаунтом.` | `First Android release: forecasts, natal chart, compatibility and account controls.` |

Before publishing, run the character-limit check in Play Console; the final
localised text and release notes require `OWNER_REQUIRED` confirmation.

## App access and reviewer instructions

- A reviewer can use the native guest flow; Telegram client and Telegram init
  data are not required for the Android build.
- A profile unlocks personalised calculations. Use a test account supplied by
  the owner if an authenticated review is required.
- Existing Premium is read from the backend. Google Play Billing is deliberately
  not implemented in this build; no checkout button leads to a dead payment.
- A test account can use Settings → Delete account. The owner must supply any
  credentials or restricted-content instructions required by Play Console.

## Data Safety draft

Use `docs/DATA_INVENTORY.md` as the evidence source. Each answer needs a final
owner/legal review because hosting, support and analytics vendors are not yet
fixed. Confirmed code facts: account/profile identifiers, birth data, natal
chart/forecast data, questions, session/device data, entitlement state and
support data are processed. The current code has no native push SDK and does
not implement Google Play Billing. Do not declare sharing, retention or data
collection as "none" without checking the deployed services.

## Checklist

- `OWNER_REQUIRED`: final package ID, signed AAB, privacy/deletion URLs,
  support contact, operator identity, legal review, rating questionnaire,
  Data Safety answers, account-access instructions and store assets.
- Do not promise Tarot, native push notifications, Google Play payments,
  medical/psychological/financial results or AI functions absent in the build.
- Confirm every URL is public HTTPS and works outside the app.
