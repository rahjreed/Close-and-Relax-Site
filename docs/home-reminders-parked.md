# Home Reminders is parked

Home Reminders / Web Push is not part of the launch runtime. It requires no
frontend environment variables, secrets, notification permissions, push Edge
Functions, or scheduler for launch. Keep the existing non-push PWA/install flow.

The complete implementation is preserved on the local-only branch
`feature/home-reminders-parked`, commit
`8f6e1a532564dbb81ed424d3a46dbad046a0515d`.

## Dormant production database history

Production project `hphcejnvxyccmwmofdqc` already has the private push tables and
service-only RPC groundwork. They remain dormant; do not drop or recreate them.
The original SQL is retained unchanged at
`supabase/migrations/20261018171924_homeowner_push.sql` as historical source.
Its corresponding production migration history version is `20261018212856`,
named `homeowner_push`. The differing versions describe the same approved
rollout and must be reconciled explicitly before future migration automation.

Retaining this file is not an instruction to apply it again. Do not run a blanket
migration push: production already has this migration, and the existing optional
Emergency Services retirement migration also requires separate approval.

No Cron setup script, push functions, push UI, or push runtime helpers are
included in the launch revision. Future activation requires a separate reviewed
release from the parked implementation. Never commit private configuration keys
or tokens from local configuration helpers.
