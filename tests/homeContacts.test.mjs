import assert from 'node:assert/strict';
import test from 'node:test';
import {
  homeContactsKey, readHomeContacts, updateHomeContact,
  validateHomeContact, homeContactPhoneHref,
} from '../src/lib/homeContacts.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
const person = (name = 'Trusted person') => ({ name, service: 'Handyman', phone: '(317) 555-0100', note: 'Fixed our basement door — great work' });

test('all three contacts survive serialization/refresh, edit independently, and can be removed', () => {
  const storage = memoryStorage(), key = homeContactsKey('hub-a');
  assert.deepEqual(readHomeContacts(storage, key), [null, null, null]);
  for (let i = 0; i < 3; i++) updateHomeContact(storage, key, i, person(`Person ${i + 1}`));
  assert.deepEqual(readHomeContacts(storage, key).map((c) => c.name), ['Person 1', 'Person 2', 'Person 3']);
  updateHomeContact(storage, key, 1, { ...person('Updated'), note: '' });
  assert.deepEqual(readHomeContacts(storage, key).map((c) => c.name), ['Person 1', 'Updated', 'Person 3']);
  assert.equal(readHomeContacts(storage, key)[1].note, '');
  for (let i = 0; i < 3; i++) updateHomeContact(storage, key, i, null);
  assert.deepEqual(readHomeContacts(storage, key), [null, null, null]);
});

test('different hub IDs never share contacts; missing IDs cannot use a common fallback', () => {
  const storage = memoryStorage(), a = homeContactsKey('hub-a'), b = homeContactsKey('hub-b');
  assert.notEqual(a, b);
  assert.equal(a, 'closeandrelax-home-contacts-v1:hub-a');
  updateHomeContact(storage, a, 0, person());
  assert.deepEqual(readHomeContacts(storage, b), [null, null, null]);
  updateHomeContact(storage, b, 2, person('Other hub'));
  assert.equal(readHomeContacts(storage, a)[0].name, 'Trusted person');
  for (const value of [null, undefined, '', ' ']) assert.throws(() => homeContactsKey(value));
});

test('updates preserve other slots last written by another tab and reject a fourth slot', () => {
  const storage = memoryStorage(), key = homeContactsKey('hub');
  updateHomeContact(storage, key, 2, person('Another tab'));
  updateHomeContact(storage, key, 0, person());
  assert.equal(readHomeContacts(storage, key)[2].name, 'Another tab');
  for (const index of [-1, 3, 1.5, '0']) assert.throws(() => updateHomeContact(storage, key, index, person()));
});

test('required fields and phone are validated; optional notes and safe call links work', () => {
  for (const change of [{ name: '' }, { service: '' }, { phone: '' }, { phone: 'javascript:alert(1)' }, { phone: '123' }, { phone: '1'.repeat(16) }, { note: 'x'.repeat(501) }])
    assert.throws(() => validateHomeContact({ ...person(), ...change }));
  const contact = validateHomeContact({ ...person('  Pat  '), phone: '+1 (317) 555-0100', note: '' });
  assert.equal(contact.name, 'Pat');
  assert.equal(homeContactPhoneHref(contact.phone), 'tel:+13175550100');
});

test('only the four private contact fields are stored and loaded slots are capped at three', () => {
  const storage = memoryStorage(), key = homeContactsKey('hub');
  updateHomeContact(storage, key, 0, { ...person(), profile_id: 'ignored', analytics: 'ignored', website: 'ignored' });
  assert.deepEqual(Object.keys(readHomeContacts(storage, key)[0]), ['name', 'service', 'phone', 'note']);
  storage.setItem(key, JSON.stringify({ version: 1, contacts: Array(8).fill(person()) }));
  assert.equal(readHomeContacts(storage, key).length, 3);
});

test('blocked/full storage and corrupt records fail without overwriting saved data', () => {
  const storage = memoryStorage(), key = homeContactsKey('hub');
  updateHomeContact(storage, key, 0, person());
  const saved = storage.getItem(key);
  assert.throws(() => updateHomeContact({ ...storage, setItem() { throw new Error('Quota'); } }, key, 0, null));
  assert.equal(storage.getItem(key), saved);
  assert.throws(() => readHomeContacts({ getItem() { throw new Error('Blocked'); } }, key));
  for (const raw of ['bad json', '{"version":2,"contacts":[]}', '{"version":1,"contacts":[{"phone":"bad"}]}']) {
    storage.setItem(key, raw);
    assert.throws(() => updateHomeContact(storage, key, 0, person()));
    assert.equal(storage.getItem(key), raw);
  }
});
