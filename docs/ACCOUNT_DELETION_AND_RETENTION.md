# Account deletion and retention

`DELETE /api/users/account` uses one PostgreSQL transaction. It cancels queued notifications, removes the user row and all FK-owned personal records, clears the signed cookie, and is idempotent: repeating the request returns `alreadyDeleted` instead of a 500.

Immediately deleted through user FKs: profile, natal charts, interpretations/caches, forecasts, questions, notification settings/state/logs/queues, app events, sessions, Premium entitlements, Stars and store purchase records, and content unlocks. The deletion service also deletes promo redemptions and legacy-content archives.

Support tickets/messages and administrative audit rows do not use a user FK. Their direct user identifiers are set to `NULL`; ticket content retention is an `OWNER_REQUIRED` legal decision and must be described in the production Privacy Policy. The present schema has no documented statutory retention rule for payment records, so linked payment rows are deleted; owner/legal review must decide whether an anonymised immutable financial ledger is required before public sales.

Local logout/deletion clears native tokens, localStorage, sessionStorage and local personal caches. Logout preserves the server account, revokes the current native/web session and clears the cookie. Deletion additionally invalidates all old native/web tokens because the user no longer exists. Telegram can later create a new account when the user opens the WebApp with valid Telegram init data; it cannot restore deleted data.
