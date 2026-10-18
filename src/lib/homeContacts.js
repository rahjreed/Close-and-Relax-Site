export const HOME_CONTACT_SLOTS = 3;
export const HOME_CONTACT_FIELDS = Object.freeze([
  ['name', 'Contact name', 120],
  ['service', 'Service/type', 80],
  ['phone', 'Phone number', 50],
  ['note', 'Note (optional)', 500],
]);

export function homeContactsKey(profileId) {
  if (typeof profileId !== 'string' || !profileId.trim())
    throw new Error('This hub is unavailable. Please reload before saving contacts.');
  return `closeandrelax-home-contacts-v1:${encodeURIComponent(profileId.trim())}`;
}

export function validateHomeContact(input) {
  const contact = {};
  for (const [name, label, max] of HOME_CONTACT_FIELDS) {
    const value = typeof input?.[name] === 'string' ? input[name].trim() : '';
    if ((name !== 'note' && !value) || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))
      throw new Error(`Enter ${label.toLowerCase()}${name === 'note' ? '' : ' (required)'} of up to ${max} characters.`);
    contact[name] = value;
  }
  const digits = contact.phone.replace(/\D/g, '');
  if (!/^\+?[0-9().\s-]+$/.test(contact.phone) || digits.length < 7 || digits.length > 15)
    throw new Error('Enter a phone number containing 7–15 digits.');
  return contact;
}

export function homeContactPhoneHref(phone) {
  return `tel:${String(phone).replace(/[^0-9+]/g, '')}`;
}

export function readHomeContacts(storage, key) {
  const raw = storage.getItem(key);
  if (raw === null) return Array(HOME_CONTACT_SLOTS).fill(null);
  const saved = JSON.parse(raw);
  if (saved?.version !== 1 || !Array.isArray(saved.contacts))
    throw new Error('Unsupported contact storage.');
  return Array.from({ length: HOME_CONTACT_SLOTS }, (_, index) => {
    if (!saved.contacts[index]) return null;
    return validateHomeContact(saved.contacts[index]);
  });
}

export function updateHomeContact(storage, key, index, input) {
  if (!Number.isInteger(index) || index < 0 || index >= HOME_CONTACT_SLOTS)
    throw new Error('Choose one of your three contact slots.');
  const contacts = readHomeContacts(storage, key);
  contacts[index] = input === null ? null : validateHomeContact(input);
  storage.setItem(key, JSON.stringify({ version: 1, contacts }));
  return contacts;
}
