import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithEsbuild } from 'vite';
import * as supportClient from '../src/lib/supportContact.js';
import { createSupportHandler, supportOriginAllowed, validateSupportContact } from '../supabase/functions/_shared/supportContact.js';
import { DEFAULT_SUPPORT_FALLBACK_URL, sendSupportMessage, supportFallbackUrl } from '../src/lib/supportContact.js';

const id = '00000000-0000-4000-8000-000000000001';
const draft = { request_id: id, name: 'Test Realtor', email: 'test@example.com', message: 'Please help with setup.' };
const migration = readFileSync(new URL('../supabase/migrations/20261019035914_support_inbox.sql', import.meta.url), 'utf8');

test('support dialog renders explicit manual closure consent and failure-only fallback, never fake deletion success',async()=>{
  const source=readFileSync(new URL('../src/components/SupportContactDialog.jsx',import.meta.url),'utf8');
  const compiled=await transformWithEsbuild(source.replaceAll('import.meta.env','({})'),'SupportContactDialog.jsx',{loader:'jsx',format:'cjs',jsx:'transform'});
  const require=createRequire(import.meta.url);
  const render=(closure,failed,receipt='')=>{
    let state=0;
    const module={exports:{}};
    // Render the real component's initial, failed-delivery and confirmed-receipt branches.
    const react={...React,useState:initial=>{
      const index=state++;
      return React.useState(index===8?failed:index===7?receipt:initial);
    }};
    new Function('require','module','exports',compiled.code)(name=>name==='react'?react:name==='../lib/supabase'?{supabase:{}}:name==='../lib/turnstile'?{normalizeTurnstileSiteKey:()=>'',loadTurnstile:()=>{},turnstileFailure:()=>{}}:name==='../lib/supportContact'?supportClient:require(name),module,module.exports);
    return renderToStaticMarkup(React.createElement(module.exports.default,{requestType:closure?'account_closure':'general',initialEmail:draft.email,onClose(){}}));
  };
  const closure=render(true,false);
  for(const copy of ['Request account closure','type="checkbox"','request for review, not immediate deletion','Unpublishing only hides','Send closure request','readonly=""'])assert.ok(closure.includes(copy),copy);
  assert.doesNotMatch(closure,/hello@callistadigital.com/);
  assert.match(render(false,true),/href="mailto:hello@callistadigital.com"/);
  assert.doesNotMatch(render(false,true,id),/href="mailto:hello@callistadigital.com"/);
  assert.match(render(true,false,id),/Nothing has been unpublished or deleted/);
  assert.match(source,/closure && !closureConfirmed/);
  assert.doesNotMatch(source,/localStorage|sessionStorage|auth\.admin|\.delete\(/);
});

test('support validates bounded fields and only forwards expected data', () => {
  assert.deepEqual(validateSupportContact({ ...draft, name: ' Test Realtor ', admin: true }), draft);
  for (const change of [{ name: '' }, { name: 'a'.repeat(161) }, { email: 'bad' }, { email: 'x\r\n@example.com' }, { message: ' ' }, { message: 'x'.repeat(4001) }, { message: '\0test' }, { request_id: 'bad' }])
    assert.throws(() => validateSupportContact({ ...draft, ...change }));
  for (const value of ['javascript:alert(1)', 'https://user:pass@example.com', 'mailto:x@example.com?bcc=private@example.com']) assert.equal(supportFallbackUrl(value), '');
  assert.equal(supportFallbackUrl('mailto:support@example.com'), 'mailto:support@example.com');
  assert.equal(supportFallbackUrl('https://example.com/contact'), 'https://example.com/contact');
  assert.equal(DEFAULT_SUPPORT_FALLBACK_URL, 'mailto:hello@callistadigital.com');
  for (const value of [undefined, '', '  ']) assert.equal(supportFallbackUrl(value), 'mailto:hello@callistadigital.com');
  assert.equal(supportFallbackUrl('mailto:support@closeandrelax.com'), 'mailto:support@closeandrelax.com');
});

function setup(overrides = {}) {
  const calls = [];
  const handler = createSupportHandler({
    env: () => 'test-only',
    fetcher: async () => Response.json({ success: true, action: 'support_contact', hostname: 'closeandrelax.com' }),
    save: async (message, hash) => { calls.push({ message, hash }); return { data: message.request_id }; },
    ...overrides,
  });
  const request = (body = {}, options = {}) => new Request('https://example.com/support-contact', {
    method: 'POST', headers: { origin: 'https://closeandrelax.com', 'x-forwarded-for': '192.0.2.1', 'content-type': 'application/json' },
    body: JSON.stringify({ ...draft, captcha_token: 'test-token', ...body }), ...options,
  });
  return { handler, request, calls };
}

test('support endpoint saves only after CAPTCHA and returns the confirmed receipt without PII', async () => {
  const { handler, request, calls } = setup();
  const response = await handler(request());
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { accepted: true, reference: id });
  assert.deepEqual(calls[0].message, draft);
  assert.match(calls[0].hash, /^[a-f0-9]{64}$/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('closure requires verified non-anonymous Auth identity and ignores supplied account/email authority', async () => {
  const body={request_type:'account_closure',email:'someone-else@example.com',profile_id:'another-profile'};
  const withBearer=x=>x.request(body,{headers:{origin:'https://closeandrelax.com','x-forwarded-for':'192.0.2.1',authorization:'Bearer test-session'}});
  for(const identity of [null,{id,email:draft.email,is_anonymous:true},{id}]) {
    const x=setup({authenticate:async()=>identity});
    assert.equal((await x.handler(withBearer(x))).status,401);assert.equal(x.calls.length,0);
  }
  const x=setup({authenticate:async token=>{assert.equal(token,'test-session');return {id,email:'owner@example.com'};}});
  assert.equal((await x.handler(x.request(body))).status,401);
  assert.equal((await x.handler(withBearer(x))).status,201);
  assert.equal(x.calls[0].message.email,'owner@example.com');
  assert.match(x.calls[0].message.message,new RegExp(`Authenticated account: ${id}`));
  assert.match(x.calls[0].message.message,/no deletion or unpublish performed/);
  assert.equal('profile_id' in x.calls[0].message,false);
  // Identity stamping is deterministic for retry/idempotency; still one existing support write path.
  await x.handler(withBearer(x));assert.deepEqual(x.calls[1].message,x.calls[0].message);
  const bad=setup({authenticate:async()=>{throw Error('private auth details');}});
  assert.equal((await bad.handler(withBearer(bad))).status,401);assert.equal(bad.calls.length,0);
});

test('closure retains CAPTCHA and rate limiting and rejects unsupported request types',async()=>{
  const authenticate=async()=>({id,email:draft.email});
  for(const [overrides,status] of [
    [{fetcher:async()=>Response.json({success:false})},400],
    [{save:async()=>({error:{code:'P0429'}})},429],
  ]) {
    const x=setup({authenticate,...overrides});
    const response=await x.handler(x.request({request_type:'account_closure'},{headers:{origin:'https://closeandrelax.com','x-forwarded-for':'192.0.2.1',authorization:'Bearer test-session'}}));
    assert.equal(response.status,status);
  }
  const x=setup();assert.equal((await x.handler(x.request({request_type:'delete_account'}))).status,400);assert.equal(x.calls.length,0);
});

test('closure frontend rechecks Auth before submission; expired or anonymous sessions never invoke endpoint',async()=>{
  for(const user of [null,{id,email:draft.email,is_anonymous:true},{id}]) {
    const client={auth:{getUser:async()=>({data:{user}})},functions:{invoke:async()=>assert.fail('No submission')}};
    await assert.rejects(sendSupportMessage(client,draft,'token','','account_closure'),/Log in again/);
  }
  let sent;
  const client={auth:{getUser:async()=>({data:{user:{id,email:draft.email}}})},functions:{invoke:async(_name,options)=>{sent=options.body;return {data:{accepted:true,reference:id}};}}};
  assert.equal(await sendSupportMessage(client,draft,'token','','account_closure'),id);
  assert.equal(sent.request_type,'account_closure');
  assert.equal('profile_id' in sent,false);
});

test('wrong CAPTCHA action/hostname, blocked origins, honeypot, bad input and missing config never save', async () => {
  for (const captcha of [{ success: false }, { success: true, action: 'goosehead_lead', hostname: 'closeandrelax.com' }, { success: true, action: 'support_contact', hostname: 'www.closeandrelax.com' }]) {
    const { handler, request, calls } = setup({ fetcher: async () => Response.json(captcha) });
    assert.equal((await handler(request())).status, 400); assert.equal(calls.length, 0);
  }
  for (const body of [{ company_website: 'spam' }, { name: '' }, { captcha_token: '' }]) {
    const { handler, request, calls } = setup();
    assert.equal((await handler(request(body))).status, 400); assert.equal(calls.length, 0);
  }
  const { handler, request, calls } = setup({ env: () => '' });
  assert.equal((await handler(request())).status, 503); assert.equal(calls.length, 0);
  for (const origin of ['https://closeandrelax.com.attacker.com', 'https://attacker.com', 'null', 'http://closeandrelax.com']) assert.equal(supportOriginAllowed(origin), false);
  assert.equal(supportOriginAllowed('https://liz.closeandrelax.com'), true);
});

test('endpoint exposes no read/update/delete and fails honestly on save errors and rate limits', async () => {
  const { handler, request } = setup();
  for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) assert.equal((await handler(request({}, { method, body: undefined }))).status, 405);
  for (const [code, status] of [['P0429', 429], ['42501', 503]]) {
    const x = setup({ save: async () => ({ error: { code, message: 'private database details' } }) });
    const response = await x.handler(x.request());
    assert.equal(response.status, status); assert.doesNotMatch(await response.text(), /private database details|accepted/);
  }
  const x = setup({ save: async () => { throw new Error('private details'); } });
  assert.equal((await x.handler(x.request())).status, 503);
});

test('frontend reports success only for a confirmed matching receipt; retries keep the same request id', async () => {
  let count = 0;
  const client = { functions: { invoke: async (name, options) => {
    assert.equal(name, 'support-contact'); assert.equal(options.body.request_id, id); count++;
    return count === 1 ? { error: new Error('offline') } : { data: { accepted: true, reference: id } };
  } } };
  await assert.rejects(sendSupportMessage(client, draft, 'token'), /could not be confirmed/);
  assert.equal(await sendSupportMessage(client, draft, 'token'), id);
  for (const data of [null, { accepted: true }, { accepted: true, reference: 'other' }, { accepted: false, reference: id }])
    await assert.rejects(sendSupportMessage({ functions: { invoke: async () => ({ data }) } }, draft, 'token'));
  await assert.rejects(sendSupportMessage({ functions: { invoke: async () => ({ error: { context: { status: 429 } } }) } }, draft, 'token'), /wait an hour/);
});

test('abuse boundaries reject foreign origins, oversize payloads and missing client IP without writes', async () => {
  for (const options of [
    { headers: { origin: 'https://attacker.com' } },
    { headers: { origin: 'https://closeandrelax.com', 'content-length': '20001' } },
    { headers: { origin: 'https://closeandrelax.com' } },
    { body: 'x'.repeat(20001) },
  ]) {
    const { handler, request, calls } = setup();
    assert.ok((await handler(request({}, options))).status >= 400); assert.equal(calls.length, 0);
  }
  const x = setup();
  assert.equal((await x.handler(x.request({}, { method: 'OPTIONS', body: undefined }))).status, 204);
  assert.equal(x.calls.length, 0);
});

test('private support database denies direct access and ordinary/admin impersonation; service creation is idempotent and capped', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE SCHEMA close_relax_private;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth,public,close_relax_private TO anon,authenticated,service_role;
      CREATE TABLE close_relax_private.platform_admins(user_id uuid PRIMARY KEY);
      REVOKE ALL ON close_relax_private.platform_admins FROM PUBLIC,anon,authenticated,service_role;
      CREATE FUNCTION close_relax_private.is_platform_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
        SELECT EXISTS(SELECT 1 FROM close_relax_private.platform_admins WHERE user_id=auth.uid()) $$;
      INSERT INTO close_relax_private.platform_admins VALUES ('${id}');`);
    await db.exec(migration);
    const submit = async (n = 1, change = {}) => db.query('SELECT public.submit_support_message($1::jsonb,$2) AS id', [JSON.stringify({ ...draft, request_id: id.replace(/1$/, String(n)), ...change }), 'a'.repeat(64)]);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`SET ROLE ${role};`);
      await assert.rejects(submit(), /permission denied/);
      for (const sql of ['SELECT * FROM close_relax_private.support_messages', "INSERT INTO close_relax_private.support_messages(id) VALUES (gen_random_uuid())", "UPDATE close_relax_private.support_messages SET status='closed'", 'DELETE FROM close_relax_private.support_messages', 'SELECT public.list_support_messages(0)']) await assert.rejects(db.exec(sql), /permission denied|Administrator/);
      await db.exec('RESET ROLE;');
    }
    await db.exec("SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false); SELECT set_config('request.jwt.claims','{\"user_metadata\":{\"admin\":true},\"plan\":\"premier\"}',false);");
    await assert.rejects(db.exec('SELECT public.list_support_messages(0)'), /Administrator/);
    await assert.rejects(db.query('SELECT public.update_support_message_status($1,$2)', [id, 'closed']), /Administrator/);
    await db.exec('RESET ROLE; SET ROLE service_role;');
    assert.equal((await submit()).rows[0].id, id);
    assert.equal((await submit()).rows[0].id, id);
    await assert.rejects(submit(1, { message: 'changed' }), /Invalid request/);
    for (let n = 2; n <= 5; n++) await submit(n);
    await assert.rejects(submit(6), (e) => e.code === 'P0429');
    await assert.rejects(db.exec('SELECT * FROM close_relax_private.support_messages'), /permission denied/);
    await assert.rejects(db.exec('SELECT public.list_support_messages(0)'), /permission denied/);
    await db.exec(`RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${id}',false);`);
    const rows = (await db.query('SELECT public.list_support_messages(0) AS messages')).rows[0].messages;
    assert.equal(rows.length, 5); assert.equal(rows[0].id.endsWith('5'), true);
    assert.equal('requester_hash' in rows[0], false);
    assert.equal((await db.query('SELECT public.update_support_message_status($1,$2) AS status', [id, 'in_progress'])).rows[0].status, 'in_progress');
    await assert.rejects(db.query('SELECT public.update_support_message_status($1,$2)', [id, 'invalid']), /Invalid status/);
    await db.exec('RESET ROLE;');
    assert.equal((await db.query("SELECT relrowsecurity FROM pg_class WHERE oid='close_relax_private.support_messages'::regclass")).rows[0].relrowsecurity, true);
    assert.doesNotMatch(migration, /ALTER TABLE public\.|CREATE TRIGGER|CREATE POLICY|UPDATE public\.|INSERT INTO .*platform_admins/i);
  } finally { await db.close(); }
});
