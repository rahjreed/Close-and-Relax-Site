# Admin, Support and Legal launch runbook

Local preparation only. No production setting, migration, deployment, admin membership,
email notification or deletion is authorized by this document. The pages at `/privacy`
and `/terms` are explicitly marked launch drafts, not attorney-reviewed documents.
Draft status and placeholders must be resolved before broad paid launch. Do not simply
remove the marker without reviewing the underlying decisions.

## Founder and professional review gate

- Confirm the legal operating entity, business/contact details, launch markets,
  intended audience and effective dates. The brand name alone is not a verified entity.
- Approve retention by category: Auth/account/profile/files, analytics identifiers,
  insurance leads/consent, support messages, abuse hashes, infrastructure logs,
  backups and any obligations to preserve records. No universal period is promised.
- Confirm privacy roles/agreements and applicable rights, access/deletion response
  procedures, international processing and required notices in the actual markets.
- Approve Goosehead handoff/contact permissions with the partner and counsel. The
  checkbox currently authorizes **Close & Relax team contact only**, not direct
  Goosehead marketing. Submissions stay in the private admin inbox; there is no
  automated partner transfer. Do not forward details or broaden outreach on this
  checkbox alone. Obtain/record the appropriate permission and approve any new
  disclosure/consent wording before changing that workflow. No compensation claim
  or referral economics are asserted. Review Vivint relationship language as well.
- Finalize billing/renewal, taxes, upgrades/downgrades, cancellation effective time,
  refunds, founding-rate continuous-subscription/loss/reactivation rules and support
  process before Stripe checkout is enabled. Locked prices/entitlements are unchanged.
- Counsel should finalize warranties/liability, content permissions, suspension,
  dispute process and applicable law. No jurisdiction, liability cap or arbitration
  term was invented. Decide how final Terms are presented/accepted and versioned;
  the new informational links create no acceptance record.
- Assign an actual monitored support mailbox and review cadence. Confirm the
  temporary failure fallback `hello@callistadigital.com` is monitored. Do not promise
  response SLAs before staffing them. Changing to `support@closeandrelax.com` later
  requires an operational mailbox and the existing frontend environment override.

## Storage / cookie audit and consent decision

Repository scan found no `document.cookie` / Cookie Store writes, ad pixels,
Google Analytics, Vercel Analytics SDK, or third-party analytics SDK. Supabase JS
uses its default persisted Auth session in localStorage. The active hub uses:

| Purpose | Storage / transmission |
| --- | --- |
| Checklist progress / adjusted due dates | Per-hub localStorage; not uploaded |
| Three My Home Contacts | `closeandrelax-home-contacts-v1:<profile ID>` localStorage; not uploaded |
| Hub activity | Per-hub random browser UUID in localStorage; sessionStorage view/standalone dedupe; allowed events to Supabase |
| Insurance/support drafts | Component memory only, then private server storage on successful submission |
| PWA installation | Browser install state, generated hub manifest/icon; no push runtime |
| Preview history | Realtor Auth metadata, not homeowner storage |

Host/origin/browser boundaries matter: localStorage does not synchronize between
devices or different hub origins. Private preview suppresses homeowner storage,
analytics and PWA metadata/install effects. It is not a way to inspect homeowner data.

Network dependencies also matter: Google Fonts loads on branded pages; a configured
welcome video loads a YouTube privacy-enhanced iframe. That does not guarantee zero
third-party storage. Turnstile loads on insurance review/support forms. Calendly,
Vivint and other external destinations may have their own storage when opened.
Supabase, Vercel, Resend Auth SMTP and these services may maintain operational logs.
No live third-party cookie/network audit or production SMTP re-verification was
performed in this pass. Do not describe the entire product as “cookie-free.”

No decorative consent banner was added: there is no app-managed cookie consent
system to truthfully operate, and a banner that merely acknowledges text would not
control storage. This is **not** a finding that consent is unnecessary. The random
analytics ID/event collection and embeds require a market-specific review before
launch. If consent is required, gate nonessential identifier creation/ingestion and
third-party embeds before loading, provide decline/withdrawal controls and test
them; a Privacy link alone is not consent. UK guidance expressly includes local
storage and similar technologies: [ICO cookies and similar technologies](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/).

The current hardened analytics ingestion prunes records older than 90 days for an
active hub during valid ingestion and caps growth; dormant hubs are not guaranteed
automatic expiry. See `hub-activity-security.md`. This is not a complete product
retention policy or a promise of deletion on day 90.

## Support operations

1. Release prerequisites: follow `support-inbox.md` in its approved order: migration,
   server-only salt / Turnstile hostname/action verification, `support-contact`
   deployment, matching frontend, separately approved end-to-end test. Do not
   represent the locally implemented inbox as already operational in production.
2. Only the platform-admin allowlist can read/update the inbox. Do not provision
   staff by changing profile plans or user-editable metadata. New staff access
   requires separate authorization; never share an owner login.
3. Assign the owner/staff member a regular review schedule and backup coverage.
   Open dashboard Support Inbox, choose Refresh newest, and review Older pages
   too. Newest-first ordering is not priority ordering; look for older unresolved
   items. There are no automatic alerts, assignment fields, SLA timers or reply logs.
