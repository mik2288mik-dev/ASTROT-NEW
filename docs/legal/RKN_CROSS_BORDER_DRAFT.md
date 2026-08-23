# Draft: Roskomnadzor cross-border notification (Article 12)

This is a separate pre-transfer worksheet. It is not the Article 22 operator
notification and it has not been filed. Submit before starting each declared
cross-border transfer; follow the current Roskomnadzor form/status and any
restriction or waiting instruction shown in the operator account.

## Common operator fields

- Operator/INN/OGRNIP/address/responsible person: `OWNER_REQUIRED`.
- Purposes: personalised AI content; authentication/recovery email; location
  lookup; infrastructure/diagnostics only if a foreign system remains.
- Safeguards: TLS, server-side secrets, purpose limitation, payload
  minimisation/pseudonymisation, retention limits, processor terms, recipient
  security response, access/deletion route, transfer register and incident
  process.

## Recipient worksheet

| Country | Recipient | Data | Purpose / basis | Timing/status | Mitigation/evidence to attach |
|---|---|---|---|---|---|
| United States | OpenAI, L.L.C. | Pseudonymous account context; currently name, exact birth date/time/place/time zone, chart facts, recent forecast text and user question | User-requested personalised generation; exact basis must be approved purpose-by-purpose | **Notice before production transfer.** Do not enable until receipt/status permits | DPA/terms and privacy snapshot; recipient security/retention response; `store:false`; remove account/email/device IDs and minimise name/raw place |
| People's Republic of China | Hangzhou DeepSeek AI Co., Ltd. | Intended: non-personal Zodiac sign/period prompt and response | Shared Zodiac content, not account service | If strictly non-personal, document boundary; otherwise **notice before transfer** | Route-level assertion/test that no user/profile/free text enters DeepSeek; current policy snapshot |
| United States | Resend, Inc. | Email address, one-time code and delivery metadata | Registration/recovery communication | **Notice before production transfer** if retained | Provider terms/security/retention; OTP template without profile data; prefer RF transactional mail to remove transfer |
| Foreign/variable | Open-Meteo | Typed birthplace query and requester IP | Geocoding requested by user | **Notice before transfer** if retained | Move behind RF proxy/cache or replace; never send account ID |
| Foreign/variable | Nominatim public endpoint/operator | Typed birthplace query and RF API-server IP | Server fallback geocoding | Recipient must be specifically identified before notice; current public endpoint is unsuitable as an undefined recipient | Replace/self-host in Russia; record exact operator/host if retained |
| United States / Netherlands | Railway Corp | All website/API request metadata; for API, full PD in compute memory/logs and current DB | Hosting/observability | **P0: remove API/DB/logs rather than legitimise localisation failure with a notice** | RF migration and deletion certificate; a cross-border notice does not cure Article 18(5) localisation |

## Information still required from each foreign recipient

Before filing, obtain and archive the recipient's legal name/address, countries
of processing/subprocessors, purposes, data list, retention/deletion terms,
security measures, incident contact, ability to honour data-subject requests,
and whether the recipient supplied the information required by the current
Article 12 procedure. Record the date/version of every answer.

Official entry point:
[Roskomnadzor cross-border transmission](https://pd.rkn.gov.ru/cross-border-transmission/).
