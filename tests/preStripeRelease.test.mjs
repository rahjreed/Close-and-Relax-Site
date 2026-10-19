import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,mkdtempSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {ROOT,validateRelease,validateInitialHistory,stageRelease,ALLOWED_MIGRATIONS} from '../tools/prepare-pre-stripe-release.mjs';
const read=path=>readFileSync(join(ROOT,path),'utf8');
const manifest=validateRelease();
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [free,core,pro,draft,fresh,admin]=[1,2,3,4,5,9].map(id);
async function actor(db,role,user,run,origin='https://fixture-free.closeandrelax.com') {
  await db.query("SELECT set_config('request.jwt.claims',$1,false),set_config('request.headers',$2,false)",
    [JSON.stringify({role,sub:user,user_metadata:{plan:'premier',admin:true}}),JSON.stringify({origin})]);
  await db.exec(`SET ROLE ${role}`);
  try{return await run();}finally{await db.exec('RESET ROLE');await db.exec("SELECT set_config('request.jwt.claims','{}',false),set_config('request.headers','{}',false)");}
}
const publicProfile=async(db,slug,user=null)=>(await actor(db,user?'authenticated':'anon',user,()=>db.query('SELECT public.get_public_realtor_profile($1) p',[slug]))).rows[0].p;
const view=async(db,profile,user=null)=>(await actor(db,user?'authenticated':'anon',user,()=>db.query('SELECT public.get_hub_vendors($1) v',[profile]))).rows[0].v;
const custom=vendors=>vendors.filter(v=>!v.is_default);
const scalar=async(db,sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const fingerprints=async db=>(await db.query(`SELECT n.nspname,p.proname,pg_get_functiondef(p.oid) body,p.proacl::text
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','close_relax_private')
  AND (p.proname LIKE '%insurance%' OR p.proname LIKE '%goosehead%' OR p.proname LIKE '%push%' OR p.proname IN ('is_platform_admin','vendor_plan_limit','restore_close_relax_standard_vendor')) ORDER BY 1,2`)).rows;

test('release package accepts only the exact ordered ten-file allowlist and matching app/backend sources',()=>{
  assert.equal(manifest.selected.length,10);assert.equal(manifest.historical.length,6);
  for(const mutate of [m=>m.selected.reverse(),m=>m.selected.push(m.selected[0]),m=>m.selected[0].sha256_lf='bad',m=>m.excluded=[],m=>m.historical[0].action='apply',m=>m.historical[0].production_version='wrong',m=>m.frontend.files[0].sha256_lf='bad']) {
    const altered=structuredClone(manifest);mutate(altered);assert.throws(()=>validateRelease(altered));
  }
  const snapshot=JSON.parse(read('release/pre-stripe-security/production-history-observed.json'));
  assert.equal(validateInitialHistory(snapshot),true);
  assert.throws(()=>validateInitialHistory({...snapshot,migrations:snapshot.migrations.slice(1)}));
  assert.throws(()=>validateInitialHistory({...snapshot,migrations:[...snapshot.migrations,{version:'unexpected',name:'unreviewed'}]}));
  const temporary=mkdtempSync(join(tmpdir(),'close-relax-release-'));
  try{
    const target=stageRelease(join(temporary,'bundle'));
    assert.deepEqual(readdirSync(join(target,'selected-migrations')).sort(),[...ALLOWED_MIGRATIONS].sort());
    assert.throws(()=>stageRelease(target),/new directory/);
    for(const h of manifest.historical)assert.ok(!readdirSync(join(target,'selected-migrations')).includes(h.file));
  }finally{
    const cleanupTarget=resolve(temporary);
    if(dirname(cleanupTarget)!==resolve(tmpdir())||!basename(cleanupTarget).startsWith('close-relax-release-'))throw Error('Unsafe test cleanup path.');
    rmSync(cleanupTarget,{recursive:true,force:true});
  }
});

async function baseline() {
  const db=new PGlite();
  await db.exec(read('tests/fixtures/launch-production-baseline.sql'));
  for(const h of manifest.historical)await db.exec(read(`supabase/migrations/${h.file}`));
  await db.exec('CREATE SCHEMA supabase_migrations;CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text);');
  for(const h of manifest.historical)await db.query('INSERT INTO supabase_migrations.schema_migrations VALUES($1,$2)',[h.production_version,h.name]);
  for(const user of [free,core,pro,draft,fresh,admin])await db.query("INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES($1,$2,now(),$3)",[user,`fixture-${user.slice(-1)}@example.invalid`,JSON.stringify({full_name:'Synthetic Realtor',plan:'premier',admin:true})]);
  for(const [user,plan,slug,published] of [[free,'partner','fixture-free',true],[core,'pro','fixture-core',true],[pro,'premier','fixture-pro',true],[draft,'partner','fixture-draft',false],[admin,'premier','fixture-owner',false]]) {
    await db.query('INSERT INTO public.profiles(id,plan,slug,is_published,full_name,email,brokerage,phone,city,photo_url,welcome_message) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [user,plan,slug,published,'Synthetic Realtor','public@example.invalid','Example Brokerage','3175550100','Example City','https://example.invalid/saved-legacy.webp','Saved welcome']);
  }
  await db.query('INSERT INTO close_relax_private.platform_admins(user_id) VALUES($1)',[admin]);
  for(const [user,count] of [[free,4],[core,15],[pro,30]])for(let n=0;n<count;n++)await db.query('INSERT INTO public.vendors(profile_id,name,category,sort_order,recommendation) VALUES($1,$2,$3,$4,$5)',[user,`Synthetic vendor ${n}`,'Handyman',n,user===free?null:'Preserved paid note']);
  await db.query("INSERT INTO public.homeowner_checklist_items(profile_id,title,recurrence_months) VALUES($1,'Synthetic filter',3)",[pro]);
  await db.query("INSERT INTO public.custom_hub_sections(profile_id,title,body) VALUES($1,'Synthetic resource','Saved content')",[pro]);
  await db.query("INSERT INTO public.emergency_service_assignments(profile_id,category_code,provider_name,phone) VALUES($1,'plumbing','Synthetic emergency provider','3175550100')",[pro]);
  return db;
}

test('entire selected chain replays on the production-shaped baseline and preserves unrelated behavior',async t=>{
  const db=await baseline();
  try {
    const initial=await fingerprints(db);
    const emergencyBefore=(await db.query('SELECT * FROM public.emergency_service_categories ORDER BY sort_order')).rows;
    const beforeProfileRows=(await db.query('SELECT * FROM public.profiles ORDER BY id')).rows;
    const beforeVendorRows=(await db.query('SELECT * FROM public.vendors ORDER BY id')).rows;
    const pre=await scalar(db,read('release/pre-stripe-security/preflight.sql'));
    for(const [key,value] of Object.entries(pre))if(typeof value==='boolean')assert.equal(value,true,key);
    for(const migration of manifest.selected) {
      await db.exec(read(`supabase/migrations/${migration.file}`));
      await db.query('INSERT INTO supabase_migrations.schema_migrations VALUES($1,$2)',[migration.source_version,migration.name]);
    }
    assert.deepEqual((await db.query('SELECT * FROM public.profiles ORDER BY id')).rows,beforeProfileRows);
    assert.deepEqual((await db.query('SELECT * FROM public.vendors ORDER BY id')).rows,beforeVendorRows);
    assert.deepEqual(await fingerprints(db),initial);
    assert.deepEqual((await db.query('SELECT * FROM public.emergency_service_categories ORDER BY sort_order')).rows,emergencyBefore);
    assert.equal(await scalar(db,'SELECT count(*)::int FROM public.emergency_service_assignments'),1);
    const post=await scalar(db,read('release/pre-stripe-security/postflight.sql'));
    for(const [key,value] of Object.entries(post))assert.equal(value,true,key);

    await t.test('cross-account mutations/reads, legacy access, plan spoofing and unpublished public access are denied',async()=>{
      await actor(db,'authenticated',free,async()=>{
        assert.equal(await scalar(db,'SELECT count(*)::int FROM public.profiles WHERE id=$1',[draft]),0);
        assert.equal(await scalar(db,'SELECT count(*)::int FROM public.vendors WHERE profile_id=$1',[draft]),0);
        const update=await db.query("UPDATE public.profiles SET full_name='attack' WHERE id=$1 RETURNING id",[draft]);assert.equal(update.rows.length,0);
        await assert.rejects(db.query("UPDATE public.profiles SET plan='premier' WHERE id=$1",[free]));
        await assert.rejects(db.query("UPDATE public.profiles SET photo_url='attack' WHERE id=$1",[free]));
        await assert.rejects(db.query("UPDATE public.profiles SET slug='admin' WHERE id=$1",[free]));
        await assert.rejects(db.query('SELECT public.add_standard_close_relax_vendor($1)',[draft]));
        await assert.rejects(db.exec('SELECT * FROM public.realtor_profiles'));
      });
      assert.equal(await publicProfile(db,'fixture-draft'),null);assert.equal(await publicProfile(db,'fixture-draft',free),null);
      assert.deepEqual(await view(db,draft),[]);assert.deepEqual(await view(db,draft,free),[]);
      assert.ok((await view(db,draft,draft)).some(v=>v.is_default));
      assert.equal((await publicProfile(db,'fixture-free')).photo_url,null);
      assert.equal((await publicProfile(db,'fixture-core')).photo_url,'https://example.invalid/saved-legacy.webp');
      assert.equal((await publicProfile(db,'fixture-free')).welcome_message,null);
      assert.equal((await publicProfile(db,'not-found')),null);
    });

    await t.test('vendor visibility follows 30→15→5→30, keeps saved rows/notes, and restores the fixed standard resource',async()=>{
      const before=(await db.query('SELECT * FROM public.vendors WHERE profile_id=$1 ORDER BY id',[pro])).rows;
      await actor(db,'authenticated',pro,()=>db.query('DELETE FROM public.vendors WHERE profile_id=$1 AND is_default',[pro]));
      assert.ok(!(await view(db,pro)).some(v=>v.is_default));
      for(const [plan,limit] of [['pro',15],['partner',5],['premier',30]]) {
        await db.query('UPDATE public.profiles SET plan=$1 WHERE id=$2',[plan,pro]);
        const visible=await view(db,pro);assert.equal(custom(visible).length,limit);
        assert.equal(visible.some(v=>v.is_default),plan!=='premier');
        if(plan==='partner')assert.ok(custom(visible).every(v=>v.recommendation===null));
      }
      const after=(await db.query('SELECT * FROM public.vendors WHERE profile_id=$1 AND NOT is_default ORDER BY id',[pro])).rows;
      assert.deepEqual(after,before.filter(v=>!v.is_default));
      assert.equal((await publicProfile(db,'fixture-pro')).photo_url,'https://example.invalid/saved-legacy.webp');
      assert.equal(await scalar(db,'SELECT count(*)::int FROM public.homeowner_checklist_items WHERE profile_id=$1',[pro]),1);
      await actor(db,'authenticated',pro,()=>db.exec('SELECT public.restore_close_relax_standard_vendor()'));
      assert.ok((await view(db,pro)).some(v=>v.is_default));
    });

    await t.test('competing insert requests into the last Free slot permit only one saved addition (PGlite serializes sessions)',async()=>{
      await actor(db,'authenticated',free,async()=>{
        const results=await Promise.allSettled(Array.from({length:8},(_,n)=>db.query("INSERT INTO public.vendors(profile_id,name,category) VALUES($1,$2,'Handyman')",[free,`Contender ${n}`])));
        assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
        assert.equal(await scalar(db,'SELECT count(*)::int FROM public.vendors WHERE profile_id=$1 AND NOT is_default',[free]),5);
      });
      assert.equal(custom(await view(db,free)).length,5);assert.equal(custom(await view(db,core)).length,15);
    });

    await t.test('bootstrap is owner-only/idempotent Free recovery and queues one private notification',async()=>{
      await actor(db,'authenticated',fresh,async()=>{
        for(let n=0;n<3;n++){
          const p=await scalar(db,'SELECT public.bootstrap_own_profile()');assert.equal(p.id,fresh);assert.equal(p.plan,'partner');assert.equal(p.is_published,false);
        }
        await assert.rejects(db.query('INSERT INTO public.profiles(id) VALUES($1)',[fresh]));
      });
      assert.equal(await scalar(db,'SELECT count(*)::int FROM public.profiles WHERE id=$1',[fresh]),1);
      assert.equal(await scalar(db,'SELECT count(*)::int FROM close_relax_private.realtor_signup_notifications WHERE profile_id=$1',[fresh]),1);
      const jobs=await actor(db,'service_role',null,()=>scalar(db,"SELECT public.claim_realtor_signup_notifications('sender@example.invalid','owner@example.invalid')"));
      assert.equal(jobs.length,1);assert.equal(jobs[0].profile_id,fresh);
      const ack=await actor(db,'service_role',null,()=>scalar(db,"SELECT public.finish_realtor_signup_notification($1,$2,'accepted','fake-provider-receipt')",[fresh,jobs[0].lease_id]));assert.equal(ack,true);
      assert.equal(await scalar(db,"SELECT count(*)::int FROM close_relax_private.realtor_signup_notifications WHERE status='ignored'"),5);
    });

    await t.test('Support receipt/idempotency/admin-only status works and no public lead/inbox/outbox access exists',async()=>{
      const message={request_id:id(100),name:'Synthetic sender',email:'sender@example.invalid',message:'Synthetic support request'};
      const submit=()=>actor(db,'service_role',null,()=>scalar(db,'SELECT public.submit_support_message($1,$2)',[message,'a'.repeat(64)]));
      assert.equal(await submit(),message.request_id);assert.equal(await submit(),message.request_id);
      await actor(db,'authenticated',free,async()=>{
        await assert.rejects(db.exec('SELECT public.list_support_messages()'));
        await assert.rejects(db.exec('SELECT public.list_insurance_leads()'));
        await assert.rejects(db.exec('SELECT * FROM close_relax_private.support_messages'));
        await assert.rejects(db.exec('SELECT * FROM close_relax_private.realtor_signup_notifications'));
      });
      await actor(db,'authenticated',admin,async()=>{
        const inbox=await scalar(db,'SELECT public.list_support_messages()');assert.equal(inbox.length,1);
        assert.equal(await scalar(db,"SELECT public.update_support_message_status($1,'in_progress')",[message.request_id]),'in_progress');
      });
      await actor(db,'anon',null,async()=>{await assert.rejects(db.exec('SELECT public.list_support_messages()'));await assert.rejects(db.exec('SELECT * FROM close_relax_private.goosehead_homeowner_leads'));});
    });

    await t.test('analytics accepts only published valid events and denies old direct inserts and cross-owner reads',async()=>{
      const event={profile_id:free,device_id:id(110),event_type:'hub_view',source:'public_hub'};
      assert.equal(await actor(db,'anon',null,()=>scalar(db,'SELECT public.record_hub_activity($1)',[event])),true);
      assert.equal(await actor(db,'anon',null,()=>scalar(db,'SELECT public.record_hub_activity($1)',[event])),false);
      assert.equal(await actor(db,'anon',null,()=>scalar(db,'SELECT public.record_hub_activity($1)',[{...event,profile_id:draft}])),false);
      await actor(db,'anon',null,()=>assert.rejects(db.query('INSERT INTO public.hub_activity_events(profile_id,device_id,event_type) VALUES($1,$2,$3)',[free,id(111),'hub_view'])));
      assert.equal(await actor(db,'authenticated',core,()=>scalar(db,'SELECT count(*)::int FROM public.hub_activity_events')),0);
    });

    await t.test('existing insurance RPCs retain direct/referral/address/admin/status and five-per-hour behavior',async()=>{
      const lead={request_id:id(200),profile_id:null,insurance_type:'auto',full_name:'Synthetic homeowner',phone:'3175550100',email:'homeowner@example.invalid',callback_date:'2099-01-01',callback_window:'11am-3pm',callback_timezone:'America/Indianapolis',contact_consent:true};
      const save=(input,hash='b'.repeat(64))=>actor(db,'service_role',null,()=>scalar(db,'SELECT public.submit_goosehead_homeowner_lead($1,$2)',[input,hash]));
      assert.equal(await save(lead),lead.request_id);assert.equal(await save(lead),lead.request_id);
      await assert.rejects(()=>save({...lead,request_id:id(201),insurance_type:'home'}));
      await assert.rejects(()=>save({...lead,request_id:id(201),profile_id:draft}));
      await db.query('UPDATE public.profiles SET homeowner_savings_visible=false WHERE id=$1',[pro]);
      await assert.rejects(()=>save({...lead,request_id:id(201),profile_id:pro}));
      await db.query('UPDATE public.profiles SET homeowner_savings_visible=true WHERE id=$1',[pro]);
      const home={...lead,request_id:id(201),profile_id:core,insurance_type:'home_and_auto',street_address:'123 Test St',city:'Example City',state:'IN',zip_code:'46201'};
      assert.equal(await save(home),home.request_id);
      for(let n=202;n<=204;n++)await save({...lead,request_id:id(n)});
      await assert.rejects(()=>save({...lead,request_id:id(205)}),/Too many/);
      const list=await actor(db,'authenticated',admin,()=>scalar(db,'SELECT public.list_insurance_leads()'));assert.equal(list.length,5);
      assert.equal(await actor(db,'authenticated',admin,()=>scalar(db,"SELECT public.update_insurance_lead_status($1,'contacted')",[home.request_id])),'contacted');
      await actor(db,'authenticated',free,()=>assert.rejects(db.query("SELECT public.update_insurance_lead_status($1,'closed')",[home.request_id])));
      assert.deepEqual(await fingerprints(db),initial);
    });

    await t.test('emergency policies still work and push groundwork stays dormant without scheduler extensions or deliveries',async()=>{
      assert.equal(await actor(db,'anon',null,()=>scalar(db,'SELECT count(*)::int FROM public.emergency_service_assignments')),1);
      assert.equal(await scalar(db,"SELECT count(*)::int FROM pg_extension WHERE extname IN ('pg_cron','pg_net')"),0);
      for(const table of ['homeowner_push_subscriptions','homeowner_push_reminders','homeowner_push_deliveries','homeowner_push_rate_limits'])assert.equal(await scalar(db,`SELECT count(*)::int FROM close_relax_private.${table}`),0);
      await actor(db,'anon',null,()=>assert.rejects(db.exec('SELECT public.homeowner_push_claim()')));
      for(const file of manifest.selected)assert.doesNotMatch(read(`supabase/migrations/${file.file}`),/DROP TABLE public\.emergency|cron\.schedule|CREATE EXTENSION|net\.http_post/i);
    });
  }finally{await db.close();}
});
