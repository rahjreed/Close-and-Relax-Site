import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { hubOrigin, validateEndpoint, validatePreferences, failureDisposition, notificationBody } from '../supabase/functions/_shared/homeownerPush.js';
import { encryptSubscription, decryptSubscription, hash } from '../supabase/functions/_shared/pushCrypto.js';
import { createManageHandler, createDispatchHandler } from '../supabase/functions/_shared/homeownerPushHandlers.js';
import { pushSupport, defaultReminderPreferences, enableHomeReminders, loadReminderState, disableHomeReminders } from '../src/lib/homeownerPush.js';

const origin = 'https://alex.closeandrelax.com';
const id = '00000000-0000-4000-8000-000000000001';
const token = 'a'.repeat(43);
const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/test-device', keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) } };
const preferences = { timezone: 'America/Indiana/Indianapolis', delivery_time: '10:00', reminders: [
  { kind: 'hvac', enabled: true, first_date: '2026-11-01', interval_days: 90 }, { kind: 'monthly', enabled: true }, { kind: 'seasonal', enabled: true },
] };
// Deliberately fixed, non-production test fixture, not a generated/deployed secret.
const env = name => name === 'WEB_PUSH_SUBSCRIPTION_ENCRYPTION_KEY' ? 'A'.repeat(43) : 'test-only-configuration';
test('hub origins and endpoints reject arbitrary hosts, ports, credentials and private networks', () => {
  assert.equal(hubOrigin(origin), origin);
  for (const value of ['http://alex.closeandrelax.com','https://www.closeandrelax.com','https://alex.closeandrelax.com.evil.test','https://u:p@alex.closeandrelax.com','https://alex.closeandrelax.com:8443']) assert.throws(() => hubOrigin(value));
  assert.equal(validateEndpoint(subscription).endpoint, subscription.endpoint);
  for (const endpoint of ['https://127.0.0.1/a','http://fcm.googleapis.com/fcm/send/a','https://fcm.googleapis.com.evil.test/fcm/send/a','https://fcm.googleapis.com:8443/fcm/send/a','https://fcm.googleapis.com/fcm/send/a?redirect=evil']) assert.throws(() => validateEndpoint({ ...subscription, endpoint }));
  for (const endpoint of ['https://web.push.apple.com/token','https://updates.push.services.mozilla.com/wpush/v2/token']) assert(validateEndpoint({ ...subscription, endpoint }));
});
test('preferences support exactly three independent types and validate dates/timezones', () => {
  assert.deepEqual(validatePreferences(preferences), preferences);
  assert.throws(() => validatePreferences({ ...preferences, timezone: 'Not/AZone' }));
  assert.throws(() => validatePreferences({ ...preferences, delivery_time: '02:00' }));
  assert.throws(() => validatePreferences({ ...preferences, reminders: [...preferences.reminders, { kind: 'travel', enabled: true }] }));
  assert.throws(() => validatePreferences({ ...preferences, reminders: preferences.reminders.map(r => r.kind === 'hvac' ? { ...r, first_date: '2026-02-30' } : r) }));
});
test('AES-GCM protects stored subscriptions and rejects wrong keys/tampering', async () => {
  const encrypted = await encryptSubscription(subscription, env('WEB_PUSH_SUBSCRIPTION_ENCRYPTION_KEY'));
  assert(!encrypted.includes('fcm.googleapis.com'));
  assert.deepEqual(await decryptSubscription(encrypted, env('WEB_PUSH_SUBSCRIPTION_ENCRYPTION_KEY')), subscription);
  await assert.rejects(decryptSubscription(encrypted, 'B'.repeat(43)));
  await assert.rejects(decryptSubscription(encrypted + 'X', env('WEB_PUSH_SUBSCRIPTION_ENCRYPTION_KEY')));
});
test('invalid subscriptions, auth errors, bounded retries and Retry-After are distinct', () => {
  assert.equal(failureDisposition(410, 1).state, 'invalid'); assert.equal(failureDisposition(404, 1).state, 'invalid');
  assert.equal(failureDisposition(403, 1).state, 'auth_error');
  assert.equal(failureDisposition(500, 5).state, 'failed');
  assert.equal(failureDisposition(429, 1, '3600', 0, () => 0).delay, 3600000);
  assert.equal(failureDisposition(503, 2, null, 0, () => 0).delay, 120000);
  assert.equal(failureDisposition(0, 1, null, 0, () => 0).state, 'retry');
});
test('platform support never requests permission and iOS requires installed context', () => {
  const supported = { isSecureContext: true, navigator: { userAgent: 'Android Chrome', serviceWorker: {} }, PushManager: {}, Notification: {}, indexedDB: {} };
  assert.equal(pushSupport(supported), 'supported');
  assert.equal(pushSupport({ ...supported, navigator: { ...supported.navigator, userAgent: 'iPhone' } }), 'install-ios');
  assert.equal(pushSupport({ ...supported, navigator: { ...supported.navigator, userAgent: 'iPhone', standalone: true } }), 'supported');
  assert.equal(pushSupport({ ...supported, PushManager: undefined }), 'unsupported');
  assert.equal(pushSupport({}), 'unsupported');
});
test('preview prevents permissions, storage, network, and worker side effects', async () => {
  await assert.rejects(enableHomeReminders(id, preferences, { preview: true }), /preview/);
  assert.equal(await loadReminderState(id, { preview: true }), null);
  await disableHomeReminders(id, { preview: true });
});
test('defaults are opt-in only; payload copy never uses personalized data', () => {
  assert(defaultReminderPreferences().reminders.every(r => !r.enabled));
  assert.equal(notificationBody(['hvac'], 10), 'Time to check your HVAC filter.');
  assert.match(notificationBody(['hvac', 'monthly'], 10), /check-in/);
});
test('manage API rejects listing, missing capabilities, bad origins, oversized requests and rate-limit abuse', async () => {
  let calls = [];
  const handler = createManageHandler({ env, send: () => assert.fail('must not send'), client: () => ({ rpc: async (name, args) => { calls.push([name,args]); return { data: false }; } }) });
  const post = (body, host = origin) => handler(new Request('https://test.invalid', { method: 'POST', headers: { Origin: host }, body: JSON.stringify(body) }));
  assert.equal((await post({ action: 'list', id, token })).status, 400);
  assert.equal((await post({ action: 'read', id })).status, 400);
  assert.equal((await post({ action: 'read', id, token }, 'https://evil.test')).status, 403);
  assert.equal((await post({ action: 'read', id, token, extra: 'x'.repeat(17000) })).status, 413);
  assert.equal((await post({ action: 'read', id, token })).status, 429);
  assert.equal(calls[0][0], 'homeowner_push_rate_limit');
});
test('enrollment encrypts endpoints, hashes capabilities and sends only a visible possession challenge', async () => {
  let payload, sent;
  const handler = createManageHandler({ env, send: async (sub, data) => { sent=data; return { ok:true }; },
    client: () => ({ rpc: async (name,args) => name.endsWith('rate_limit') ? {data:true} : (payload=args.payload, {data:{status:'pending'}}) }) });
  const result = await handler(new Request('https://test.invalid', {method:'POST',headers:{Origin:origin},body:JSON.stringify({action:'enroll',id,token,profile_id:id,preferences,subscription,consent_version:'home-reminders-v1'})}));
  assert.equal(result.status,200); assert.equal(payload.capability_hash,await hash(token));
  assert(!JSON.stringify(payload).includes(subscription.endpoint));
  assert.equal(sent.installation_id,id); assert.equal(sent.confirmation.length,43); assert.equal(sent.path,'/#homeowner-checklist');
});
test('dispatcher requires scheduler credential and maps delivery failures without exposing records', async () => {
  const encrypted = await encryptSubscription(subscription,env('WEB_PUSH_SUBSCRIPTION_ENCRYPTION_KEY'));
  let finishes=[], sends=0;
  const work = [404,410,429,503,201,403].map((status,i)=>({id:String(i),lease_token:'lease',attempt:1,kinds:['hvac'],local_month:10,encrypted_subscription:encrypted,vapid_key_id:null,status}));
  for (const item of work) item.vapid_key_id=await hash(env('WEB_PUSH_VAPID_PUBLIC_KEY'));
  const handler = createDispatchHandler({env,send:async()=>{const status=work[sends++].status;return {ok:status===201,status,headers:new Headers({'retry-after':'120'})};},client:()=>({rpc:async(name,args)=>{
    if(name.endsWith('claim'))return {data:work}; if(name.endsWith('send_allowed'))return {data:true};finishes.push(args);return {data:null};
  }})});
  assert.equal((await handler(new Request('https://test.invalid',{method:'POST'}))).status,403); assert.equal(sends,0);
  const result = await handler(new Request('https://test.invalid',{method:'POST',headers:{'x-push-cron-secret':env('WEB_PUSH_CRON_SECRET')}}));
  assert.equal(result.status,503); assert.deepEqual(finishes.map(f=>f.outcome),['invalid','invalid','retry','retry','accepted','auth_error']);
  assert(!JSON.stringify(await result.json()).includes('encrypted_subscription'));
});
test('worker click targets cannot escape hub origin or open arbitrary hub routes', async () => {
  const listeners = {};
  const context = { self: { location: { origin }, addEventListener: (name,fn) => listeners[name]=fn }, URL, Response, fetch };
  vm.createContext(context);vm.runInContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),context);
  for(const path of ['https://evil.test','//evil.test','/dashboard','javascript:alert(1)','https://other.closeandrelax.com/'])
    assert.equal(vm.runInContext(`notificationTarget(${JSON.stringify(path)})`,context),origin+'/#home-reminders');
  assert.equal(vm.runInContext('notificationTarget("/#homeowner-checklist")',context),origin+'/#homeowner-checklist');
  let opened;
  context.self.clients={matchAll:async()=>[],openWindow:async url=>{opened=url;}};
  let done;listeners.notificationclick({notification:{close(){},data:{path:'https://evil.test'}},waitUntil:p=>{done=p;}});await done;
  assert.equal(opened,origin+'/#home-reminders');
});
test('worker confirms only its matching installation and never displays capabilities or unapproved payload copy',async()=>{
  const listeners={},requests=[],notifications=[],messages=[];
  const records=new Map([['installation',{id,token,api_url:'https://test.supabase.co/functions/v1/homeowner-push-manage',api_key:'public',profile_id:id}]]);
  const indexedDB={open(){const request={};queueMicrotask(()=>{
    request.result={close(){},transaction(){const tx={};tx.objectStore=()=>({
      get(key){const op={result:records.get(key)};queueMicrotask(()=>tx.oncomplete());return op;},
      put(value,key){records.set(key,value);const op={result:key};queueMicrotask(()=>tx.oncomplete());return op;},
    });return tx;}};request.onsuccess();});return request;}};
  const context={indexedDB,URL,Response,fetch:async(url,options)=>{requests.push(JSON.parse(options.body));return {ok:true,json:async()=>({status:'active'})};},
    self:{location:{origin},addEventListener:(name,fn)=>listeners[name]=fn,registration:{showNotification:async(title,options)=>notifications.push({title,...options})},clients:{matchAll:async()=>[{postMessage:data=>messages.push(data)}]}}};
  vm.createContext(context);vm.runInContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),context);
  const deliver=async data=>{let done;listeners.push({data:{json:()=>data},waitUntil:p=>done=p});await done;};
  await deliver({body:'Home reminders are enabled on this browser.',confirmation:'c'.repeat(43),installation_id:id,path:'/#homeowner-checklist'});
  assert.equal(requests[0].action,'confirm');assert.equal(requests[0].token,token);assert.equal(records.get('installation').status,'active');assert.equal(messages.length,1);
  assert(!JSON.stringify(notifications).includes(token));assert.equal(notifications[0].data.path,origin+'/#homeowner-checklist');
  await deliver({body:'unapproved personal data',confirmation:'c'.repeat(43),installation_id:'another-installation',path:'https://evil.test'});
  assert.equal(requests.length,1);assert.equal(notifications[1].body,'Your home reminders are ready.');assert.equal(notifications[1].data.path,origin+'/#home-reminders');
});
