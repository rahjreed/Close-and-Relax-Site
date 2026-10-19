# Vendor downgrade behavior

The public/custom vendor allowance remains Free 5, Core 15, Pro 30. The fixed
Close & Relax resource is separate from this custom vendor allowance.

## Deterministic selection and retention

`get_hub_vendors(hub_profile_id)` selects only active custom records, ordered by
`sort_order ASC`, then `created_at ASC`, then `id ASC`, with nulls last. It returns
the first N for the saved database plan. Existing over-limit records, inactive
records, and paid recommendation notes remain saved for the owner. Inactive
records do not consume visible positions and are not automatically reactivated.
Re-upgrading immediately expands the eligible selection from the same records.
Reordering or activation can change the selected records but cannot increase N.

Raw vendor SELECT is owner-only, so anonymous and other-account requests cannot
retrieve overflow using alternate filters, offsets or IDs. The deliberately
public read-only RPC checks publication itself and returns only eligible records.
Its one exception is an authenticated owner previewing their own draft; another
Realtor's draft is always unavailable. Free public results also redact saved paid
recommendation notes. The owner dashboard keeps all original records.

New insertions retain the existing *saved custom record* limit, counting inactive
and preserved overflow records. A downgraded over-limit owner can edit/reorder
existing vendors but cannot add a new record until below that saved-record limit
or on an eligible upgraded plan. The UI explains this distinction. Nothing is
deleted automatically to make room. Vendor mutations lock the parent profile
before counting, serializing inserts and coordinating with billing plan updates.

## Fixed standard resource

Free/Core always receive exactly one canonical platform resource in the public
RPC, even if the former Pro owner deleted, hid, or customized its stored record.
This is a read projection using the existing verified Roger With Vivint contact,
not a new saved assignment or a rewrite of Realtor data. Its stable ID has the
`platform-standard-` prefix and must never be sent to a vendor-edit endpoint.

On Pro, the RPC uses the first active saved standard record in the same stable
order, if one exists. Removed or inactive standard records stay removed/hidden;
an upgrade does not undo the owner's earlier choice. The existing authorized
Pro restoration RPC is unchanged. Extra saved standard rows, if present in old
data, are retained privately; at most one appears publicly.

## Local implementation and rollout

Migration: `20261019034056_enforce_vendor_downgrade_visibility.sql`. It changes
the vendor mutation trigger function, adds the filtered RPC and removes only the
raw public vendor SELECT policy. Owner policies, plan limits, the protected helper
ACL, Pro restoration RPC, profile publication and unrelated features remain.
There are no data-deletion/cleanup statements or changes to vendor rows.

The matching frontend and private preview use the RPC; the renderer also caps
rows defensively and honors an authoritative empty Pro result instead of adding
a fallback resource. The dashboard shows public-allowance/private badges.

Apply only after the reviewed helper-authorization and profile-branding migrations,
and coordinate with the matching frontend release. Older public clients that read
vendors directly will receive no rows after the policy change. No migrations or
deployments were executed during local implementation. Use a separately approved
production rollout and read-only checks; do not run blanket migration pushes.
