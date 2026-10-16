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

export function validateGooseheadLead(input, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Check your request details.');
  }
  const text = (name, max) => {
    const value = typeof input[name] === 'string' ? input[name].trim().replace(/\s+/g, ' ') : '';
    if (!value || value.length > max || /[\u0000-\u001f\u007f]/.test(value))
      throw new Error(`Enter a valid ${name.replaceAll('_', ' ')}.`);
    return value;
  };
  const full_name = text('full_name', 160),
    address = text('address', 500),
    phone = text('phone', 50),
    email = text('email', 254);
  if (
    !/^[+0-9().\s-]+$/.test(phone) ||
    phone.replace(/\D/g, '').length < 7 ||
    phone.replace(/\D/g, '').length > 15
  )
    throw new Error('Enter a valid phone number.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  const callback_timezone = text('callback_timezone', 100);
  let today;
  try {
    today = localToday(callback_timezone, now);
  } catch {
    throw new Error('Choose a valid callback time zone.');
  }
  const callback_date = text('callback_date', 10);
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
  if (input.contact_consent !== true)
    throw new Error('Confirm that you agree to be contacted about this request.');
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      input.profile_id || '',
    ) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.request_id || '')
  )
    throw new Error('This request could not be prepared. Reload the page and try again.');
  return {
    request_id: input.request_id,
    profile_id: input.profile_id,
    full_name,
    phone,
    address,
    email,
    callback_date,
    callback_window: input.callback_window,
    callback_timezone,
    contact_consent: true,
  };
}
