# Realtor setup checklist

Replaces the old four-item Launch Checklist, directly below the dashboard welcome
row. Existing profile, vendor, checklist, custom-section and publish handlers are
reused. Private preview adds fresh authenticated reads, but no new tables,
migrations, Edge Functions or permission rules.
The dashboard's existing getPlanConfig supplies all entitlement differences:
partner/free = Free; pro/core = Core; premier = Pro.

Completion derives from saved profile/collection state, never unsaved editor
forms or metadata fallbacks:

1. Profile: trimmed nonempty full_name, brokerage, phone and city.
2. Branding: a saved hub slug on every plan. Core/Pro additionally need saved
   headshot_url and welcome_message. Bio/social links are optional; Pro video
   and app initials are optional. Free standard branding needs no premium fields.
3. Vendors: one saved active row owned by this profile with is_default not true.
   Defaults, inactive rows, unsaved rows and other owners' rows do not count.
4. Resources: Free/Core use the existing included standard resources with no paid
   requirement. Pro needs at least one saved active owned checklist item OR
   custom section. Hidden/inactive or other-account content cannot complete it.
5. Preview: the private saved hub successfully rendered and its completion was
   saved in Auth metadata. This works before publication. Publication itself
   never completes this step.
6. Publish: saved is_published is exactly true. Checklist completion is advisory
   and never blocks the existing publication handler.

## Private dashboard preview

Both preview buttons open HubPreviewDialog, a full-screen dashboard dialog.
App requires the session user ID to match the saved dashboard profile. The
loader calls auth.getUser(), takes the ID from that verified user, then queries
the profile and active associated records by that ID. It never uses a URL ID or
slug as authority. It verifies the user again after loading, rejects foreign
rows, and derives plan capabilities from the saved profile. Free/Core cannot
see preserved Pro-only content. Account changes/logout remove the dialog;
in-flight UI updates are canceled on unmount. Escape, focus trapping and focus
restoration keep the dialog usable from a keyboard.

The public subdomain query still requires is_published=true. Existing owner RLS
already permits authenticated own-draft reads and blocks anonymous/other-owner
draft reads. No service role or public preview endpoint is introduced.

PublicRealtorHub receives preview=true only inside the dialog. That mode skips
hub activity/session/device storage, PWA effects, manifest/apple-touch metadata,
install prompts and public reveal observers. Checklist state is memory-only.
My Home Contacts uses an empty demo component with no storage effect. Savings
cards retain their display/configuration but replace conversion anchors with
disabled buttons. Share, install and contact downloads are disabled; outgoing
anchor clicks are prevented. Normal public rendering defaults to preview=false
and retains its analytics, storage, recurrence and PWA behavior.

## Account-level preview history

The old browser-only preview key is no longer read or written, and is not
migrated: it recorded an open request rather than a rendered preview.
Dashboard entry calls auth.getUser() for fresh account metadata, independent of
stale session metadata. After the hub commits successfully, a deferred callback
uses auth.updateUser({ data: { closeandrelax_hub_previewed_at: ISO_TIMESTAMP } }).
The current user is verified before writing. Existing valid history is retained;
only that metadata key is updated, preserving unrelated metadata. A new device
reads the same stored value after authentication.

This user-editable timestamp is onboarding history only, not an authorization,
subscription, publication or audit claim. It never grants access and never
blocks publication. Failed loading/rendering writes nothing. Failed metadata
save leaves the preview step incomplete, shows a retry action, and does not
prevent publishing. No production Auth metadata is updated during local tests.

Incomplete accounts always see the six steps. At 100%, the checklist collapses
to “Your hub is ready 🎉” with View checklist / Hide checklist controls. Editing
or removing required saved data expands incomplete steps again. Account changes
reset the expanded state and isolate preview history.
