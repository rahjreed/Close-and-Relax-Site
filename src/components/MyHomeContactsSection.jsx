import React, { useEffect, useId, useState } from 'react';
import { Phone, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  HOME_CONTACT_SLOTS, HOME_CONTACT_FIELDS, homeContactsKey,
  readHomeContacts, updateHomeContact, homeContactPhoneHref,
} from '../lib/homeContacts';

const EMPTY = { name: '', service: '', phone: '', note: '' };
const buttonClass = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold';

// Remount on a hub change, including when React reuses the surrounding public page.
export default function MyHomeContactsSection({ profileId, preview = false }) {
  if (preview) return <ContactDemo />;
  return <ContactsForHub key={profileId || 'unavailable'} profileId={profileId} />;
}

function ContactDemo() {
  const titleId = useId();
  return (
    <section className="mb-12" aria-labelledby={titleId}>
      <h2 id={titleId} className="hub-font-serif text-2xl font-medium text-[#1c1917] sm:text-3xl">My Home Contacts</h2>
      <p className="mt-2 mb-6 text-xs leading-relaxed text-[#57534e]">Homeowners get three personal contact slots, saved only on their own device. Editing is disabled in this preview.</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: HOME_CONTACT_SLOTS }, (_, index) => (
          <article key={index} className="min-w-0 rounded-2xl border border-[#dcd1be] bg-white p-5">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#9c7844]">Contact {index + 1} of 3</p>
            <p className="text-sm leading-relaxed text-[#57534e]">Save someone you trust for home-related help.</p>
            <button disabled type="button" className={`${buttonClass} mt-4 border border-[#dcd1be] text-[#292524] opacity-50`}><Plus className="h-4 w-4" aria-hidden="true" />Add contact</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ContactsForHub({ profileId }) {
  const titleId = useId();
  const [contacts, setContacts] = useState(Array(HOME_CONTACT_SLOTS).fill(null));
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [formError, setFormError] = useState('');
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(EMPTY);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let key;
    const load = () => {
      try {
        key = homeContactsKey(profileId);
        setContacts(readHomeContacts(window.localStorage, key));
        setReady(true);
        setStorageError('');
      } catch {
        setReady(false);
        setStorageError('Your saved contacts could not be loaded. Check that browser storage is available, then retry.');
      }
    };
    load();
    const sync = (event) => {
      if (event.key === key || event.key === null) load();
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [profileId, attempt]);

  const beginEdit = (index) => {
    setEditing(index);
    setDraft(contacts[index] || EMPTY);
    setFormError('');
  };
  const persist = (index, value) => {
    try {
      setContacts(updateHomeContact(window.localStorage, homeContactsKey(profileId), index, value));
      setEditing(null);
      setDraft(EMPTY);
      setFormError('');
      setStorageError('');
    } catch (error) {
      // Keep the prior cards and current draft when validation/storage fails.
      setFormError(error.message?.startsWith('Enter ') ? error.message : 'Could not save this change on your device. Check browser storage and try again.');
    }
  };

  return (
    <section className="mb-12" aria-labelledby={titleId}>
      <div className="mb-6 text-center lg:text-left">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.25em] text-[#9c7844]">Your personal home notebook</span>
        <h2 id={titleId} className="hub-font-serif text-2xl font-medium tracking-tight text-[#1c1917] sm:text-3xl">My Home Contacts</h2>
        <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-[#57534e] lg:mx-0">
          Three spots for people you trust. Saved only in this browser for this hub—not shared with your Realtor or Close &amp; Relax. Clearing browser data removes them; they don’t sync to other devices.
        </p>
      </div>
      {storageError && (
        <div role="alert" className="mb-4 rounded-xl border border-[#dcd1be] bg-[#faf8f5] p-3 text-xs text-[#57534e]">
          <p>{storageError}</p>
          <button type="button" className={`${buttonClass} underline`} onClick={() => setAttempt((value) => value + 1)}>Retry storage</button>
        </div>
      )}
      {formError && <p role="alert" className="mb-4 text-sm text-red-700">{formError}</p>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {contacts.map((contact, index) => (
          <article key={index} aria-label={`Home contact ${index + 1}`} className="min-w-0 rounded-2xl border border-[#dcd1be] bg-white p-5">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#9c7844]">Contact {index + 1} of 3</p>
            {editing === index ? (
              <form aria-label={`Edit home contact ${index + 1}`} onSubmit={(event) => { event.preventDefault(); persist(index, draft); }} className="space-y-3">
                {HOME_CONTACT_FIELDS.map(([field, label, max]) => (
                  <label key={field} className="block text-xs font-medium text-[#57534e]">
                    {label}
                    {field === 'note' ? (
                      <textarea rows={3} maxLength={max} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })}
                        placeholder="Fixed our basement door — great work"
                        className="mt-1 block w-full rounded-xl border border-[#dcd1be] px-3 py-2 text-base" />
                    ) : (
                      <input required autoFocus={field === 'name'} type={field === 'phone' ? 'tel' : 'text'} autoComplete="off" maxLength={max}
                        placeholder={field === 'service' ? 'Plumber, Handyman, HVAC…' : undefined}
                        value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                        className="mt-1 block min-h-[44px] w-full rounded-xl border border-[#dcd1be] px-3 py-2 text-base" />
                    )}
                  </label>
                ))}
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={!ready} className={`${buttonClass} bg-[#292524] text-white disabled:opacity-50`}>Save contact</button>
                  <button type="button" className={`${buttonClass} text-[#57534e]`} onClick={() => { setEditing(null); setDraft(EMPTY); setFormError(''); }}>Cancel</button>
                </div>
              </form>
            ) : contact ? (
              <>
                <h3 className="break-words text-base font-semibold text-[#292524]">{contact.name}</h3>
                <p className="mt-1 break-words text-xs font-medium text-[#8a6b3d]">{contact.service}</p>
                {contact.note && <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-relaxed text-[#57534e]">{contact.note}</p>}
                <p className="mt-3 break-words text-xs text-[#57534e]">{contact.phone}</p>
                <div className="mt-4 flex flex-wrap gap-1">
                  <a href={homeContactPhoneHref(contact.phone)} aria-label={`Call ${contact.name}`} className={`${buttonClass} bg-[#292524] text-white`}><Phone className="h-3.5 w-3.5" aria-hidden="true" />Call</a>
                  <button type="button" disabled={!ready} className={`${buttonClass} text-[#57534e]`} onClick={() => beginEdit(index)}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit</button>
                  <button type="button" disabled={!ready} className={`${buttonClass} text-[#57534e]`} onClick={() => persist(index, null)}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Remove</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-[#57534e]">Save someone you trust for home-related help.</p>
                <button type="button" disabled={!ready} className={`${buttonClass} mt-4 border border-[#dcd1be] text-[#292524] disabled:opacity-50`} onClick={() => beginEdit(index)}><Plus className="h-4 w-4" aria-hidden="true" />Add contact</button>
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
