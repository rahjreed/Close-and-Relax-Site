# Realtor Account & Settings

Staff processing of closure requests is documented in
[launch-legal-and-support.md](launch-legal-and-support.md). The new legal pages
are informational launch drafts; they do not implement deletion or billing.

The dashboard header opens Account & Settings on mobile and desktop. Public
Realtor contact information is separated from the Auth login email. Editing the
public profile never changes Auth email; there is no login-email-change control.
Password recovery uses the existing reset-email dialog, prefilled from Auth email
rather than the public profile. No second password-change system is introduced.

Plan & subscription displays current access and preferred-vendor allowance, not
an inferred charge or subscription status. Online billing is explicitly unavailable;
questions route to Support and do not change the plan. Existing entitlements,
pricing, database plan values and server protections remain unchanged.

Hub visibility is managed by one existing dashboard publication button. Settings
and the setup checklist navigate/focus that control instead of issuing additional
publication writes. Preview remains private and publishing does not require prior
preview completion. Setup still has six steps in the original order, derives
progress from saved data, shows the next incomplete step, handles loading and
collapses when complete. Free/Core/Pro completion rules are unchanged.

Logout checks both returned and thrown Auth errors before clearing app state or
announcing success. A visible retry message says logout could not be confirmed,
including when the Auth SDK clears its local session before returning an error;
password-reset success followed by logout failure is also reported accurately.

Account closure / deletion opens the existing private Support Inbox form with a
prefilled request, name and login email. These values stay in component memory
until the user explicitly sends the normal CAPTCHA-protected support form. Opening
or sending a request deletes nothing and does not unpublish the hub. Staff must
verify ownership through an authenticated/manual process before destructive action;
a support message's claimed email alone is not ownership proof. Explain timing,
retention and the scope of removal before processing a request. No automatic
account-deletion endpoint, schema change or new support destination is added.

The temporary hello@callistadigital.com fallback still appears only after a failed
Support Inbox submission. Existing support migration/function/secrets must still
be released separately before production can receive messages. No Stripe,
production Auth setting, migration application or deployment is included here.
