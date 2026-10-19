# Frontend password minimum

New passwords use a shared minimum of eight characters in
`src/lib/passwordPolicy.js`. Signup, the reset/change-password handler and all
three new/confirmation password inputs use the same constant and error message.
Signup previously used only HTML minLength=6; reset already checked eight in HTML
and JavaScript. No separate dashboard password-change form exists. The Auth
metadata update used for preview history does not change a password.

New-password hint: “At least 8 characters”. Validation error: “Your password must
be at least 8 characters.” Passwords are never trimmed/transformed. Confirmation
must still match. Returned/thrown Supabase errors continue to appear in the
existing UI; successful recovery still signs out and returns to login.

Login deliberately has no new-password minimum, preserving access for existing
users whose passwords were valid under the earlier six-character requirement.
Recovery-email requests do not collect or validate a new password.

Production Supabase Auth was previously verified to have a six-character minimum.
This frontend change does not alter that setting or make eight characters a
server-side rule: direct API clients can still use the server's configured
minimum. After separate approval, raise Auth → Sign In / Providers → Email →
Minimum password length to 8 for complete frontend/backend consistency and test
signup/recovery. Existing shorter-password login should remain allowed under
Supabase's documented behavior. No database migration or Edge deployment is
required. Leaked-password protection remains parked; no plan upgrade or Auth
configuration is included in this change.
