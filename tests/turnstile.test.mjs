import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createTurnstileLoader,
  normalizeTurnstileSiteKey,
  turnstileFailure,
} from '../src/lib/turnstile.js';

function documentMock() {
  const scripts = [];
  return {
    scripts,
    head: { appendChild: (script) => scripts.push(script) },
    getElementById: (id) => scripts.find((script) => script.id === id && !script.removed),
    createElement: () => {
      const events = new Map();
      return {
        addEventListener: (name, fn) => events.set(name, fn),
        removeEventListener: (name) => events.delete(name),
        remove() {
          this.removed = true;
        },
        fire: (name) => events.get(name)?.(),
      };
    },
  };
}
test('async/defer loader shares a promise and resolves on load without calling ready()', async () => {
  const win = {},
    doc = documentMock();
  const load = createTurnstileLoader(win, doc);
  const first = load(),
    second = load();
  assert.equal(first, second);
  assert.equal(doc.scripts.length, 1);
  assert.equal(
    doc.scripts[0].src,
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
  );
  assert.equal(doc.scripts[0].async, true);
  assert.equal(doc.scripts[0].defer, true);
  let readyCalls = 0;
  win.turnstile = {
    render() {},
    ready() {
      readyCalls++;
      // Cloudflare rejects ready() when api.js was loaded with async/defer.
      throw Object.assign(new Error('Remove async/defer before using turnstile.ready().'), {
        code: 3857,
      });
    },
  };
  doc.scripts[0].fire('load');
  assert.equal(await first, win.turnstile);
  assert.equal(await load(), win.turnstile);
  assert.equal(readyCalls, 0);
  assert(!doc.scripts[0].removed);
  assert.equal(doc.scripts.length, 1);
});

test('an already loaded API resolves without calling ready() or adding a script', async () => {
  const win = {
      turnstile: {
        render() {},
        ready() {
          assert.fail('ready() must not be called for an async/defer-loaded API');
        },
      },
    },
    doc = documentMock();
  assert.equal(await createTurnstileLoader(win, doc)(), win.turnstile);
  assert.equal(doc.scripts.length, 0);
});
test('failed script loads clear the cache and allow a fresh retry', async () => {
  const win = {},
    doc = documentMock(),
    load = createTurnstileLoader(win, doc);
  const first = load();
  doc.scripts[0].fire('error');
  await assert.rejects(first, /retry verification/);
  assert(doc.scripts[0].removed);
  const second = load();
  assert.equal(doc.scripts.length, 2);
  win.turnstile = { render() {} };
  doc.scripts[1].fire('load');
  assert.equal(await second, win.turnstile);
});
test('missing API and loader timeouts fail closed and remain retryable', async () => {
  const win = {},
    doc = documentMock(),
    load = createTurnstileLoader(win, doc, 10);
  const first = load();
  doc.scripts[0].fire('load');
  await assert.rejects(first);
  await assert.rejects(load(), /retry verification/);
  win.turnstile = {
    render() {},
    ready(fn) {
      fn();
    },
  };
  assert.equal(await load(), win.turnstile);
});
test('site keys trim safely; configuration failures retain only a safe error code', () => {
  assert.equal(normalizeTurnstileSiteKey('  public-key\n'), 'public-key');
  assert.equal(normalizeTurnstileSiteKey(undefined), '');
  for (const code of ['400020', '110100', '110200', '400070']) {
    const issue = turnstileFailure(code);
    assert.equal(issue.retryable, false);
    assert.equal(issue.code, code);
  }
  assert.equal(turnstileFailure('200500').retryable, true);
  assert.equal(turnstileFailure('untrusted message with contact data').code, '');
  assert(!turnstileFailure('untrusted message with contact data').message.includes('contact data'));
});
