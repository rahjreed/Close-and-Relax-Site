export const PROFILE_SETUP_ERROR = 'We could not finish loading your profile. Your account is still signed in. Retry setup to continue.';

// One in-flight request per account. Discard results after account changes,
// sign-out, cancellation, and timeout; never fall back to browser INSERT/upsert.
export function createProfileBootstrap(client, onState, timeoutMs = 15000) {
  let generation = 0, active;
  const cancel = () => {
    generation++;
    active?.controller.abort();
    active?.finish();
    active = undefined;
  };
  return {
    cancel,
    load(userId) {
      if (userId && active?.userId === userId) return active.promise;
      cancel();
      if (!userId) {
        onState({ profile: null, status: 'idle', error: '' });
        return Promise.resolve(null);
      }
      const current = generation, controller = new AbortController();
      let finish, timer;
      const deadline = new Promise((_, reject) => {
        finish = () => { clearTimeout(timer); reject(new Error('Cancelled')); };
        timer = setTimeout(() => { controller.abort(); reject(new Error('Timed out')); }, timeoutMs);
      });
      onState({ profile: null, status: 'loading', error: '' });
      const request = Promise.resolve().then(() => client.rpc('bootstrap_own_profile').abortSignal(controller.signal));
      const promise = Promise.race([request, deadline]).then(({ data, error }) => {
        if (error || !data || Array.isArray(data) || data.id !== userId) throw new Error('Profile unavailable');
        if (current !== generation) return null;
        onState({ profile: data, status: 'ready', error: '' });
        return data;
      }).catch(() => {
        if (current === generation) onState({ profile: null, status: 'error', error: PROFILE_SETUP_ERROR });
        return null;
      }).finally(() => {
        clearTimeout(timer);
        if (current === generation) active = undefined;
      });
      active = { userId, promise, controller, finish };
      return promise;
    },
  };
}
