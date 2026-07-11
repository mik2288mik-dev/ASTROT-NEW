# App API Auth Matrix

`requireAppUser` is the target auth layer. It validates Telegram initData first, then a signed HttpOnly web guest cookie, then a future signed native bearer session. A body/query `userId` is only an expected ownership assertion and never an identity source.

| Endpoint family | Classification | Current server rule |
|---|---|---|
| `/api/content/horoscope/sign-daily`, `sign-weekly` | A public/free | Shared cache; no user writes |
| `/api/content/synastry/sign-compatibility` | A public/free | Shared cache; no chart or Premium |
| `/api/auth/guest`, `/api/users/me` | B guest allowed | Signed session cookie; current user only |
| `/api/users/[id]` | B guest allowed | `requireAppUser`; id must equal authenticated user; guest never receives trial |
| `/api/charts/*` | B guest allowed | `requireAppUser`; user and chart ownership required |
| `/api/content/natal/human-base` | B guest allowed | Signed session plus owned saved chart |
| `/api/content/today/home`, `/api/content/natal/human-daily`, `/api/content/natal/human-section`, `/api/content/synastry/extended` | C/D/E registered + private | Registered/native/Telegram session, server entitlement, owned chart where applicable |
| `/api/admin/*`, payments/subscriptions | C/D registered | Existing Telegram/admin/payment verification; guests denied |

## Guest limitations

Guests receive a stable negative BIGINT identity stored in an HttpOnly signed cookie. They can use shared sign content, save a basic chart, and read the free basic natal section. They receive no trial, Premium, personal daily, full relationship reading, or deep report. Clearing cookies creates a new free-only guest and never grants a trial.
