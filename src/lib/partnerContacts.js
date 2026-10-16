// Existing Close & Relax/Vivint business contact, shared by both audiences.
export const VIVINT_CONTACT_PHONE = '4632813454';

export function getVivintTextHref(audience = 'homeowner') {
  const message =
    audience === 'realtor'
      ? "Hi Roger, I'm a Close & Relax realtor and I'd like to claim the Vivint Realtor Benefit."
      : "Hi Roger, I'd like to explore Vivint home security through Close & Relax.";
  return `sms:${VIVINT_CONTACT_PHONE}?body=${encodeURIComponent(message)}`;
}
