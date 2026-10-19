# Leaked-password protection availability

Verified October 19, 2026 against the isolated staging project
`amopxaadnvubvveqpkvu`; production `hphcejnvxyccmwmofdqc` was not accessed.

The connected Supabase organization `khkembroocfibfktubap` is on the Free plan.
The staging Auth > Sign In / Providers > Email panel shows “Prevent use of leaked
passwords” off and states “Only available on Pro plan and above.” Current official
documentation confirms the same plan limitation:
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Therefore it was not enabled. Exact Auth setting changes: none. No toggle/save,
API flag write, plan upgrade, password minimum/complexity change, SMTP change,
provider change or redirect change was attempted. No real signup, reset email,
credential entry or password test was submitted. Security Advisor consequently
continues to report `auth_leaked_password_protection` on staging.

The existing eight-character frontend new-password rule remains unchanged. This
task does not assert any change to the Supabase server minimum. A leaked-password
setting cannot be substituted by React checks or enabled through an unsupported
API bypass on Free.

On an eligible plan, the feature uses HaveIBeenPwned's Pwned Passwords service to
reject compromised chosen passwords at signup/password change. It does not
rewrite existing stored passwords or initiate a forced password-reset campaign.
Official documentation describes existing-user sign-in with weak-password
feedback, so future activation acceptance must check actual SDK/session/error
handling for existing users as well as new signup and recovery/update flows.

Safest next action is a separate plan/billing decision before enabling anything.
Both projects share the organization, so an organization upgrade must not be
treated as a staging-only configuration change. After explicit approval and an
eligible plan, enable only this setting in staging; verify rejected compromised
passwords, accepted strong passwords, existing login behavior, password reset/
change, and unchanged surrounding Auth settings. Only then request separate
production activation approval. No upgrade or production change is authorized by
this document. Remaining Free-plan Advisor notice is documented, not “fixed” by
weakening another control.
