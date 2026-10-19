# Profile branding authorization

Core (`pro` / `core`) and Pro (`premier`) retain headshots, legacy `photo_url`,
custom welcome messages, bio, website and social links. Only Pro may edit welcome
video or app initials, including the legacy `video_url` / `app_initials` columns.
Free (`partner` / `free`) cannot set or change those fields. Renderer-only aliases
`profile_image_url`, `image_url`, `welcome`, and `website` are cleared on Free;
the trigger also guards them if present in a schema, without creating columns.

`photo_url` is retained and explicitly protected, not dropped or rewritten. No
existing profile row is updated by this migration. A billing downgrade can leave
paid content stored unchanged for the owner and later re-upgrade. Empty NULL/blank
form round-trips are allowed; existing nonempty locked content cannot be edited
or removed on an ineligible plan. Browser signups still start on Free, browser
plan changes remain forbidden, and unknown plan values are rejected.

## Public read boundary

RLS cannot redact individual columns. The migration therefore removes only the
raw published-profile SELECT policy; existing owner policies remain. Anonymous
users and other Realtors cannot read retained branding directly from profiles.

`get_public_realtor_profile(hub_slug)` is the public entry point: it returns an
explicit allowlist of public contact fields and plan-eligible branding, only for
published profiles. It does not return owner metadata or arbitrary new columns.
The renderer, public loader and private preview share additional client-side
filtering. The dashboard retains its original owner profile for editing.

The intentionally public, stable, read-only `is_published_hub(uuid,text)` helper
returns only a publication/Pro-eligibility boolean. Existing public policies for
vendors, Pro checklist/custom sections, emergency assignments, and activity
insertion use it so their publication/active/plan rules continue to work without
raw public profile access. Ownership/write policies and other features remain
unchanged. Both new security-definer functions have fixed empty search paths and
explicit execution grants. Their anonymous execution is intentional and may be
reported by a generic Security Advisor function-exposure check.

## Coordinated rollout required (not performed)

Review `20261019032658_enforce_profile_branding.sql` and deploy it with the matching
frontend. Old public loaders using SELECT * cannot read published profiles after
the migration; no insecure fallback is provided. Use a coordinated release window
and test the public hub plus owner dashboard. Verify unpublished profiles remain
unavailable, Core/Pro branding is intact, and saved branding is hidden after a
downgrade and restored after re-upgrading. Do not run blanket migration pushes or
activate parked push functionality. The earlier vendor-helper ACL fix is separate.

Private image URLs are not issued by this change: the existing profile-images
bucket remains public. Previously shared image URLs are not retroactively revoked.
