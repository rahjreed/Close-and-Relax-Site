export const CALLBACK_WINDOWS = Object.freeze(['11am-3pm', '3pm-7pm', '7pm-11pm']);

export function localToday(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type).value)
    .join('-');
}

export const INSURANCE_TYPES = Object.freeze([
  { value: 'home', label: 'Home insurance' },
  { value: 'auto', label: 'Auto insurance' },
  { value: 'home_and_auto', label: 'Home + Auto' },
]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (input, name, max) => {
  const value = typeof input[name] === 'string' ? input[name].trim().replace(/\s+/g, ' ') : '';
  if (!value || value.length > max || /[\u0000-\u001f\u007f]/.test(value))
    throw new Error(`Enter a valid ${name.replaceAll('_', ' ')}.`);
  return value;
};
const coverage = (input) => {
  // Preserve compatibility with the previously deployed home-only form.
  const insurance_type = input.insurance_type === undefined ? 'home' : input.insurance_type;
  if (!INSURANCE_TYPES.some((item) => item.value === insurance_type))
    throw new Error('Choose an insurance type.');
  return insurance_type;
};
const contact = (input) => {
  const full_name = text(input, 'full_name', 160),
    phone = text(input, 'phone', 50),
    email = text(input, 'email', 254);
  if (
    !/^[+0-9().\s-]+$/.test(phone) ||
    phone.replace(/\D/g, '').length < 7 ||
    phone.replace(/\D/g, '').length > 15
  )
    throw new Error('Enter a valid phone number.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  return { full_name, phone, email };
};
const callback = (input, now) => {
  const callback_timezone = text(input, 'callback_timezone', 100);
  let today;
  try {
    today = localToday(callback_timezone, now);
  } catch {
    throw new Error('Choose a valid callback time zone.');
  }
  const callback_date = text(input, 'callback_date', 10);
  const parsed = new Date(`${callback_date}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(callback_date) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== callback_date ||
    callback_date < today
  )
    throw new Error('Choose a current or future callback date.');
  if (!CALLBACK_WINDOWS.includes(input.callback_window))
    throw new Error('Choose one of the available callback windows.');
  return { callback_date, callback_timezone, callback_window: input.callback_window };
};

// Wizard steps and final Edge validation share the same rules.
export function validateInsuranceStep(input, step, now = new Date()) {
  if (step === 0) {
    coverage(input);
    return;
  }
  if (step === 1) {
    if (coverage(input) !== 'auto') text(input, 'address', 500);
    return;
  }
  if (step === 2) {
    contact(input);
    return;
  }
  if (step === 3) {
    callback(input, now);
    return;
  }
  throw new Error('Invalid insurance step.');
}

export function validateGooseheadLead(input, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Check your request details.');
  const insurance_type = coverage(input);
  const address = insurance_type === 'auto' ? null : text(input, 'address', 500);
  const details = contact(input),
    timing = callback(input, now);
  if (input.contact_consent !== true)
    throw new Error('Confirm that you agree to be contacted about this request.');
  const profile_id = input.profile_id == null || input.profile_id === '' ? null : input.profile_id;
  if (
    (profile_id !== null && (typeof profile_id !== 'string' || !uuid.test(profile_id))) ||
    typeof input.request_id !== 'string' ||
    !uuid.test(input.request_id)
  )
    throw new Error('This request could not be prepared. Reload the page and try again.');
  return {
    request_id: input.request_id,
    profile_id,
    insurance_type,
    address,
    ...details,
    ...timing,
    contact_consent: true,
  };
}
