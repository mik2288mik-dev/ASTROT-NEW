# Timeweb Cloud target architecture

- Cloud Server/VDS: Docker runtime, non-root application container, HTTPS reverse proxy, health and readiness probes.
- Managed PostgreSQL: private network only, automated backups plus separately downloaded encrypted backups.
- S3 in a Russian region: non-ephemeral files and backup artifacts; never repository dumps.
- DNS: `api.<owner-domain>` and public legal pages under the owner domain. Mobile apps use only the stable API name.
- Background work: run a single scheduler instance or move it to an explicit worker before horizontal scaling. Record ownership, alerting and retry policy before cutover.

Owner must provide Timeweb access, final domain/DNS control, TLS decision, database plan, object-storage bucket/retention, monitoring destination and backup restore owner.
