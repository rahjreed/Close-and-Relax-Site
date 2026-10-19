import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { CORE_BRANDING_FIELDS, PRO_BRANDING_FIELDS, profileForHub, loadPublicHubProfile } from '../src/lib/profileBranding.js';

const sql=readFileSync(new URL('../supabase/migrations/20261019032658_enforce_profile_branding.sql',import.meta.url),'utf8');
const free='00000000-0000-4000-8000-000000000011',core='00000000-0000-4000-8000-000000000012',pro='00000000-0000-4000-8000-000000000013';
const fields=[...CORE_BRANDING_FIELDS,...PRO_BRANDING_FIELDS];

test('Free and unknown plans clear every paid alias without mutating saved owner content',()=>{
  for(const plan of ['partner','free',null,'unknown']) {
    const owner={plan,full_name:'Saved name',...Object.fromEntries(fields.map(f=>[f,`saved-${f}`]))};
    const view=profileForHub(owner);
    for(const f of fields){assert.equal(view[f],'');assert.equal(owner[f],`saved-${f}`);}
    assert.equal(view.full_name,'Saved name');
  }
});
test('Core aliases preserve Core branding including legacy photo/welcome; only Pro retains Pro fields',()=>{
  for(const plan of ['pro','core','premier']) {
    const owner={plan,...Object.fromEntries(fields.map(f=>[f,`saved-${f}`]))};
    const view=profileForHub(owner);
    for(const f of CORE_BRANDING_FIELDS)assert.equal(view[f],owner[f]);
    for(const f of PRO_BRANDING_FIELDS)assert.equal(view[f],plan==='premier'?owner[f]:'');
  }
});
test('public loader uses only the filtered RPC and fails closed without a raw-table fallback',async()=>{
  const client={rpc:async(name,args)=>{assert.equal(name,'get_public_realtor_profile');assert.deepEqual(args,{hub_slug:'saved'});return {data:{slug:'saved',plan:'free',is_published:true,photo_url:'forged'}};}};
  assert.equal((await loadPublicHubProfile(client,'saved')).photo_url,'');
  assert.equal(await loadPublicHubProfile({rpc:async()=>({data:null})},'saved'),null);
  for(const response of [{error:{}},{data:{slug:'other',is_published:true}},{data:{slug:'saved',is_published:false}}])
    await assert.rejects(loadPublicHubProfile({rpc:async()=>response},'saved'));
});
test('every public/preview renderer and loader applies the shared branding boundary',()=>{
  for(const file of ['../src/App.jsx','../src/components/PublicRealtorHub.jsx','../src/lib/hubPreview.js'])
    assert.match(readFileSync(new URL(file,import.meta.url),'utf8'),/profileForHub\(profile\)/);
});

