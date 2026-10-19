import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { hash } from '../supabase/functions/_shared/pushCrypto.js';

const migration = readFileSync(new URL('../supabase/migrations/20261018171924_homeowner_push.sql', import.meta.url), 'utf8');
const a='00000000-0000-4000-8000-000000000001', b='00000000-0000-4000-8000-000000000002', draft='00000000-0000-4000-8000-000000000003';
const installation='10000000-0000-4000-8000-000000000001', second='10000000-0000-4000-8000-000000000002';
const origin='https://alex.closeandrelax.com';
const preferences={timezone:'America/New_York',delivery_time:'10:00',reminders:[{kind:'hvac',enabled:true,first_date:'2026-10-18',interval_days:90},{kind:'monthly',enabled:true},{kind:'seasonal',enabled:true}]};
async function fixture(){
  const db=new PGlite();
  await db.exec(`SET TIME ZONE 'UTC';CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY,slug text,is_published boolean,plan text);
    CREATE TABLE public.vendors(id uuid,profile_id uuid);
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY published ON public.profiles FOR SELECT USING (is_published);
    CREATE FUNCTION public.vendor_plan_limit(plan text) RETURNS integer LANGUAGE sql STABLE AS $$SELECT CASE WHEN plan='premier' THEN 30 WHEN plan IN ('pro','core') THEN 15 ELSE 5 END$$;
    SELECT set_config('test.clock','2026-10-18 14:15:00+00',false);
    CREATE OR REPLACE FUNCTION pg_catalog.now() RETURNS timestamptz LANGUAGE sql STABLE AS $$SELECT current_setting('test.clock')::timestamptz$$;`);
  await db.query(`INSERT INTO public.profiles VALUES ($1,'alex',true,'partner'),($2,'blair',true,'premier'),($3,'draft',false,'pro')`,[a,b,draft]);
  await db.exec(migration);
  return db;
}
async function manage(db,patch={}) {
  const payload={action:'enroll',id:installation,profile_id:a,origin,capability_hash:await hash('installation-a'),endpoint_hash:await hash('endpoint-a'),encrypted_subscription:'test-fixture-encrypted-data',confirmation_hash:await hash('confirmation-a'),vapid_key_id:'test-key-id',preferences,...patch};
  return (await db.query('SELECT public.homeowner_push_manage($1::jsonb) AS result',[JSON.stringify(payload)])).rows[0].result;
}
const claim=async db=>(await db.query('SELECT public.homeowner_push_claim() AS work')).rows[0].work;
const confirm=async db=>manage(db,{action:'confirm'});

