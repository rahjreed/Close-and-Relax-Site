// Existing unadjusted entries remain ISO completion timestamps. Only adjusted
// items use { completedAt: string | null, nextDueDate: 'YYYY-MM-DD' }.
export const addMonthsClamped = (dateValue, months) => {
  const source = new Date(dateValue);
  if (!months || Number.isNaN(source.getTime())) return null;

  const result = new Date(source);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDayOfTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDayOfTargetMonth));
  return result;
};

export const toLocalDateString = (value = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const parseLocalChecklistDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Date-only strings must be interpreted locally, never as UTC midnight.
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return toLocalDateString(date) === value ? date : null;
};

export const dueDateFromDaysRemaining = (value, now = new Date()) => {
  const input = String(value).trim();
  if (!/^\d+$/.test(input) || !Number.isSafeInteger(Number(input))) {
    throw new Error('Enter a whole number of days, starting from 0.');
  }
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + Number(input));
  const result = toLocalDateString(date);
  if (!parseLocalChecklistDate(result)) throw new Error('Choose a smaller number of days.');
  return result;
};

export const getChecklistCompletedAt = (value) => {
  const completedAt = typeof value === 'string' ? value : value?.completedAt;
  if (typeof completedAt !== 'string') return '';
  const date = new Date(completedAt);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

export const getAdjustedChecklistDueDate = (value) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? parseLocalChecklistDate(value.nextDueDate)
    : null;

export const getChecklistDueDate = (value, recurrenceMonths) => {
  if (!recurrenceMonths) return null;
  return (
    getAdjustedChecklistDueDate(value) ||
    (getChecklistCompletedAt(value)
      ? addMonthsClamped(getChecklistCompletedAt(value), recurrenceMonths)
      : null)
  );
};

export const normalizeStoredChecklistProgress = (savedValue, items, now = new Date()) => {
  const validItems = new Map(items.map((item) => [String(item.id), item]));
  const normalized = {};
  // Preserve the original checked-ID array migration and its recurrence clock.
  if (Array.isArray(savedValue)) {
    savedValue.map(String).forEach((id) => {
      if (validItems.has(id)) normalized[id] = now.toISOString();
    });
    return normalized;
  }
  if (!savedValue || typeof savedValue !== 'object') return normalized;
  Object.entries(savedValue).forEach(([id, value]) => {
    const item = validItems.get(id);
    if (!item) return;
    let completedAt = getChecklistCompletedAt(value);
    const adjustedDueAt = item.recurrenceMonths ? getAdjustedChecklistDueDate(value) : null;
    if (adjustedDueAt) {
      // Keep the date visible when overdue, but automatically uncheck the task.
      if (adjustedDueAt <= now) completedAt = '';
      normalized[id] = {
        completedAt: completedAt || null,
        nextDueDate: toLocalDateString(adjustedDueAt),
      };
      return;
    }
    if (!completedAt) return;
    const dueAt = item.recurrenceMonths
      ? addMonthsClamped(completedAt, item.recurrenceMonths)
      : null;
    if (dueAt && dueAt <= now) return;
    normalized[id] = completedAt;
  });
  return normalized;
};

export const adjustChecklistDueDate = (progress, items, itemId, dateString, now = new Date()) => {
  const id = String(itemId);
  const item = items.find((entry) => String(entry.id) === id);
  if (!item?.recurrenceMonths)
    throw new Error('Only recurring checklist items can have an adjusted due date.');
  if (!parseLocalChecklistDate(dateString)) throw new Error('Choose a valid calendar date.');
  return normalizeStoredChecklistProgress(
    {
      ...progress,
      [id]: { completedAt: getChecklistCompletedAt(progress[id]) || null, nextDueDate: dateString },
    },
    items,
    now,
  );
};

export const toggleChecklistCompletion = (progress, items, itemId, now = new Date()) => {
  const id = String(itemId);
  if (!items.some((item) => String(item.id) === id)) return progress;
  const next = normalizeStoredChecklistProgress(progress, items, now);
  if (getChecklistCompletedAt(next[id])) {
    const adjustedDue = getAdjustedChecklistDueDate(next[id]);
    if (adjustedDue) next[id] = { completedAt: null, nextDueDate: toLocalDateString(adjustedDue) };
    else delete next[id];
  } else {
    // Completing a task consumes its one-cycle adjustment. The original
    // Realtor-configured interval is used again from this completion timestamp.
    next[id] = now.toISOString();
  }
  return next;
};