async function fixture(){
  const db=new PGlite();
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT (auth.jwt()->>'sub')::uuid$$;
    GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY,slug text UNIQUE,plan text,
      is_published boolean DEFAULT false,homeowner_savings_visible boolean DEFAULT true,
      full_name text,email text,phone text,brokerage text,title text,city text,state text,
      headshot_url text,photo_url text,welcome_message text,bio text,website_url text,
      instagram_url text,facebook_url text,linkedin_url text,welcome_video_url text,
      video_url text,app_icon_initials text,app_initials text,
      profile_image_url text,image_url text,welcome text,website text);
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.profiles TO anon;
    GRANT SELECT,INSERT,UPDATE ON public.profiles TO authenticated;
    CREATE POLICY "Public can view published profiles" ON public.profiles FOR SELECT USING(is_published=true);
    CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid());
    CREATE POLICY "Users can create own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK(id=auth.uid());
    CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
    CREATE FUNCTION public.protect_profile_plan() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW;END$$;
    CREATE TRIGGER protect_profile_plan_before_insert BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_plan();
    CREATE TRIGGER protect_profile_plan_before_update BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_plan();`);
  for(const [table,policy,proOnly] of [
    ['vendors','Public can view vendors for published profiles',false],
    ['custom_hub_sections','Public can view active Pro custom hub sections',true],
    ['homeowner_checklist_items','Public can view active Pro checklist items',true],
    ['emergency_service_assignments','Public can read published emergency assignments',false],
  ]) {
    await db.exec(`CREATE TABLE public.${table}(id uuid DEFAULT gen_random_uuid(),profile_id uuid,is_active boolean DEFAULT true);
      ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
      GRANT SELECT ON public.${table} TO anon,authenticated;
      CREATE POLICY "${policy}" ON public.${table} FOR SELECT TO anon,authenticated USING(
        ${table==='emergency_service_assignments'?'true':'is_active=true'} AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=${table}.profile_id AND p.is_published=true ${proOnly?"AND p.plan='premier'":''}));`);
  }
  await db.exec(`CREATE TABLE public.hub_activity_events(id uuid DEFAULT gen_random_uuid(),profile_id uuid);
    ALTER TABLE public.hub_activity_events ENABLE ROW LEVEL SECURITY;
    GRANT INSERT ON public.hub_activity_events TO anon,authenticated;
    CREATE POLICY "Public can record published hub activity" ON public.hub_activity_events FOR INSERT TO anon,authenticated
      WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=hub_activity_events.profile_id AND p.is_published=true));`);
  for(const [id,plan] of [[free,'partner'],[core,'pro'],[pro,'premier']]) {
    await db.query('INSERT INTO public.profiles(id,slug,plan,is_published,full_name,headshot_url,photo_url,welcome_message,bio,website_url,welcome_video_url,video_url,app_icon_initials,app_initials) VALUES ($1,$2,$3,true,\'Owner\',\'saved-photo\',\'saved-legacy\',\'Saved welcome\',\'Saved bio\',\'https://example.invalid\',\'saved-video\',\'old-video\',\'CR\',\'XY\')',[id,plan,plan]);
  }
  return db;
}
async function actor(db,role,id,run){
  await db.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({role,sub:id,user_metadata:{plan:'premier'}})]);
  await db.exec(`SET ROLE ${role}`);
  try{return await run();}finally{await db.exec('RESET ROLE');await db.exec("SELECT set_config('request.jwt.claims','{}',false)");}
}
const denied=e=>e.code==='P0001'||e.code==='42501';
const publicProfile=(db,slug)=>db.query('SELECT public.get_public_realtor_profile($1) profile',[slug]);

test('database migration preserves existing paid values, blocks Free/alias tampering, and permits Core/Pro edits',async()=>{
  const db=await fixture();try{
    const before=(await db.query('SELECT * FROM public.profiles ORDER BY id')).rows;
    await db.exec(sql);
    assert.deepEqual((await db.query('SELECT * FROM public.profiles ORDER BY id')).rows,before);
    for(const plan of ['partner','free']) {
      await db.query('UPDATE public.profiles SET plan=$1 WHERE id=$2',[plan,free]);
      for(const field of fields)
        await assert.rejects(actor(db,'authenticated',free,()=>db.query(`UPDATE public.profiles SET ${field}='attempt' WHERE id=$1`,[free])),denied);
      await actor(db,'authenticated',free,()=>db.query("UPDATE public.profiles SET full_name='Updated' WHERE id=$1",[free]));
    }
    await assert.rejects(actor(db,'authenticated',free,()=>db.query("UPDATE public.profiles SET plan='premier' WHERE id=$1",[free])),/billing/);
    for(const plan of ['pro','core']) {
      await db.query('UPDATE public.profiles SET plan=$1 WHERE id=$2',[plan,core]);
      for(const field of CORE_BRANDING_FIELDS)await actor(db,'authenticated',core,()=>db.query(`UPDATE public.profiles SET ${field}='paid edit' WHERE id=$1`,[core]));
      for(const field of PRO_BRANDING_FIELDS)await assert.rejects(actor(db,'authenticated',core,()=>db.query(`UPDATE public.profiles SET ${field}='attempt' WHERE id=$1`,[core])),denied);
    }
    for(const field of fields)await actor(db,'authenticated',pro,()=>db.query(`UPDATE public.profiles SET ${field}='Pro edit' WHERE id=$1`,[pro]));
    for(const field of fields) {
      const id=crypto.randomUUID();
      await assert.rejects(actor(db,'authenticated',id,()=>db.query(`INSERT INTO public.profiles(id,plan,${field}) VALUES ($1,'premier','attempt')`,[id])),denied);
    }
    const signup=crypto.randomUUID();
    await actor(db,'authenticated',signup,()=>db.query("INSERT INTO public.profiles(id,plan) VALUES ($1,'premier')",[signup]));
    assert.equal((await db.query('SELECT plan FROM public.profiles WHERE id=$1',[signup])).rows[0].plan,'partner');
    await actor(db,'authenticated',signup,()=>db.query(`UPDATE public.profiles SET ${fields.map(f=>`${f}=''`).join(',')},full_name='Normal Free edit' WHERE id=$1`,[signup]));
    await assert.rejects(actor(db,'authenticated',free,()=>db.query("UPDATE public.profiles SET welcome_message='' WHERE id=$1",[free])),denied);
  }finally{await db.close();}
});

test('branding and vendor-helper fixes compose: a new Free profile still receives its internal standard vendor',async()=>{
  const db=await fixture();try{
    await db.exec(`ALTER TABLE public.vendors ADD COLUMN name text,ADD COLUMN category text,
      ADD COLUMN phone text,ADD COLUMN website text,ADD COLUMN recommendation text,
      ADD COLUMN sort_order integer DEFAULT 0,ADD COLUMN is_default boolean DEFAULT false,
      ADD COLUMN created_at timestamptz DEFAULT now(),ADD COLUMN updated_at timestamptz DEFAULT now();`);
    await db.exec(readFileSync(new URL('./fixtures/vendor-functions.sql',import.meta.url),'utf8'));
    await db.exec(`CREATE TRIGGER add_standard_vendor_after_profile_insert AFTER INSERT ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile_standard_vendor();
      CREATE TRIGGER enforce_vendor_plan_rules_before_insert BEFORE INSERT ON public.vendors
      FOR EACH ROW EXECUTE FUNCTION public.enforce_vendor_plan_rules();`);
    await db.exec(readFileSync(new URL('../supabase/migrations/20261019025425_restrict_standard_vendor_helper.sql',import.meta.url),'utf8'));
    await db.exec(sql);
    const id=crypto.randomUUID();
    await actor(db,'authenticated',id,()=>db.query("INSERT INTO public.profiles(id,slug,plan) VALUES ($1,'new-owner','premier')",[id]));
    assert.equal((await db.query('SELECT plan FROM public.profiles WHERE id=$1',[id])).rows[0].plan,'partner');
    assert.equal((await db.query('SELECT * FROM public.vendors WHERE profile_id=$1 AND is_default',[id])).rows.length,1);
    await assert.rejects(actor(db,'authenticated',id,()=>db.query('SELECT public.add_standard_close_relax_vendor($1)',[pro])),e=>e.code==='42501');
    for(const [profileId,limit] of [[id,5],[core,15],[pro,30]])assert.equal((await db.query('SELECT public.vendor_plan_limit($1) lim',[profileId])).rows[0].lim,limit);
  }finally{await db.close();}
});

test('downgrade retains branding for owner/re-upgrade while anonymous and other-account raw reads reveal nothing',async()=>{
  const db=await fixture();try{
    await db.exec(sql);
    for(const target of ['pro','partner']) {
      await db.query('UPDATE public.profiles SET plan=$1 WHERE id=$2',[target,pro]);
      const owner=(await actor(db,'authenticated',pro,()=>db.query('SELECT * FROM public.profiles WHERE id=$1',[pro]))).rows[0];
      assert.equal(owner.photo_url,'saved-legacy');assert.equal(owner.welcome_message,'Saved welcome');assert.equal(owner.welcome_video_url,'saved-video');
      for(const [role,id] of [['anon',null],['authenticated',free]]) {
        assert.equal((await actor(db,role,id,()=>db.query('SELECT * FROM public.profiles WHERE id=$1',[pro]))).rows.length,0);
        const view=(await actor(db,role,id,()=>publicProfile(db,'premier'))).rows[0].profile;
        assert.equal(view.photo_url,target==='pro'?'saved-legacy':null);
        assert.equal(view.welcome_message,target==='pro'?'Saved welcome':null);
        assert.equal(view.welcome_video_url,null);assert.equal(view.video_url,null);assert.equal(view.app_initials,null);
        assert.ok(!Object.hasOwn(view,'profile_image_url'));
      }
    }
    await db.query("UPDATE public.profiles SET plan='premier' WHERE id=$1",[pro]);
    const upgraded=(await actor(db,'anon',null,()=>publicProfile(db,'premier'))).rows[0].profile;
    assert.equal(upgraded.photo_url,'saved-legacy');assert.equal(upgraded.welcome_message,'Saved welcome');assert.equal(upgraded.welcome_video_url,'saved-video');
    await db.query('UPDATE public.profiles SET is_published=false WHERE id=$1',[pro]);
    assert.equal((await actor(db,'anon',null,()=>publicProfile(db,'premier'))).rows[0].profile,null);
    assert.equal((await actor(db,'authenticated',pro,()=>publicProfile(db,'premier'))).rows[0].profile,null);
    assert.equal((await actor(db,'anon',null,()=>publicProfile(db,'missing'))).rows[0].profile,null);
  }finally{await db.close();}
});

test('child publication, Pro gates, active flags, and analytics writes survive removal of raw public profile reads',async()=>{
  const db=await fixture();try{
    const tables=['vendors','custom_hub_sections','homeowner_checklist_items','emergency_service_assignments'];
    for(const table of tables)for(const id of [free,core,pro])await db.query(`INSERT INTO public.${table}(profile_id) VALUES ($1)`,[id]);
    await db.exec(sql);
    for(const [role,id] of [['anon',null],['authenticated',free]]) {
      await actor(db,role,id,async()=>{
        for(const table of tables){const rows=(await db.query(`SELECT * FROM public.${table}`)).rows;assert.equal(rows.length,['vendors','emergency_service_assignments'].includes(table)?3:1);}
        await db.query('INSERT INTO public.hub_activity_events(profile_id) VALUES ($1)',[pro]);
      });
    }
    await db.query('UPDATE public.profiles SET is_published=false WHERE id=$1',[pro]);
    await actor(db,'anon',null,async()=>{
      for(const table of tables)assert.equal((await db.query(`SELECT * FROM public.${table} WHERE profile_id=$1`,[pro])).rows.length,0);
      await assert.rejects(db.query('INSERT INTO public.hub_activity_events(profile_id) VALUES ($1)',[pro]),denied);
      assert.equal((await db.query('SELECT public.is_published_hub($1) published',[pro])).rows[0].published,false);
    });
    await db.query('UPDATE public.vendors SET is_active=false WHERE profile_id=$1',[core]);
    assert.equal((await actor(db,'anon',null,()=>db.query('SELECT * FROM public.vendors WHERE profile_id=$1',[core]))).rows.length,0);
  }finally{await db.close();}
});
