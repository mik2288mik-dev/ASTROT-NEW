# Account deletion and retention

`DELETE /api/users/account` uses one PostgreSQL transaction. It first revokes every web/native/Telegram app session, cancels queued notifications, removes the user row and all FK-owned personal records, clears the signed cookie, and is idempotent: repeating the deletion service returns `alreadyDeleted` instead of a 500.

Immediately deleted through user FKs: profile, natal charts, interpretations/caches, forecasts, questions, notification settings/state/logs/queues, app events, sessions, Premium entitlements, Stars and store purchase records, and content unlocks. The deletion service also deletes promo redemptions and legacy-content archives.

Support tickets/messages and administrative audit rows do not use a user FK. Their direct user identifiers are set to `NULL`; RuStore event rows have purchase IDs removed before the purchase ledger is deleted. Ticket content retention is an `OWNER_REQUIRED` legal decision and must be described in the production Privacy Policy. The present schema has no documented statutory retention rule for payment records, so linked payment rows are deleted; owner/legal review must decide whether an anonymised immutable financial ledger is required before public sales.

Local logout/deletion clears native tokens, localStorage, sessionStorage and local personal caches. Logout preserves the server account and revokes only the current server session unless the user explicitly calls the all-sessions endpoint. Deletion additionally persists token revocations before the account/session rows disappear. Telegram can later create a new empty account when the user opens the WebApp with valid Telegram init data; it cannot restore deleted data.
