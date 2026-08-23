# Railway release verdict

Evidence checked 23 August 2026:

- Live `https://astrot-production.up.railway.app/api/health` and readiness were
  reachable; response headers identified `x-railway-edge: ams1` and an
  Amsterdam trace.
- Railway's regions page lists California, Virginia, Amsterdam and Singapore;
  no Russian region is offered.
- Railway HTTP logs include source IP, user agent, method, path, host and region.
  Application stdout/stderr is retained with plan-dependent windows (7 days,
  30 days, or up to 90 days).
- Repository and prior deployment evidence point to a separate Railway
  PostgreSQL service; no evidence of a Russian production primary database was
  found.

## Decision

| Layer | Verdict | Why |
|---|---|---|
| Public website | **CONDITIONAL, not final release-safe** | A no-form/no-tracker static site minimises data, but Railway still receives and logs visitor IP/UA outside Russia. It may be used only as a temporary marketing host after the operator approves/reflects that transfer; an RF host is the clean answer. |
| Backend/API | **BLOCKED** | A Russian DB alone would not solve it: names, email, birth details, questions, tokens and IDs enter Amsterdam instance memory and can reach HTTP/app/error logs, caches or temp state. This is foreign processing before the DB write. |
| Database | **BLOCKED** | Current production is not evidenced in Russia. A Railway PostgreSQL service is foreign storage/accumulation and fails the intended localisation architecture. |
| Logs/cache/temp/backups | **BLOCKED** | Railway access/app logs are foreign and not deletion-aware. Cache/temp/queue/volume locations and enabled backup policy have not been proven. Environment variables also sit in the foreign service control plane. |

## Can Railway compute remain if the primary database is in Russia?

**Not for this release architecture.** Article 18(5) localisation is not reduced
to the final database address. MEOU's personal data would first be collected and
processed by foreign application compute and observability. A Russian primary
DB helps but does not remove that earlier foreign collection/processing or the
separate Article 12 obligations.

## Fastest safe cutover

- Deploy the existing standalone Docker app to the documented Russian VDS/
  managed-PostgreSQL target; keep DB, cache/queues, logs and backups in Russia.
- Put a reverse proxy/TLS in front, disable request-body/query logging, hash or
  remove user/chart IDs, set retention, and verify backup restore/deletion
  replay.
- Switch only stable `api.tvoi-goroskop.ru` after staging smoke tests. The
  current CNAME points to Railway and TLS verification returns a hostname
  mismatch, so it must not be compiled into a release until corrected.
- The website can deploy separately and never receive app/API secrets.

## Sources

- [Railway deployment regions](https://docs.railway.com/deployments/regions)
- [Railway logs and retention](https://docs.railway.com/observability/logs)
- [Railway volume backups](https://docs.railway.com/volumes/backups)
- [Railway privacy notice, effective 20 April 2026](https://railway.com/legal/privacy)
- [152-ФЗ, official consolidated text portal](https://pravo.gov.ru/proxy/ips/?docbody=&nd=102108261)
- [23-ФЗ of 28 February 2025, localisation amendment](https://publication.pravo.gov.ru/document/0001202502280034)
