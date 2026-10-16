import assert from 'node:assert/strict';
import test from 'node:test';
import { insuranceReferral, insuranceUrl, isInsurancePath } from '../src/lib/insuranceFunnel.js';
import { validateGooseheadLead, validateInsuranceStep } from '../src/lib/gooseheadLeads.js';

const now = new Date('2026-10-16T12:00:00Z');
const id = '00000000-0000-4000-8000-000000000001';
const base = {
  request_id: id,
  full_name: 'Test Person',
  phone: '317-555-0100',
  email: 'test@example.com',
  address: '123 Example St',
  callback_date: '2026-10-17',
  callback_window: '3pm-7pm',
  callback_timezone: 'America/Indianapolis',
  contact_consent: true,
};

test('dedicated insurance route supports refresh paths without claiming other routes', () => {
  for (const path of ['/insurance', '/insurance/']) assert(isInsurancePath(path));
  for (const path of ['/', '/dashboard', '/insurance-other', '/insurance/extra'])
    assert(!isInsurancePath(path));
});
test('standalone URL is clean; referral URL preserves only the profile UUID', () => {
  assert.equal(insuranceUrl(), 'https://closeandrelax.com/insurance');
  const url = insuranceUrl(id);
  assert.equal(new URL(url).searchParams.get('ref'), id);
  assert.deepEqual(insuranceReferral(new URL(url).search), { profileId: id, error: '' });
  assert.deepEqual(insuranceReferral('?utm_source=social'), { profileId: null, error: '' });
  for (const value of ['?ref=bad', '?ref=', '?ref=' + id + '&ref=' + id])
    assert(insuranceReferral(value).error);
});
test('all coverage types allow direct requests; only home coverage requires a property address', () => {
  for (const insurance_type of ['home', 'home_and_auto']) {
    const row = validateGooseheadLead({ ...base, insurance_type }, now);
    assert.equal(row.insurance_type, insurance_type);
    assert.equal(row.profile_id, null);
    assert.throws(() => validateGooseheadLead({ ...base, insurance_type, address: '' }, now));
  }
  const auto = validateGooseheadLead({ ...base, insurance_type: 'auto', address: undefined }, now);
  assert.equal(auto.address, null);
  assert.equal(auto.profile_id, null);
  assert.equal(validateGooseheadLead({ ...base, insurance_type: 'auto' }, now).address, null);
  assert.equal(validateGooseheadLead(base, now).insurance_type, 'home');
  for (const insurance_type of ['boat', null, ''])
    assert.throws(() => validateGooseheadLead({ ...base, insurance_type }, now));
});
test('optional referral is syntactically checked and never grants privileges', () => {
  const row = validateGooseheadLead(
    { ...base, profile_id: id, status: 'closed', is_admin: true, referring_realtor_name: 'Spoof' },
    now,
  );
  assert.equal(row.profile_id, id);
  assert.equal(row.status, undefined);
  assert.equal(row.is_admin, undefined);
  assert.equal(row.referring_realtor_name, undefined);
  assert.throws(() => validateGooseheadLead({ ...base, profile_id: 'bad' }, now));
});
test('wizard shares final validation for coverage, property, contact and callback steps', () => {
  for (let step = 0; step < 4; step++)
    assert.doesNotThrow(() =>
      validateInsuranceStep({ ...base, insurance_type: 'home' }, step, now),
    );
  assert.throws(() => validateInsuranceStep({ insurance_type: '' }, 0, now));
  assert.throws(() => validateInsuranceStep({ insurance_type: 'home', address: '' }, 1, now));
  assert.doesNotThrow(() => validateInsuranceStep({ insurance_type: 'auto' }, 1, now));
  assert.throws(() => validateInsuranceStep({ ...base, phone: 'bad' }, 2, now));
  assert.throws(() => validateInsuranceStep({ ...base, callback_date: '2020-01-01' }, 3, now));
  assert.throws(() => validateInsuranceStep(base, 8, now));
});
