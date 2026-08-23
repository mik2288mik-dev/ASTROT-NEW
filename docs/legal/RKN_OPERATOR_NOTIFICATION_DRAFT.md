# Draft: Roskomnadzor operator notification (Article 22)

This is a worksheet for the official form, not a filed notification. It is
separate from the cross-border notice. On the repository facts, MEOU does not
fit a reliable Article 22 exemption: it systematically processes account,
birth, authentication and personalised-content data. The owner should file
before release and retain the signed receipt/registry number.

## Operator

| Form field | Draft value |
|---|---|
| Operator | `OWNER_REQUIRED: full registered IP name` |
| INN | `OWNER_REQUIRED` |
| OGRNIP | `OWNER_REQUIRED` |
| Registered/postal address | `OWNER_REQUIRED` |
| Contact email | `OWNER_REQUIRED: privacy email on operator domain` |
| Responsible person | `OWNER_REQUIRED: full name, role, phone/email` |
| Processing start date | `OWNER_REQUIRED: actual first production processing date; do not backdate` |
| Termination condition | End of MEOU operation and expiry of legal/contractual retention duties, followed by destruction/anonymisation under the approved act |

## Purposes, subjects and data

| Purpose | Subjects | Personal data categories |
|---|---|---|
| Account creation, authentication and security | Registered/guest users | Name, email, provider/account/session IDs, credentials/tokens in protected form, IP, user agent, security events |
| Natal chart and personalised content | Users | Name, date/time/place of birth, coordinates/time zone, gender if provided, calculated natal/chart attributes, content history, questions and AI responses |
| Compatibility | Users and persons whose data they submit | Name/label, date/time/place of birth, coordinates/time zone, calculated compatibility/chart attributes |
| Paid access (only when enabled) | Subscribers/purchasers | Account ID, RuStore purchase/product/subscription identifiers and state; no bank-card details received by MEOU |
| Support, deletion and legal requests | Users/requesters | Contact and account details, request text, correspondence, deletion/withdrawal evidence |
| Service security and diagnostics | Users/site visitors | IP, user agent, route/technical event, error metadata, session/account pseudonymous identifier |

Special-category and biometric data are not required by the product and must
not be requested. Free-text support/questions must warn users not to include
health, political, religious, intimate or other excessive/special-category
information.

## Legal bases

- Federal Law 152-ФЗ, including Articles 6, 9, 12, 18, 18.1, 19, 21 and 22,
  in the current version.
- Civil Code of the Russian Federation and the user agreement for processing
  objectively necessary to provide the requested service.
- Separate, specific and informed personal-data consent where consent is the
  selected basis; withdrawal is recorded separately.
- Tax/accounting/consumer-protection duties only if Premium sales are actually
  enabled and only for the data/period required by law.

The operator must approve a purpose-to-basis matrix; do not use consent as a
blanket basis where law/contract is the real basis.

## Actions and methods

Collection, recording, systematisation, accumulation, storage, clarification,
retrieval, use, transfer/provision/access to named processors, blocking,
deletion, destruction and anonymisation. Mixed automated processing with
transmission over internal networks and the Internet; no public dissemination
of user data and no solely automated legally significant decisions.

## Storage location

`P0 OWNER_REQUIRED`: name/legal entity/address of the Russian hosting and
managed-PostgreSQL provider, data-centre location, database service identifier,
backup/storage locations and contract. Current Railway production is foreign
and cannot be entered as a compliant Russian primary database.

## Security measures for the form

Appointment of a responsible person; internal policy and access matrix;
least-privilege accounts and secret rotation; TLS; network isolation of the DB;
protected backups and restore tests; vulnerability/dependency management;
security/event logging without unnecessary PII; incident response; employee/
contractor confidentiality; periodic controls; deletion and destruction acts;
processor contracts and Article 12 transfer assessment. The owner must confirm
which measures are actually deployed before filing.

## Required attachments/evidence

1. Signed operator notification receipt and later public registry entry.
2. Internal policy/order appointing the responsible person.
3. Data-flow/processor register and approved retention schedule.
4. Russian hosting/DB/backup contract and location confirmation.
5. Separate cross-border notice receipt(s), if foreign AI/email/geocoder remain.
6. Published policy URL and versioned consent evidence design.

Official entry points:
[operator notification](https://pd.rkn.gov.ru/operators-registry/notification/)
and [form](https://pd.rkn.gov.ru/operators-registry/notification/form/).
