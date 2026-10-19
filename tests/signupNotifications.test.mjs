import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createSignupNotificationHandler } from '../supabase/functions/_shared/signupNotifications.js';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const migration=read('../supabase/migrations/20261019200249_realtor_signup_owner_notifications.sql');
const id='00000000-0000-4000-8000-000000000121',other='00000000-0000-4000-8000-000000000122',third='00000000-0000-4000-8000-000000000123';
const settings={SIGNUP_NOTIFICATIONS_ENABLED:'true',SIGNUP_NOTIFICATION_WORKER_SECRET:'local-test-only-secret-0123456789abcdef',SIGNUP_NOTIFICATION_FROM:'notice@example.invalid',SIGNUP_NOTIFICATION_TO:'owner@example.invalid',RESEND_API_KEY:'fake-api-key'};
const request=(headers={},method='POST')=>new Request('https://example.invalid/signup-notifications',{method,headers:{Authorization:`Bearer ${settings.SIGNUP_NOTIFICATION_WORKER_SECRET}`,...headers}});
const worker=(deps={})=>createSignupNotificationHandler({env:name=>settings[name]||'',claim:async()=>({data:[],error:null}),finish:async()=>({data:true}),...deps});
const oneJob=()=>({profile_id:id,lease_id:third,first_attempt_at:new Date().toISOString(),payload:{from:settings.SIGNUP_NOTIFICATION_FROM,to:[settings.SIGNUP_NOTIFICATION_TO],subject:'New Close & Relax Realtor profile',text:'Realtor: Pat\nAccount email: pat@example.invalid'}});

