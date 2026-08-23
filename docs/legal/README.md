# MEOU: release compliance dossier

Status date: **23 August 2026**. This directory is the canonical engineering
record for the first RuStore release. It replaces assumptions in older draft
inventories where production providers were marked `OWNER_REQUIRED`.

The dossier is based on repository/schema inspection, live DNS and production
endpoint checks, and the official sources listed in
[`SOURCES_2026-08-23.md`](./SOURCES_2026-08-23.md). It is a compliance
engineering record, not a substitute for the operator's legal approval.

- [`DATA_FLOW_MAP.md`](./DATA_FLOW_MAP.md) — what MEOU receives, sends, stores,
  logs and deletes.
- [`PROCESSORS_AND_TRANSFERS.md`](./PROCESSORS_AND_TRANSFERS.md) — providers,
  countries, minimisation and cross-border status.
- [`RAILWAY_VERDICT.md`](./RAILWAY_VERDICT.md) — website/API/database/logs
  decision.
- [`RKN_OPERATOR_NOTIFICATION_DRAFT.md`](./RKN_OPERATOR_NOTIFICATION_DRAFT.md)
  — operator-notification worksheet.
- [`RKN_CROSS_BORDER_DRAFT.md`](./RKN_CROSS_BORDER_DRAFT.md) — separate
  cross-border worksheet.
- [`COMPLIANCE_IMPLEMENTATION_TASKS.md`](./COMPLIANCE_IMPLEMENTATION_TASKS.md)
  — exact tasks for parallel auth/backend/Android worktrees.
- [`WEBSITE_DEPLOYMENT.md`](./WEBSITE_DEPLOYMENT.md) — fail-closed Railway
  service, domain cutover and production proof.

`OWNER_REQUIRED` means a real fact or owner action is absent. It must not be
replaced with invented data.