test('migration compiles and private tables/RPCs reject anon and ordinary Realtor roles',async()=>{
  const db=await fixture();try{
    for(const role of ['anon','authenticated']){
      await db.exec(`SET ROLE ${role}`);
      for(const table of ['homeowner_push_subscriptions','homeowner_push_reminders','homeowner_push_deliveries','homeowner_push_rate_limits'])
        await assert.rejects(db.query(`SELECT * FROM close_relax_private.${table}`),/permission denied/);
      await assert.rejects(db.query('SELECT public.homeowner_push_claim()'),/permission denied/);
      await assert.rejects(db.query("SELECT public.homeowner_push_manage('{}')"),/permission denied/);
      await db.exec('RESET ROLE');
    }
    const tables=(await db.query("SELECT relrowsecurity FROM pg_class WHERE relname LIKE 'homeowner_push_%' AND relkind='r'")).rows;
    assert.equal(tables.length,4);assert(tables.every(t=>t.relrowsecurity));
    assert.deepEqual((await db.query("SELECT public.vendor_plan_limit('partner') a,public.vendor_plan_limit('pro') b,public.vendor_plan_limit('premier') c")).rows[0],{a:5,b:15,c:30});
    assert.equal((await db.query("SELECT count(*)::int n FROM pg_policies WHERE tablename='profiles' AND policyname='published'")).rows[0].n,1);
  }finally{await db.close();}
});
test('capabilities, published profile and canonical origin prevent cross-hub read/update/replacement/unsubscribe',async()=>{
  const db=await fixture();try{
    assert.equal((await manage(db)).status,'pending');
    for(const action of ['read','preferences','replace','unsubscribe','confirm']) await assert.rejects(manage(db,{action,capability_hash:await hash('attacker')}),/unavailable/);
    await assert.rejects(manage(db,{action:'read',origin:'https://blair.closeandrelax.com'}),/unavailable/);
    await assert.rejects(manage(db,{id:second,profile_id:draft,origin:'https://draft.closeandrelax.com',endpoint_hash:await hash('endpoint-b')}),/unavailable/);
    await assert.rejects(manage(db,{id:second,profile_id:b,origin:'https://blair.closeandrelax.com'}),/unique/);
    await assert.rejects(manage(db,{action:'confirm',confirmation_hash:await hash('wrong')}),/expired/);
    await confirm(db);assert.equal((await manage(db,{action:'read'})).status,'active');
    // Payload IDs cannot rebind an existing installation even with its own valid capability.
    await manage(db,{action:'preferences',profile_id:b});
    assert.equal((await db.query('SELECT profile_id FROM close_relax_private.homeowner_push_subscriptions')).rows[0].profile_id,a);
    await manage(db,{action:'unsubscribe'});
    assert.equal((await manage(db,{action:'unsubscribe'})).status,'disabled','revocation retries are idempotent');
    assert.equal((await db.query('SELECT count(*)::int n FROM close_relax_private.homeowner_push_subscriptions')).rows[0].n,0);
    await assert.rejects(manage(db,{action:'read'}),/unavailable/);
  }finally{await db.close();}
});
test('timezone schedules keep 10am wall time across DST, handle leap dates and seasonal boundaries',async()=>{
  const db=await fixture();try{
    const due=async(kind,after,first,days,zone='America/New_York')=>(await db.query("SELECT close_relax_private.push_next_due($1,$2::date,$3::date,$4,$5,'10:00'::time)::text AS due",[kind,after,first,days,zone])).rows[0].due;
    assert.equal(await due('hvac','2026-10-31','2026-10-31',1),'2026-11-01 15:00:00+00');
    assert.equal(await due('hvac','2026-03-07','2026-03-07',1),'2026-03-08 14:00:00+00');
    assert.equal(await due('monthly','2028-02-29',null,null),'2028-03-01 15:00:00+00');
    assert.equal(await due('seasonal','2026-12-01',null,null),'2027-03-01 15:00:00+00');
    assert.equal(await due('seasonal','2026-08-31',null,null),'2026-09-01 14:00:00+00');
    assert.equal(await due('monthly','2026-10-18',null,null,'Asia/Kolkata'),'2026-11-01 04:30:00+00');
  }finally{await db.close();}
});
test('due reminders combine, occurrences deduplicate, leases reject stale acknowledgments, retries are bounded',async()=>{
  const db=await fixture();try{
    await manage(db);await confirm(db);await db.exec("DELETE FROM close_relax_private.homeowner_push_deliveries WHERE occurrence_key LIKE 'welcome:%'");
    await db.exec("UPDATE close_relax_private.homeowner_push_reminders SET next_due_at=now()-interval '15 minutes'");
    let work=await claim(db);assert.equal(work.length,1);assert.equal(work[0].kinds.length,3);
    assert.equal((await claim(db)).length,0);
    const d=work[0];
    await db.query("SELECT public.homeowner_push_finish($1,$2,'accepted')",[d.id,'20000000-0000-4000-8000-000000000001']);
    assert.equal((await db.query('SELECT state FROM close_relax_private.homeowner_push_deliveries')).rows[0].state,'leased');
    await db.query("SELECT public.homeowner_push_finish($1,$2,'retry',now()-interval '1 second','http_503')",[d.id,d.lease_token]);
    work=await claim(db);assert.equal(work.length,1);assert.equal(work[0].attempt,2);assert.notEqual(work[0].lease_token,d.lease_token);
    await db.query("SELECT public.homeowner_push_finish($1,$2,'accepted')",[work[0].id,work[0].lease_token]);
    await db.exec("UPDATE close_relax_private.homeowner_push_reminders SET next_due_at=now()-interval '1 minute'");
    assert.equal((await claim(db)).length,0,'same-day cap');
    assert.equal((await db.query('SELECT count(*)::int n FROM close_relax_private.homeowner_push_deliveries')).rows[0].n,1);
  }finally{await db.close();}
});
test('rolling week cap, stale expiry, quiet hours, invalid-subscription cleanup and unpublished hub cancellation',async()=>{
  const db=await fixture();try{
    await manage(db);await confirm(db);await db.exec("DELETE FROM close_relax_private.homeowner_push_deliveries WHERE occurrence_key LIKE 'welcome:%'");
    await db.query(`INSERT INTO close_relax_private.homeowner_push_deliveries(subscription_id,occurrence_key,kinds,local_month,expires_at,state,last_attempt_at)
      VALUES($1,'previous-1','{monthly}',10,now(),'accepted',now()-interval '2 days'),($1,'previous-2','{seasonal}',10,now(),'accepted',now()-interval '4 days')`,[installation]);
    await db.exec("UPDATE close_relax_private.homeowner_push_reminders SET next_due_at=now()-interval '1 minute'");assert.equal((await claim(db)).length,0,'two/week cap');
    await db.exec("DELETE FROM close_relax_private.homeowner_push_deliveries;UPDATE close_relax_private.homeowner_push_reminders SET next_due_at=now()-interval '1 day'");
    assert.equal((await claim(db)).length,0,'never dump missed reminders');
    await db.exec("UPDATE close_relax_private.homeowner_push_reminders SET next_due_at=now()-interval '1 minute'");
    const [d]=await claim(db);
    await db.query("SELECT public.homeowner_push_finish($1,$2,'invalid',NULL,'http_410')",[d.id,d.lease_token]);
    const invalid=(await db.query('SELECT status,encrypted_subscription FROM close_relax_private.homeowner_push_subscriptions')).rows[0];
    assert.equal(invalid.status,'invalid');assert.equal(invalid.encrypted_subscription,null);
    await manage(db,{action:'replace'});await confirm(db);
    await db.exec("SELECT set_config('test.clock','2026-10-19 03:00:00+00',false);UPDATE close_relax_private.homeowner_push_reminders SET next_due_at=now()-interval '1 minute'");
    assert.equal((await claim(db)).length,0,'no late-night retry');
    await db.query('UPDATE public.profiles SET is_published=false WHERE id=$1',[a]);await claim(db);
    assert.equal((await db.query('SELECT status FROM close_relax_private.homeowner_push_subscriptions')).rows[0].status,'disabled');
    await manage(db,{action:'unsubscribe'}); // Revocation remains available even after unpublishing.
  }finally{await db.close();}
});
test('send-time checks and endpoint uniqueness survive subscription replacement and profile renames',async()=>{
  const db=await fixture();try{
    await manage(db);await confirm(db);await db.exec("DELETE FROM close_relax_private.homeowner_push_deliveries WHERE occurrence_key LIKE 'welcome:%'");await db.exec("UPDATE close_relax_private.homeowner_push_reminders SET next_due_at=now()-interval '1 minute'");
    const [d]=await claim(db);
    const allowed=async()=>(await db.query('SELECT public.homeowner_push_send_allowed($1,$2) allowed',[d.id,d.lease_token])).rows[0].allowed;
    assert.equal(await allowed(),true);
    await db.query("UPDATE public.profiles SET slug='renamed' WHERE id=$1",[a]);assert.equal(await allowed(),false);
    await claim(db);assert.equal((await db.query('SELECT state FROM close_relax_private.homeowner_push_deliveries WHERE id=$1',[d.id])).rows[0].state,'cancelled');
  }finally{await db.close();}
});
test('welcome caps, expired confirmation/leases, retention and auth errors are safe',async()=>{
  const db=await fixture();try{
    await manage(db);await confirm(db);
    assert.equal((await claim(db)).length,0,'welcome already uses today’s notification slot');
    await db.exec("DELETE FROM close_relax_private.homeowner_push_deliveries;UPDATE close_relax_private.homeowner_push_reminders SET next_due_at=now()-interval '1 minute'");
    const [first]=await claim(db);
    await db.exec("SELECT set_config('test.clock','2026-10-18 14:21:00+00',false)");
    const [replacement]=await claim(db);assert.equal(replacement.id,first.id);assert.notEqual(replacement.lease_token,first.lease_token);
    await db.query("SELECT public.homeowner_push_finish($1,$2,'auth_error',NULL,'http_403')",[replacement.id,replacement.lease_token]);
    const paused=(await db.query('SELECT status,encrypted_subscription FROM close_relax_private.homeowner_push_subscriptions')).rows[0];
    assert.equal(paused.status,'auth_error');assert(paused.encrypted_subscription,'auth failure must not erase subscriptions');
    await manage(db,{action:'replace'});
    await db.exec("SELECT set_config('test.clock','2026-10-18 14:32:00+00',false)");
    await assert.rejects(confirm(db),/expired/);
    await db.exec("SELECT set_config('test.clock','2026-10-20 14:00:00+00',false)");await claim(db);
    assert.equal((await db.query('SELECT count(*)::int n FROM close_relax_private.homeowner_push_subscriptions')).rows[0].n,0);
  }finally{await db.close();}
});
test('rate-limit counters are atomic and retain only hashed short-lived buckets',async()=>{
  const db=await fixture();try{
    const bucket=await hash('non-production-test-bucket');
    for(let i=0;i<3;i++)assert.equal((await db.query('SELECT public.homeowner_push_rate_limit($1,2) allowed',[bucket])).rows[0].allowed,i<2);
    await db.exec("SELECT set_config('test.clock','2026-10-18 17:00:00+00',false)");await claim(db);
    assert.equal((await db.query('SELECT count(*)::int n FROM close_relax_private.homeowner_push_rate_limits')).rows[0].n,0);
  }finally{await db.close();}
});
test('separate Cron setup validates Vault project configuration and refuses duplicate scheduler jobs',async()=>{
  const db=new PGlite();try{
    // Model only SQL interfaces: no extension/HTTP/Cron workers exist or execute here.
    await db.exec(`CREATE SCHEMA vault;CREATE SCHEMA cron;CREATE SCHEMA net;
      CREATE TABLE vault.decrypted_secrets(name text,decrypted_secret text);
      CREATE TABLE cron.job(jobname text,schedule text,command text);
      CREATE FUNCTION cron.schedule(job_name text,expression text,sql_command text) RETURNS integer LANGUAGE plpgsql AS $$BEGIN INSERT INTO cron.job VALUES(job_name,expression,sql_command);RETURN 1;END$$;
      CREATE FUNCTION net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) RETURNS integer LANGUAGE sql AS $$SELECT 1$$;`);
    const sql=readFileSync(new URL('../supabase/setup/homeowner-push-cron.sql',import.meta.url),'utf8').replace(/^CREATE EXTENSION.*$/gm,'');
    await assert.rejects(db.exec(sql),/Configure and verify/);await db.exec('ROLLBACK');
    await db.exec(`INSERT INTO vault.decrypted_secrets VALUES ('homeowner_push_project_url','https://hphcejnvxyccmwmofdqc.supabase.co'),('homeowner_push_cron_secret','non-production-fixture-not-a-real-secret');`);
    await db.exec(sql);
    const job=(await db.query('SELECT * FROM cron.job')).rows[0];assert.equal(job.schedule,'*/15 * * * *');
    await db.exec(job.command); // Calls the inert net stub, not a network request.
    await assert.rejects(db.exec(sql),/already scheduled/);await db.exec('ROLLBACK');
    assert.equal((await db.query('SELECT count(*)::int n FROM cron.job')).rows[0].n,1);
  }finally{await db.close();}
});
