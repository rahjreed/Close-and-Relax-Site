import React, { useId, useState } from 'react';
import {
  dueDateFromDaysRemaining,
  parseLocalChecklistDate,
  toLocalDateString,
} from '../lib/checklistProgress';

export default function ChecklistDueDateAdjustment({ title, nextDueDate, onSave, preview = false }) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('days');
  const [days, setDays] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const startEditing = () => {
    setOpen(true);
    setError('');
    setMessage('');
    setDate(nextDueDate ? toLocalDateString(nextDueDate) : toLocalDateString());
    setDays('');
  };
  const save = (event) => {
    event.preventDefault();
    try {
      const nextDate = mode === 'days' ? dueDateFromDaysRemaining(days) : date;
      if (!parseLocalChecklistDate(nextDate)) throw new Error('Choose a valid calendar date.');
      onSave(nextDate);
      setOpen(false);
      setError('');
      setMessage(
        'Next due date updated on this device. Completing the task starts its normal recurring cycle again.',
      );
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <div className="px-4 pb-4">
      <button
        type="button"
        onClick={startEditing}
        aria-expanded={open}
        aria-controls={`${inputId}-form`}
        aria-label={`Adjust next due date for ${title}`}
        className="min-h-[44px] text-xs font-semibold text-[#8a6b3d] underline underline-offset-2"
      >
        Adjust next due date
      </button>
      {open && (
        <form
          id={`${inputId}-form`}
          onSubmit={save}
          className="rounded-xl border border-[#e7dccb] bg-white p-4 mt-1 space-y-3"
          aria-label={`Adjust next due date for ${title}`}
        >
          <label htmlFor={`${inputId}-mode`} className="block text-xs font-semibold text-[#57534e]">
            Choose how to adjust
          </label>
          <select
            id={`${inputId}-mode`}
            value={mode}
            onChange={(event) => {
              setMode(event.target.value);
              setError('');
            }}
            className="w-full min-h-[44px] rounded-lg border border-[#cfc3b1] px-3 py-2 text-base text-[#292524] bg-white"
          >
            <option value="days">Days remaining</option>
            <option value="date">Exact due date</option>
          </select>
          {mode === 'days' ? (
            <label className="block text-xs text-[#57534e]">
              Days remaining from today
              <input
                required
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={days}
                onChange={(event) => setDays(event.target.value)}
                placeholder="For example, 45"
                className="block w-full min-h-[44px] rounded-lg border border-[#cfc3b1] px-3 py-2 mt-1 text-base text-[#292524]"
              />
            </label>
          ) : (
            <label className="block text-xs text-[#57534e]">
              Next due date
              <input
                required
                type="date"
                min="0001-01-01"
                max="9999-12-31"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="block w-full min-h-[44px] rounded-lg border border-[#cfc3b1] px-3 py-2 mt-1 text-base text-[#292524]"
              />
            </label>
          )}
          <p className="text-[11px] text-[#78716c] leading-relaxed">
            {preview ? 'Temporary preview change only.' : 'Saved only in this browser.'} This does not mark the task complete or change its usual
            recurrence interval. Past dates remain visible as overdue.
          </p>
          {error && (
            <p role="alert" className="text-xs text-red-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="min-h-[44px] rounded-lg bg-[#292524] text-white px-4 py-2 text-xs font-semibold"
            >
              Save due date
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError('');
              }}
              className="min-h-[44px] rounded-lg border border-[#cfc3b1] px-4 py-2 text-xs font-semibold text-[#57534e]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {message && (
        <p role="status" className="text-[11px] text-[#55704f] mt-1">
          {message}
        </p>
      )}
    </div>
  );
}
