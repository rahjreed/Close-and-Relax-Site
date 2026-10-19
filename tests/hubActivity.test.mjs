import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { HUB_EVENT_SOURCES, getHubDeviceId, sendHubActivity } from '../src/lib/hubActivity.js';
const read=(p)=>readFileSync(new URL(p,import.meta.url),'utf8');
const migration=read('../supabase/migrations/20261019183523_restrict_hub_activity_ingestion.sql');
const id=(n)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const owner=id(1),other=id(2),draft=id(3),device=id(10);
const payload=(overrides={})=>({profile_id:owner,device_id:device,event_type:'hub_view',source:'public_hub',...overrides});
async function fixture() {
  const db=new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA close_relax_private; REVOKE ALL ON SCHEMA close_relax_private FROM PUBLIC;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY,slug text,is_published boolean);
    INSERT INTO public.profiles VALUES ('${owner}','first',true),('${other}','second',true),('${draft}','draft',false);
    CREATE TABLE public.hub_activity_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      event_type text NOT NULL CHECK(event_type IN ('hub_view','save_click','install_accepted','standalone_open','ios_instructions','savings_vivint_click','savings_goosehead_click')),
      source text CHECK(source IS NULL OR length(source)<=40),device_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
    ALTER TABLE public.hub_activity_events ENABLE ROW LEVEL SECURITY;
    GRANT ALL ON public.hub_activity_events TO anon,authenticated,service_role;
    GRANT INSERT(profile_id,device_id,event_type) ON public.hub_activity_events TO anon,authenticated;
    CREATE POLICY "Public can record published hub activity" ON public.hub_activity_events FOR INSERT TO anon,authenticated
      WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.is_published));
    CREATE POLICY "Realtors can view their own hub activity" ON public.hub_activity_events FOR SELECT TO authenticated USING(profile_id=auth.uid());`);
  await db.exec(migration);return db;
}
async function actor(db,run,{role='anon',origin='https://first.closeandrelax.com',user=owner}={}) {
  await db.query("SELECT set_config('request.headers',$1,false),set_config('request.jwt.claim.sub',$2,false)",[JSON.stringify({origin}),user]);
  await db.exec(`SET ROLE ${role}`);
  try{return await run();}finally{await db.exec('RESET ROLE');}
}
const record=async(db,p)=> (await db.query('SELECT public.record_hub_activity($1::jsonb) accepted',[JSON.stringify(p)])).rows[0].accepted;
const count=async(db)=>(await db.query('SELECT count(*)::int n FROM public.hub_activity_events')).rows[0].n;

test('legitimate anonymous event types work, duplicates across sources are omitted, direct writes and cross-owner reads are denied',async()=>{
  const db=await fixture();try{
    for(const [event_type,sources] of Object.entries(HUB_EVENT_SOURCES))
      assert.equal(await actor(db,()=>record(db,payload({event_type,source:sources[0]}))),true);
    assert.equal(await count(db),7);
    assert.equal(await actor(db,()=>record(db,payload())),false);
    assert.equal(await actor(db,()=>record(db,payload({event_type:'save_click',source:'floating_button'}))),false);
    for(const role of ['anon','authenticated'])await actor(db,async()=>{
      for(const sql of ["INSERT INTO public.hub_activity_events(profile_id,device_id,event_type) VALUES ('"+owner+"','"+device+"','hub_view')",
        'UPDATE public.hub_activity_events SET source=NULL','DELETE FROM public.hub_activity_events','TRUNCATE public.hub_activity_events'])
        await assert.rejects(db.exec(sql),e=>e.code==='42501');
      await assert.rejects(db.query('SELECT close_relax_private.ingest_hub_activity($1::jsonb)',[JSON.stringify(payload())]),e=>e.code==='42501');
    },{role});
    await actor(db,()=>assert.rejects(db.exec('SELECT * FROM public.hub_activity_events'),e=>e.code==='42501'));
    assert.equal((await actor(db,()=>db.query('SELECT count(*)::int n FROM public.hub_activity_events'),{role:'authenticated'})).rows[0].n,7);
    assert.equal((await actor(db,()=>db.query('SELECT count(*)::int n FROM public.hub_activity_events'),{role:'authenticated',user:other})).rows[0].n,0);
  }finally{await db.close();}
});

test('publication, hub origin, exact shape, allowed source/event and canonical identifiers fail closed without PII storage',async()=>{
  const db=await fixture();try{
    for(const p of [null,[],{},payload({profile_id:'bad'}),payload({device_id:'bad'}),payload({device_id:id(0).replace('-4000-','-0000-')}),
      payload({profile_id:id(999)}),payload({profile_id:draft}),payload({profile_id:other}),payload({event_type:'fake'}),payload({source:'private@example.com'}),
      payload({source:null}),payload({event_type:'hub_view',source:'homeowner_savings'}),{...payload(),name:'Private'},
      {...payload(),created_at:'1900-01-01'},payload({device_id:{name:'Private'}}),payload({source:'a'.repeat(1024)})])
      assert.equal(await actor(db,()=>record(db,p)),false);
    assert.equal(await actor(db,()=>record(db,payload()),{origin:'https://www.closeandrelax.com'}),false);
    assert.equal(await actor(db,()=>record(db,payload({profile_id:other})),{origin:'https://second.closeandrelax.com'}),true);
    assert.equal(await count(db),1);
    await db.query('UPDATE public.profiles SET is_published=false WHERE id=$1',[other]);
    assert.equal(await actor(db,()=>record(db,payload({profile_id:other,device_id:id(22)})),{origin:'https://second.closeandrelax.com'}),false);
  }finally{await db.close();}
});

test('device hourly and profile daily/storage caps survive rotated IDs; expired rows prune on valid ingestion',async()=>{
  const db=await fixture();try{
    // Seed controlled local history to reach boundaries without generating live traffic.
    await db.query(`INSERT INTO public.hub_activity_events(profile_id,device_id,event_type,created_at)
      SELECT $1,$2,'save_click',now()-interval '10 minutes' FROM generate_series(1,30)`,[owner,device]);
    assert.equal(await actor(db,()=>record(db,payload())),false);
    assert.equal(await actor(db,()=>record(db,payload({device_id:id(11)}))),true);
    await db.exec('TRUNCATE public.hub_activity_events');
    await db.query(`INSERT INTO public.hub_activity_events(profile_id,device_id,event_type,created_at)
      SELECT $1,gen_random_uuid(),'hub_view',now()-interval '2 hours' FROM generate_series(1,500)`,[owner]);
    assert.equal(await actor(db,()=>record(db,payload({device_id:id(12)}))),false);
    assert.equal(await count(db),500);
    await db.exec('TRUNCATE public.hub_activity_events');
    await db.query(`INSERT INTO public.hub_activity_events(profile_id,device_id,event_type,created_at)
      SELECT $1,gen_random_uuid(),'hub_view',now()-interval '2 days' FROM generate_series(1,5000)`,[owner]);
    assert.equal(await actor(db,()=>record(db,payload())),false);
    assert.equal(await count(db),5000);
    await db.exec("UPDATE public.hub_activity_events SET created_at=now()-interval '91 days'");
    assert.equal(await actor(db,()=>record(db,payload())),true);
    assert.equal(await count(db),1);
    // Dedupe expires after five minutes, without trusting a client timestamp.
    await db.exec("UPDATE public.hub_activity_events SET created_at=now()-interval '6 minutes'");
    assert.equal(await actor(db,()=>record(db,payload())),true);
    const attempts=await actor(db,()=>Promise.all(Array.from({length:6},()=>record(db,payload()))));
    assert.ok(attempts.every(v=>v===false));assert.equal(await count(db),2);
  }finally{await db.close();}
});

test('client sends only allowlisted fields through RPC and failures/preview never disrupt homeowner actions',async()=>{
  const calls=[],client={rpc:async(...args)=>{calls.push(args);return {data:true};}};
  const args={profileId:owner,deviceId:device,eventType:'hub_view',source:'public_hub',name:'Never sent',insurance:{email:'Never sent'}};
  assert.equal(await sendHubActivity(client,args),true);
  assert.deepEqual(calls,[['record_hub_activity',{payload:payload()}]]);
  for(const patch of [{preview:true},{eventType:'fake'},{eventType:'constructor'},{eventType:'__proto__'},{eventType:null},{source:'email@example.com'},{deviceId:'bad'},{profileId:'bad'}])
    assert.equal(await sendHubActivity(client,{...args,...patch}),false);
  assert.equal(calls.length,1);
  assert.equal(await sendHubActivity({rpc:async()=>{throw new Error('offline');}},args),false);
  assert.equal(await sendHubActivity({rpc:async()=>({error:{message:'denied'}})},args),false);
});

test('device IDs are per hub, survive storage reload, repair malformed values and stay stable when storage is blocked',()=>{
  const saved=new Map(),storage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
  const a=id(100),b=id(101),c=id(102),d=id(103);
  saved.set(`closeandrelax-device-id-${a}`,device);
  assert.equal(getHubDeviceId(a,storage,()=>id(200)),device);
  assert.equal(getHubDeviceId(b,storage,()=>id(201)),id(201));
  saved.set(`closeandrelax-device-id-${c}`,'private@example.com');
  assert.equal(getHubDeviceId(c,storage,()=>id(202)),id(202));
  const blocked={getItem(){throw Error();},setItem(){throw Error();}};
  assert.equal(getHubDeviceId(d,blocked,()=>id(203)),id(203));
  assert.equal(getHubDeviceId(d,blocked,()=>id(204)),id(203));
  assert.equal(saved.has('closeandrelax-device-id'),false);
  assert.equal(getHubDeviceId(id(104),storage,()=>{throw Error('unavailable');}),null);
  const hub=read('../src/components/PublicRealtorHub.jsx');
  assert.doesNotMatch(hub,/\.from\('hub_activity_events'\)/);
  assert.match(hub,/preview \? undefined : recordPublicHubActivity\(event\)/);
});