4. **New** = not reviewed; **In progress** = actively investigating/waiting for a
   response; **Closed** = resolved or a documented disposition. Changing status
   sends nothing and is not a deletion. Use an approved restricted case record
   for disposition/ownership checks; do not put PII in Git, analytics or public notes.
5. “Reply in email app” creates a mailto draft to the sender; verify the recipient
   and send manually from the approved monitored support mailbox. No sender is
   configured by this UI. Do not assume it sends, or mark a message replied/closed
   merely because the link opened. Keep the support reference in correspondence.
6. Prioritize access/security and closure requests. Never ask for passwords,
   CAPTCHA tokens, recovery links, SMTP keys or session credentials. Use the
   existing Auth recovery flow for access help; do not disable confirmation/RLS.
   Escalate suspected compromise to the authorized owner and preserve only needed
   incident evidence. The inbox is not an emergency dispatch service.
7. Monitor the temporary fallback mailbox independently. It receives only messages
   visitors explicitly send after a form failure, never inbox copies or alerts.
   Do not treat the fallback sender's email as verified account ownership.
8. Success means the server confirmed a saved reference, not an email was sent.
   Failure preserves the in-memory draft for retry; refresh/close loses it. Ask
   for the reference if available and check duplicates before requesting resubmission.

## Manual account closure / deletion (staff checklist, no executable automation)

1. **Receive and scope.** Use the existing Account & Settings → request flow, or
   Support. Record the support reference and distinguish unpublishing, closure,
   deletion, correction and future subscription cancellation. Explain that nothing
   is deleted instantly and agree on the scope before any destructive action.
2. **Verify ownership independently.** A typed support email/name is not proof.
   Verify an authenticated account through a separately approved process or a
   verified-channel challenge controlled by that account. If access is lost, use
   Auth recovery/owner escalation. Never request a password or recovery token.
3. **Review dependencies and preservation.** Inventory the specific Auth UUID,
   profile, owned vendors/checklist templates/custom sections, profile-image object
   paths, activity and any private records linked to that profile. Check the live
   schema/FKs first, and separately authorize retention/export/legal holds. Do not
   export whole tables or unrelated homeowners' leads for a Realtor request.
4. **Communicate and approve.** Tell the owner what will stop working, what may be
   retained (and why under the approved policy), local-device limits and the point
   at which deletion cannot be undone. Obtain the appropriate action approval.
5. **Hide and prevent recreation.** Unpublish the correct hub first. Before profile
   removal, an authorized operator must prevent further account use and revoke
   sessions using approved Auth admin controls. Refresh-token revocation/deleting
   Auth does not instantly invalidate every issued access JWT; account for its
   remaining lifetime and sensitive-operation checks. Profile bootstrap can recreate
   a missing profile while the Auth user remains active, so do not delete only the
   profile and assume closure is complete. No new blocking/deletion endpoint exists.
6. **Handle billing when it exists.** Stripe is not implemented. Once introduced,
   cancel the actual subscription/renewals through the approved server/provider
   flow and decide effective timing/refunds/retention before deleting identifiers.
   Closing an inbox ticket is not billing cancellation. Do not invent a refund.
7. **Storage, profile and Auth cleanup.** After all approvals, use approved admin
   tooling to remove only the identified owned files and related account data in
   a reviewed order, then handle Auth removal. Storage objects need explicit
   handling; deleting a profile does not prove uploaded files were removed. Current
   inspected design does not cascade from Auth to profile; profile deletion cascades
   to vendors, checklist templates, custom sections/activity, legacy emergency
   assignments and dormant push subscriptions. Recheck this against production
   before executing; do not blindly add a cascade or run bulk SQL from this guide.
8. **Independent private records.** Insurance attribution has `ON DELETE SET NULL`
   and preserves private leads (including a referring-name snapshot). Support
   records have no profile FK. Neither is automatically erased with a profile;
   review their identifiers, consent, legitimate retention and any applicable
   deletion request independently. Realtors do not gain access to those records
   through account closure. Parked push tables can remain dormant; never activate
   push delivery/cron as part of cleanup. No cleanup is performed by this pass.
9. **Verify and close.** Confirm public hub unavailable, account login/bootstrap
   blocked, intended owned storage/content handled and unrelated accounts unchanged.
   Retained backups/logs require separate lifecycle handling; explain that deleting
   active rows is not deletion of every backup or public copy. We cannot remotely
   erase homeowner checklist/contact localStorage on their devices. Record only
   necessary disposition details and send a manual outcome response before closing
   the support ticket.

Owner signup notifications, when enabled, add a private delivery outbox and a
limited account email in the owner's mailbox/Resend records. Review those under
the retention policy too; they are not automatically removed by profile/Auth
deletion. Retain a minimal dedupe UUID where appropriate to prevent a recreated
profile from sending duplicate alerts; handle names/email payloads separately.
See `signup-owner-notifications.md`. Insurance/support notifications remain off.

No deletion SQL, account-deletion RPC, scheduler, email alert or consent acceptance
mechanism was added. Finalize and dry-run this runbook with disposable staging
accounts and reviewed rollback/recovery options before the first real closure.