async function fixture() {
  const db=new PGlite();
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
    CREATE SCHEMA auth;CREATE SCHEMA close_relax_private;REVOKE ALL ON SCHEMA close_relax_private FROM PUBLIC;
    GRANT USAGE ON SCHEMA close_relax_private TO authenticated,service_role;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT (auth.jwt()->>'sub')::uuid$$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}',created_at timestamptz DEFAULT now(),
      email_confirmed_at timestamptz,is_anonymous boolean DEFAULT false,deleted_at timestamptz);
    CREATE TABLE public.profiles(id uuid PRIMARY KEY,created_at timestamptz DEFAULT now(),email text,full_name text,brokerage text,city text,
      plan text DEFAULT 'partner',is_published boolean DEFAULT false,homeowner_savings_visible boolean DEFAULT true);
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    GRANT SELECT,INSERT,UPDATE ON public.profiles TO authenticated;
    CREATE POLICY own_read ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid());
    CREATE POLICY own_update ON public.profiles FOR UPDATE TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
    CREATE POLICY own_insert ON public.profiles FOR INSERT TO authenticated WITH CHECK(id=auth.uid());`);
  await db.exec(read('../supabase/migrations/20261019172710_bootstrap_realtor_profile.sql'));
  await addUser(db,third);
  await db.query('INSERT INTO public.profiles(id,plan) VALUES($1,$2)',[third,'premier']);
  await db.exec(migration);
  return db;
}
async function addUser(db,userId=id,confirmed=true) {
  await db.query("INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES($1,'pat@example.invalid',$2,$3::jsonb)",
    [userId,confirmed?new Date():null,JSON.stringify({full_name:'Pat Realtor',plan:'premier',admin:true,password:'must-not-copy',token:'must-not-copy'})]);
}
async function actor(db,role,run,userId=id) {
  await db.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:userId,role})]);
  await db.exec(`SET ROLE ${role}`);
  try{return await run();}finally{await db.exec('RESET ROLE');}
}
async function boot(db,userId=id) {
  return actor(db,'authenticated',async()=> (await db.query('SELECT public.bootstrap_own_profile() p')).rows[0].p,userId);
}
async function claim(db,from=settings.SIGNUP_NOTIFICATION_FROM,to=settings.SIGNUP_NOTIFICATION_TO) {
  return actor(db,'service_role',async()=> (await db.query('SELECT public.claim_realtor_signup_notifications($1,$2) jobs',[from,to])).rows[0].jobs);
}
async function finish(db,job,outcome='accepted',receipt='provider-receipt-1') {
  return actor(db,'service_role',async()=> (await db.query('SELECT public.finish_realtor_signup_notification($1,$2,$3,$4) ok',[job.profile_id,job.lease_id,outcome,receipt])).rows[0].ok);
}

test('confirmed first profile creation queues once; repeat signup/bootstrap/update and existing profiles never duplicate; no paid metadata copied',async()=>{
  const db=await fixture();try{
    await addUser(db);const profile=await boot(db);assert.equal(profile.plan,'partner');
    await boot(db);await boot(db);await db.query("UPDATE public.profiles SET full_name='Updated' WHERE id=$1",[id]);
    const rows=(await db.query('SELECT * FROM close_relax_private.realtor_signup_notifications ORDER BY profile_id')).rows;
    assert.equal(rows.length,2);assert.equal(rows.find(r=>r.profile_id===third).status,'ignored');
    const jobs=await claim(db);assert.equal(jobs.length,1);assert.equal(jobs[0].profile_id,id);
    assert.match(jobs[0].payload.text,/Internal plan: partner/);assert.match(jobs[0].payload.text,/Account email: pat@example.invalid/);
    assert.doesNotMatch(jobs[0].payload.text,/must-not-copy|password|token|admin:true/);
    assert.equal(await finish(db,jobs[0]),true);assert.deepEqual(await claim(db),[]);
    await db.query('DELETE FROM public.profiles WHERE id=$1',[id]);await boot(db);
    assert.deepEqual(await claim(db),[]); // Durable tombstone survives profile recreation.
    assert.equal((await db.query('SELECT email_payload FROM close_relax_private.realtor_signup_notifications WHERE profile_id=$1',[id])).rows[0].email_payload,null);
  }finally{await db.close();}
});

test('unconfirmed, anonymous and missing Auth identities cannot produce alerts; signup/profile rollback leaves no queued event',async()=>{
  const db=await fixture();try{
    await addUser(db,id,false);await assert.rejects(()=>boot(db));
    await db.query('INSERT INTO public.profiles(id) VALUES($1)',[id]);assert.deepEqual(await claim(db),[]);
    await db.query('UPDATE auth.users SET email_confirmed_at=now(),is_anonymous=true WHERE id=$1',[id]);assert.deepEqual(await claim(db),[]);
    await addUser(db,other);await db.exec('BEGIN');await boot(db,other);await db.exec('ROLLBACK');
    assert.deepEqual(await claim(db),[]);
    assert.equal((await db.query('SELECT count(*)::int n FROM close_relax_private.realtor_signup_notifications WHERE profile_id=$1',[other])).rows[0].n,0);
  }finally{await db.close();}
});

test('enqueue exceptions do not block a real bootstrap; worker reconciles the missing event after repair',async()=>{
  const db=await fixture();try{
    await addUser(db);await db.exec("ALTER TABLE close_relax_private.realtor_signup_notifications ADD CONSTRAINT simulated_outage CHECK(status='ignored')");
    assert.equal((await boot(db)).id,id);
    assert.equal((await db.query('SELECT count(*)::int n FROM close_relax_private.realtor_signup_notifications')).rows[0].n,1);
    await db.exec('ALTER TABLE close_relax_private.realtor_signup_notifications DROP CONSTRAINT simulated_outage');
    assert.equal((await claim(db)).length,1);
  }finally{await db.close();}
});

test('queue, worker RPCs, PII and routing are inaccessible to anon/Realtors even with admin/plan metadata; ACLs/RLS/search paths are explicit',async()=>{
  const db=await fixture();try{
    await addUser(db);await boot(db);
    for(const role of ['anon','authenticated']) {
      for(const sql of ["SELECT * FROM close_relax_private.realtor_signup_notifications",`INSERT INTO close_relax_private.realtor_signup_notifications(profile_id) VALUES('${other}')`,
        'UPDATE close_relax_private.realtor_signup_notifications SET status=\'accepted\'','DELETE FROM close_relax_private.realtor_signup_notifications',
        "SELECT public.claim_realtor_signup_notifications('attacker@example.invalid','attacker@example.invalid')",
        `SELECT public.finish_realtor_signup_notification('${id}','${other}','accepted','forged')`,
        `SELECT close_relax_private.enqueue_realtor_signup('${other}')`]) await assert.rejects(()=>actor(db,role,()=>db.exec(sql)));
    }
    await assert.rejects(()=>actor(db,'service_role',()=>db.exec('SELECT * FROM close_relax_private.realtor_signup_notifications')));
    assert.equal((await db.query("SELECT relrowsecurity FROM pg_class WHERE oid='close_relax_private.realtor_signup_notifications'::regclass")).rows[0].relrowsecurity,true);
    const funcs=(await db.query("SELECT proconfig FROM pg_proc WHERE pronamespace='close_relax_private'::regnamespace AND proname LIKE '%realtor_signup%'")).rows;
    for(const f of funcs)assert.ok(f.proconfig.includes('search_path=""'));
    assert.equal((await db.query('SELECT plan FROM public.profiles WHERE id=$1',[third])).rows[0].plan,'premier');
    assert.doesNotMatch(migration,/CREATE (?:OR REPLACE )?FUNCTION public\.(?:protect_profile_plan|bootstrap_own_profile|vendor_plan_limit)|ALTER POLICY|CREATE EXTENSION|cron\.schedule|net\.http/);
  }finally{await db.close();}
});

test('leases isolate workers, stale acknowledgements fail and retries freeze all fields including the private recipient',async()=>{
  const db=await fixture();try{
    await addUser(db);await boot(db);const [job]=await claim(db);assert.deepEqual(await claim(db),[]);
    assert.equal(await finish(db,{...job,lease_id:other}),false);
    await db.query("UPDATE close_relax_private.realtor_signup_notifications SET lease_until=now()-interval '1 second' WHERE profile_id=$1",[id]);
    assert.equal(await finish(db,job),false);
    await db.query("UPDATE public.profiles SET full_name='Changed',plan='premier',email='public@example.invalid' WHERE id=$1",[id]);
    const [retry]=await claim(db,'new-sender@example.invalid','new-owner@example.invalid');
    assert.notEqual(retry.lease_id,job.lease_id);assert.deepEqual(retry.payload,job.payload);
    assert.equal(await finish(db,retry,'retry',null),true);assert.deepEqual(await claim(db),[]);
    await db.query("UPDATE close_relax_private.realtor_signup_notifications SET available_at=now(),first_attempt_at=now()-interval '24 hours' WHERE profile_id=$1",[id]);
    assert.deepEqual(await claim(db),[]);assert.equal((await db.query('SELECT error_code FROM close_relax_private.realtor_signup_notifications WHERE profile_id=$1',[id])).rows[0].error_code,'retry_window_elapsed');
  }finally{await db.close();}
});

test('retry cap and deleted-account cancellation stop sends without altering Auth/profile data',async()=>{
  const db=await fixture();try{
    await addUser(db);await boot(db);await db.query('DELETE FROM auth.users WHERE id=$1',[id]);
    assert.deepEqual(await claim(db),[]);assert.equal((await db.query('SELECT status FROM close_relax_private.realtor_signup_notifications WHERE profile_id=$1',[id])).rows[0].status,'cancelled');
    await addUser(db,other);await boot(db,other);await db.query("UPDATE close_relax_private.realtor_signup_notifications SET attempts=8 WHERE profile_id=$1",[other]);
    assert.deepEqual(await claim(db),[]);assert.equal((await db.query('SELECT error_code FROM close_relax_private.realtor_signup_notifications WHERE profile_id=$1',[other])).rows[0].error_code,'exhausted');
  }finally{await db.close();}
});

test('worker rejects missing/wrong authorization, browser origins, invalid config and disabled mode without touching queue/provider',async()=>{
  let calls=0;const touched=async()=>{calls++;throw Error('must not run');};
  for(const [req,overrides,status] of [
    [request({},'GET'),{},405],[request({Authorization:'Bearer wrong'}),{},401],
    [request({Origin:'https://closeandrelax.com'}),{},403],
    [request(),{SIGNUP_NOTIFICATION_TO:'unsafe\r\nvalue'},503],
    [request(),{RESEND_API_KEY:''},503],[request(),{SIGNUP_NOTIFICATION_WORKER_SECRET:''},503],
    [request(),{SIGNUP_NOTIFICATIONS_ENABLED:'false'},200],
  ]){
    const handler=worker({env:name=>({...settings,...overrides})[name]||'',claim:touched,finish:touched,fetcher:touched});
    const response=await handler(req);assert.equal(response.status,status);assert.doesNotMatch(await response.text(),/owner@example|fake-api-key|local-test-only/);
  }
  assert.equal(calls,0);
});

test('worker sends minimal frozen payload to Resend with stable idempotency, never caller-supplied recipients or metadata',async()=>{
  const job=oneJob();let sent,ack;
  const handler=worker({claim:async()=>({data:[job]}),fetcher:async(url,options)=>{sent={url,options};return Response.json({id:'email-123'});},finish:async(...args)=>{ack=args;return {data:true};}});
  const req=new Request('https://example.invalid/',{method:'POST',headers:{Authorization:`Bearer ${settings.SIGNUP_NOTIFICATION_WORKER_SECRET}`},body:JSON.stringify({to:'attacker@example.invalid',profile_id:other,raw_user_meta_data:{token:'secret'}})});
  const response=await handler(req);assert.equal(response.status,200);
  assert.equal(sent.url,'https://api.resend.com/emails');assert.deepEqual(JSON.parse(sent.options.body),job.payload);
  assert.equal(sent.options.headers['Idempotency-Key'],`realtor-signup/${id}`);assert.equal(sent.options.headers.Authorization,'Bearer fake-api-key');
  assert.deepEqual(ack,[id,third,'accepted','email-123']);assert.doesNotMatch(await response.text(),/Pat|example.invalid|secret|00000000/);
});

test('provider errors, timeouts, malformed receipts and failed DB acknowledgement do not expose data and remain retryable',async()=>{
  for(const [provider,outcome] of [[500,'retry'],[429,'retry'],[408,'retry'],[401,'rejected'],[422,'rejected'],[409,'rejected'],['network','retry'],['malformed','retry']]){
    let actual;
    const handler=worker({claim:async()=>({data:[oneJob()]}),fetcher:async()=>{if(provider==='network')throw Error('private');return provider==='malformed'?Response.json({secret:'private'}):new Response('sensitive provider body',{status:provider});},finish:async(_id,_lease,state)=>{actual=state;return {data:true};}});
    const response=await handler(request());assert.equal(response.status,200);assert.equal(actual,outcome);assert.doesNotMatch(await response.text(),/private|sensitive/);
  }
  let sends=0;
  const handler=worker({claim:async()=>({data:[oneJob()]}),fetcher:async()=>{sends++;return Response.json({id:'email-123'});},finish:async()=>({error:{message:'private'}})});
  assert.equal((await handler(request())).status,503);assert.equal(sends,1);
});

test('accepted email with lost acknowledgement retries identically through actual DB leases without a second provider email',async()=>{
  const db=await fixture();try{
    await addUser(db);await boot(db);let failAck=true,calls=0;const provider=new Map();
    const handler=worker({claim:async(from,to)=>({data:await claim(db,from,to)}),finish:async(...args)=>{
      if(failAck){failAck=false;throw Error('lost response');}return {data:await finish(db,{profile_id:args[0],lease_id:args[1]},args[2],args[3])};},
      fetcher:async(_url,options)=>{calls++;const key=options.headers['Idempotency-Key'];if(provider.has(key))assert.equal(provider.get(key),options.body);else provider.set(key,options.body);return Response.json({id:'provider-id'});}});
    assert.equal((await handler(request())).status,503);
    await db.query("UPDATE close_relax_private.realtor_signup_notifications SET lease_until=now()-interval '1 second' WHERE profile_id=$1",[id]);
    assert.equal((await handler(request())).status,200);assert.equal(calls,2);assert.equal(provider.size,1);
    assert.equal((await db.query('SELECT status FROM close_relax_private.realtor_signup_notifications WHERE profile_id=$1',[id])).rows[0].status,'accepted');
  }finally{await db.close();}
});

test('worker stops expired/invalid attempts before contacting Resend and fails closed on queue errors',async()=>{
  for(const timestamp of ['invalid',new Date(Date.now()-24*60*60*1000).toISOString()]) {
    let sent=0;const job={...oneJob(),first_attempt_at:timestamp};
    const handler=worker({claim:async()=>({data:[job]}),fetcher:async()=>{sent++;throw Error();}});
    assert.equal((await handler(request())).status,503);assert.equal(sent,0);
  }
  const handler=worker({claim:async()=>({error:{message:'private error'}})});
  const response=await handler(request());assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/private/);
});

test('rollout scheduling is separate and references only signup Vault secrets; frontend contains no worker or recipient configuration',()=>{
  const schedule=read('../supabase/operations/schedule_signup_notifications.sql');
  assert.match(schedule,/cron\.schedule\('close-relax-signup-notifications','\*\/5 \* \* \* \*'/);
  assert.match(schedule,/signup_notification_worker_secret/);assert.doesNotMatch(schedule,/homeowner_push|CREATE EXTENSION/i);
  assert.doesNotMatch(migration,/cron\.schedule|vault\.create_secret|net\.http_post/);
  for(const file of ['../src/App.jsx','../src/lib/profileBootstrap.js'])
    assert.doesNotMatch(read(file),/SIGNUP_NOTIFICATION_|RESEND_API_KEY|signup-notifications|claim_realtor_signup_notifications/);
  assert.match(read('../supabase/functions/signup-notifications/index.ts'),/persistSession:false/);
  assert.match(read('../src/lib/legalPages.js'),/When owner signup notifications are enabled/);
});
