import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CALLBACK_WINDOWS,
  validateGooseheadLead,
} from '../supabase/functions/_shared/gooseheadLead.js';
import { submitGooseheadLead } from '../src/lib/gooseheadLeads.js';

const now = new Date('2026-10-16T12:00:00Z');
const lead = {
  request_id: '00000000-0000-0000-0000-000000000001',
  profile_id: '00000000-0000-0000-0000-000000000002',
  full_name: 'Test Homeowner',
  phone: '317-555-0100',
  address: '123 Example St, Test City',
  email: 'test@example.com',
  callback_date: '2026-10-17',
  callback_window: '11am-3pm',
  callback_timezone: 'America/Indianapolis',
  contact_consent: true,
};
test('all requested callback windows validate', () => {
  assert.deepEqual(CALLBACK_WINDOWS, ['11am-3pm', '3pm-7pm', '7pm-11pm']);
  for (const callback_window of CALLBACK_WINDOWS)
    assert.equal(
      validateGooseheadLead({ ...lead, callback_window }, now).callback_window,
      callback_window,
    );
});
test('invalid contact details, past/invalid dates, missing consent, and unknown time zones are rejected', () => {
  for (const change of [
    { full_name: '' },
    { phone: '' },
    { address: '' },
    { email: 'bad' },
    { callback_date: '2026-10-01' },
    { callback_date: '2026-02-30' },
    { callback_window: 'anytime' },
    { callback_timezone: 'Not/AZone' },
    { contact_consent: false },
    { request_id: 'bad' },
  ])
    assert.throws(() => validateGooseheadLead({ ...lead, ...change }, now));
});
test('only approved lead fields survive validation; tracking is not called by lead submission', async () => {
  const validated = validateGooseheadLead(
    { ...lead, event_type: 'savings_goosehead_click', injected: 'bad' },
    now,
  );
  assert.equal(validated.event_type, undefined);
  assert.equal(validated.injected, undefined);
  const calls = [];
  const client = {
    functions: {
      invoke: async (name, options) => {
        calls.push({ name, ...options });
        return { data: { accepted: true }, error: null };
      },
    },
  };
  await submitGooseheadLead(client, validated, 'captcha-token');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'goosehead-lead');
  await assert.rejects(submitGooseheadLead(client, validated, ''));
});
