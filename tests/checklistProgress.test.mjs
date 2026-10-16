import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addMonthsClamped,
  adjustChecklistDueDate,
  dueDateFromDaysRemaining,
  getAdjustedChecklistDueDate,
  getChecklistCompletedAt,
  getChecklistDueDate,
  normalizeStoredChecklistProgress,
  parseLocalChecklistDate,
  toLocalDateString,
  toggleChecklistCompletion,
} from '../src/lib/checklistProgress.js';

process.env.TZ = 'America/Indianapolis';
const items = [
  { id: 'filter', recurrenceMonths: 3 },
  { id: 'monthly', recurrenceMonths: 1 },
  { id: 'once', recurrenceMonths: null },
];
const now = new Date(2026, 9, 15, 12);

test('legacy completion timestamp maps and checked-ID arrays migrate without losing valid progress', () => {
  const completedAt = new Date(2026, 9, 1, 10).toISOString();
  assert.deepEqual(
    normalizeStoredChecklistProgress(
      { filter: completedAt, once: '2020-01-01T00:00:00Z', removed: completedAt },
      items,
      now,
    ),
    {
      filter: completedAt,
      once: '2020-01-01T00:00:00.000Z',
    },
  );
  assert.deepEqual(normalizeStoredChecklistProgress(['filter', 'once', 'removed'], items, now), {
    filter: now.toISOString(),
    once: now.toISOString(),
  });
});

test('normal recurrence still uses calendar months, clamps month ends, and resets exactly when due', () => {
  assert.equal(toLocalDateString(addMonthsClamped(new Date(2026, 0, 31, 10), 1)), '2026-02-28');
  assert.equal(toLocalDateString(addMonthsClamped(new Date(2024, 0, 31, 10), 1)), '2024-02-29');
  const complete = new Date(2026, 6, 15, 12).toISOString();
  assert.equal(
    getChecklistCompletedAt(
      normalizeStoredChecklistProgress({ filter: complete }, items, new Date(now.getTime() - 1))
        .filter,
    ),
    complete,
  );
  assert.deepEqual(normalizeStoredChecklistProgress({ filter: complete }, items, now), {});
});

test('days remaining is based on the local calendar today; zero means today', () => {
  assert.equal(dueDateFromDaysRemaining('45', now), '2026-11-29');
  assert.equal(dueDateFromDaysRemaining('0', now), '2026-10-15');
  for (const invalid of ['', '-1', '1.5', 'NaN', '1e2', '9007199254740992']) {
    assert.throws(() => dueDateFromDaysRemaining(invalid, now));
  }
});

test('exact dates are strict local dates without UTC shifts, including across DST', () => {
  for (const zone of ['America/Indianapolis', 'Pacific/Auckland', 'Pacific/Honolulu']) {
    process.env.TZ = zone;
    assert.equal(toLocalDateString(parseLocalChecklistDate('2026-11-29')), '2026-11-29');
    assert.equal(dueDateFromDaysRemaining('2', new Date(2026, 2, 7, 20)), '2026-03-09');
    assert.equal(dueDateFromDaysRemaining('2', new Date(2026, 9, 31, 20)), '2026-11-02');
  }
  process.env.TZ = 'America/Indianapolis';
  assert(parseLocalChecklistDate('2024-02-29'));
  for (const invalid of [
    '2026-02-29',
    '2026-02-30',
    '2026-13-01',
    '2026-00-01',
    '0000-01-01',
    '2026-1-01',
    '2026-11-29T00:00:00Z',
  ]) {
    assert.equal(parseLocalChecklistDate(invalid), null);
  }
});

test('a mid-cycle adjustment uses the same item map and survives serialization without inventing a completion', () => {
  const adjusted = adjustChecklistDueDate({}, items, 'filter', '2026-11-29', now);
  assert.deepEqual(adjusted, { filter: { completedAt: null, nextDueDate: '2026-11-29' } });
  const restored = normalizeStoredChecklistProgress(
    JSON.parse(JSON.stringify(adjusted)),
    items,
    now,
  );
  assert.deepEqual(restored, adjusted);
  assert.equal(getChecklistCompletedAt(restored.filter), '');
  assert.equal(toLocalDateString(getChecklistDueDate(restored.filter, 3)), '2026-11-29');
  assert.equal(items[0].recurrenceMonths, 3);
});

test('an adjustment preserves an existing checkmark until the new due date, then automatically resets it', () => {
  const original = { filter: new Date(2026, 9, 1, 12).toISOString() };
  const adjusted = adjustChecklistDueDate(original, items, 'filter', '2026-11-29', now);
  assert.equal(getChecklistCompletedAt(adjusted.filter), original.filter);
  const reset = normalizeStoredChecklistProgress(adjusted, items, new Date(2026, 10, 29));
  assert.equal(getChecklistCompletedAt(reset.filter), '');
  assert.equal(reset.filter.nextDueDate, '2026-11-29');
});

test('today and overdue exact dates stay visible without counting as complete', () => {
  const original = { filter: new Date(2026, 9, 1, 12).toISOString() };
  for (const date of ['2026-10-15', '2026-10-01']) {
    const adjusted = adjustChecklistDueDate(original, items, 'filter', date, now);
    assert.equal(getChecklistCompletedAt(adjusted.filter), '');
    assert.equal(adjusted.filter.nextDueDate, date);
  }
});

test('completion consumes the override and starts the full original recurrence from completion', () => {
  const adjusted = adjustChecklistDueDate({}, items, 'filter', '2026-11-29', now);
  const completed = toggleChecklistCompletion(adjusted, items, 'filter', now);
  assert.deepEqual(completed, { filter: now.toISOString() });
  assert.equal(getAdjustedChecklistDueDate(completed.filter), null);
  assert.equal(toLocalDateString(getChecklistDueDate(completed.filter, 3)), '2027-01-15');
  assert.deepEqual(
    normalizeStoredChecklistProgress(completed, items, new Date(2027, 0, 15, 12)),
    {},
  );
});

test('unchecking preserves an explicit adjustment; checking again consumes it', () => {
  const adjusted = adjustChecklistDueDate(
    { filter: now.toISOString() },
    items,
    'filter',
    '2026-11-29',
    now,
  );
  const unchecked = toggleChecklistCompletion(adjusted, items, 'filter', now);
  assert.equal(unchecked.filter.completedAt, null);
  assert.equal(unchecked.filter.nextDueDate, '2026-11-29');
  const rechecked = toggleChecklistCompletion(unchecked, items, 'filter', now);
  assert.equal(rechecked.filter, now.toISOString());
});

test('non-recurring items cannot be adjusted; malformed and removed entries are safely ignored', () => {
  assert.throws(() => adjustChecklistDueDate({}, items, 'once', '2026-11-29', now));
  assert.throws(() => adjustChecklistDueDate({}, items, 'filter', '2026-02-30', now));
  assert.deepEqual(
    normalizeStoredChecklistProgress(
      { filter: { nextDueDate: 'bad' }, missing: now.toISOString() },
      items,
      now,
    ),
    {},
  );
  const state = { once: { completedAt: now.toISOString(), nextDueDate: '2026-11-29' } };
  assert.deepEqual(normalizeStoredChecklistProgress(state, items, now), {
    once: now.toISOString(),
  });
});
