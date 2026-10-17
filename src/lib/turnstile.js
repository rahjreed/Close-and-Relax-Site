const SCRIPT_ID = 'close-relax-turnstile';
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

// One ready promise per browser document, shared across concurrent/StrictMode mounts.
// Failed loads are removed and can be retried without a page reload.
export function createTurnstileLoader(win, doc, timeoutMs = 15000) {
  let pending;
  return function load() {
    if (pending) return pending;
    pending = new Promise((resolve, reject) => {
      let script = doc.getElementById(SCRIPT_ID);
      let finished = false;
      const finish = (api, failure) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        script?.removeEventListener('load', ready);
        script?.removeEventListener('error', failed);
        if (failure) {
          script?.remove();
          reject(new Error('Verification could not load. Please retry verification.'));
        } else resolve(api);
      };
      const ready = () => {
        const api = win.turnstile;
        if (!api || typeof api.render !== 'function') {
          finish(null, true);
          return;
        }
        try {
          if (typeof api.ready === 'function') api.ready(() => finish(api, false));
          else finish(api, false);
        } catch {
          finish(null, true);
        }
      };
      const failed = () => finish(null, true);
      const timeout = setTimeout(failed, timeoutMs);
      if (win.turnstile?.render) {
        ready();
        return;
      }
      if (!script) {
        script = doc.createElement('script');
        script.id = SCRIPT_ID;
        script.src = SCRIPT_URL;
        script.async = true;
        script.defer = true;
        script.addEventListener('load', ready);
        script.addEventListener('error', failed);
        doc.head.appendChild(script);
      } else {
        script.addEventListener('load', ready);
        script.addEventListener('error', failed);
      }
    }).catch((error) => {
      pending = undefined;
      throw error;
    });
    return pending;
  };
}
let load;
export function loadTurnstile() {
  if (!load) load = createTurnstileLoader(window, document);
  return load();
}
export function normalizeTurnstileSiteKey(value) {
  return typeof value === 'string' ? value.trim() : '';
}
export function turnstileFailure(value) {
  const code = /^\d{6}$/.test(String(value)) ? String(value) : '';
  const configuration = ['110100', '110110', '110200', '400020', '400021', '400070'].includes(code);
  return {
    code,
    retryable: !configuration,
    message: configuration
      ? 'Verification is unavailable due to a site configuration problem. Please try again later.'
      : 'Verification could not finish. Please retry verification.',
  };
}
