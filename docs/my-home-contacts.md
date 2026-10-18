# My Home Contacts

The public homeowner hub now has three personal device/browser contact slots,
above Preferred Vendors, on every plan. Realtors have no editor or server API
for these contacts. Name, service/type and phone are required; a note is optional.

Storage is localStorage key `closeandrelax-home-contacts-v1:${encodeURIComponent(profile.id)}`
with `{ version: 1, contacts: [contactOrNull, contactOrNull, contactOrNull] }`.
Each contact contains only `name`, `service`, `phone`, `note`. There is no upload,
analytics event, account or cross-device sync. Browser origins also isolate data;
different subdomains/browsers/devices do not share storage. Clearing browser data
removes the contacts. Do not move to a different key if a profile's display name
or slug changes: the stable profile UUID is the identity.

The component remounts when the profile ID changes and listens for same-origin
storage events. Writes reread other slots to preserve changes from another tab.
Blocked/full storage keeps the draft and old cards; corrupt or unknown-version
data is not silently overwritten. The rest of the hub remains usable.

## Retired emergency service implementation

Removed both old public/editor components and their Supabase helper. App no
longer queries the emergency tables. The historical creation migration remains
unchanged. No Realtor assignments are imported into personal contacts.

Read-only production inspection found six categories, one assignment, one
validation function/trigger and six RLS policies. No external database dependency
was observed beyond the emergency tables themselves. Existing data is untouched.

`20261018151224_retire_emergency_services.sql` is optional future cleanup, NOT
required for this release. It drops the two emergency tables (and their own
policies/grants/trigger) and `validate_emergency_service_assignment()` using
RESTRICT, never CASCADE. A transaction/lock and explicit guard refuse cleanup
while any assignment exists. The current production row therefore blocks it.

Before any separate cleanup approval: deploy the frontend, retire old clients,
export/review all assignments and decide retention. Separately authorize any
data removal; this migration will not do it for you. Recheck dependencies then
approve/apply only this cleanup. It touches no vendor enforcement, profiles,
auth, savings/insurance, checklist or tracking objects. No production changes
are made as part of preparing this feature.
