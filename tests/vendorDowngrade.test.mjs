import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {vendorsForHub,compareVendorOrder,vendorLimitForPlan,loadHubVendors} from '../src/lib/vendorVisibility.js';
const a='00000000-0000-4000-8000-000000000021',b='00000000-0000-4000-8000-000000000022',c='00000000-0000-4000-8000-000000000023';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const migration=read('../supabase/migrations/20261019034056_enforce_vendor_downgrade_visibility.sql');
const rows=Array.from({length:40},(_,i)=>({id:`${i}`.padStart(3,'0'),sort_order:i,created_at:'2026-10-01T00:00:00Z',is_active:true,is_default:false,recommendation:'Saved note'}));

test('client presentation caps active custom rows at 5/15/30 without changing saved data',()=>{
  for(const [plan,limit] of [['partner',5],['free',5],['pro',15],['core',15],['premier',30]]) {
    const result=vendorsForHub(rows,plan);assert.equal(result.length,limit);assert.equal(vendorLimitForPlan(plan),limit);
    assert.equal(result[0].recommendation,['partner','free'].includes(plan)?null:'Saved note');
  }
  assert.equal(rows.length,40);assert.equal(rows[0].recommendation,'Saved note');
  assert.deepEqual(vendorsForHub(rows.map((r,i)=>({...r,is_active:i>=3})),'free').map(v=>v.id),['003','004','005','006','007']);
});
test('deterministic ordering uses saved sort, creation time, then ID; standard does not consume a slot',()=>{
  const tied=[{...rows[1],sort_order:0},{...rows[0],sort_order:0}].sort(compareVendorOrder);
  assert.deepEqual(tied.map(v=>v.id),['000','001']);
  assert.ok(compareVendorOrder({...rows[0],created_at:'2026-10-01T00:00:00.000002Z'},{...rows[1],sort_order:0,created_at:'2026-10-01T00:00:00.000001Z'})>0);
  const standard={...rows[39],id:'standard',is_default:true,sort_order:100};
  assert.equal(vendorsForHub([...rows,standard],'free').length,6);
  assert.equal(vendorsForHub([...rows,standard],'free')[0].id,'standard');
  assert.deepEqual(vendorsForHub([],'premier'),[]);
});
test('hub loading uses the effective RPC and fails closed for foreign rows/errors',async()=>{
  const client={rpc:async(name,args)=>{assert.equal(name,'get_hub_vendors');assert.deepEqual(args,{hub_profile_id:a});return {data:[{profile_id:a,is_active:true}]};}};
  assert.equal((await loadHubVendors(client,a)).length,1);
  for(const response of [{data:[{profile_id:b}]},{data:null},{error:{}}])await assert.rejects(loadHubVendors({rpc:async()=>response},a));
  const renderer=read('../src/components/PublicRealtorHub.jsx');
  assert.match(renderer,/Array\.isArray\(profile\?\.vendors\) \|\| storedVendors\.length > 0/);
});

async function actor(db,role,id,run){
  await db.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({role,sub:id,user_metadata:{plan:'premier'}})]);
  await db.exec(`SET ROLE ${role}`);
  try{return await run();}finally{await db.exec('RESET ROLE');await db.exec("SELECT set_config('request.jwt.claims','{}',false)");}
}
const denied=e=>['42501','P0001'].includes(e.code);
const view=async(db,id,role='anon',caller=null)=>(await actor(db,role,caller,()=>db.query('SELECT public.get_hub_vendors($1) vendors',[id]))).rows[0].vendors;
const customs=list=>list.filter(v=>!v.is_default);
const saved=async(db,id)=>(await db.query('SELECT * FROM public.vendors WHERE profile_id=$1 ORDER BY id',[id])).rows;
async function fixture(count=30){
  const db=new PGlite();
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT (auth.jwt()->>'sub')::uuid$$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY,slug text UNIQUE,plan text,is_published boolean DEFAULT true,
      homeowner_savings_visible boolean DEFAULT true,full_name text,email text,phone text,brokerage text,title text,city text,state text,
      headshot_url text,photo_url text,welcome_message text,bio text,website_url text,instagram_url text,facebook_url text,linkedin_url text,
      welcome_video_url text,video_url text,app_icon_initials text,app_initials text);
    CREATE TABLE public.vendors(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),profile_id uuid REFERENCES public.profiles(id),
      name text NOT NULL,category text NOT NULL,phone text,website text,recommendation text,sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,is_default boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz DEFAULT now());
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.profiles TO anon;GRANT SELECT,INSERT,UPDATE ON public.profiles TO authenticated;
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.vendors TO anon,authenticated;
    CREATE POLICY "Public can view published profiles" ON public.profiles FOR SELECT USING(is_published=true);
    CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid());
    CREATE POLICY "Users can create own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK(id=auth.uid());
    CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
    CREATE POLICY "Public can view vendors for published profiles" ON public.vendors FOR SELECT TO anon,authenticated
      USING(is_active AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=vendors.profile_id AND p.is_published));
    CREATE POLICY "Users can view their own vendors" ON public.vendors FOR SELECT TO authenticated USING(profile_id=auth.uid());
    CREATE POLICY "Users can create their own vendors" ON public.vendors FOR INSERT TO authenticated WITH CHECK(profile_id=auth.uid() AND NOT is_default);
  `);
  await db.exec(read('./fixtures/vendor-functions.sql'));
  await db.exec(`CREATE POLICY "Users can update their own vendors" ON public.vendors FOR UPDATE TO authenticated
      USING(profile_id=auth.uid() AND (NOT is_default OR coalesce(public.vendor_plan_allows_default_control(profile_id),false))) WITH CHECK(profile_id=auth.uid());
    CREATE POLICY "Users can delete their own vendors" ON public.vendors FOR DELETE TO authenticated
      USING(profile_id=auth.uid() AND (NOT is_default OR coalesce(public.vendor_plan_allows_default_control(profile_id),false)));
    CREATE TRIGGER add_standard_vendor_after_profile_insert AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile_standard_vendor();
    CREATE FUNCTION public.protect_profile_plan() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW;END$$;
    CREATE TRIGGER protect_profile_plan_before_insert BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_plan();
    CREATE TRIGGER protect_profile_plan_before_update BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_plan();`);
  for(const [id,plan,n] of [[a,'premier',count],[b,'premier',0],[c,'pro',15]]) {
    await db.query('INSERT INTO public.profiles(id,slug,plan) VALUES ($1,$2,$3)',[id,id,plan]);
    for(let i=0;i<n;i++)await db.query("INSERT INTO public.vendors(profile_id,name,category,sort_order,recommendation,created_at) VALUES ($1,$2,'Plumbing',$3,'Saved paid note','2026-10-01')",[id,`Vendor ${i}`,i+1]);
  }
  for(const [table,policy,proOnly] of [['custom_hub_sections','Public can view active Pro custom hub sections',true],['homeowner_checklist_items','Public can view active Pro checklist items',true],['emergency_service_assignments','Public can read published emergency assignments',false]]) {
    await db.exec(`CREATE TABLE public.${table}(profile_id uuid,is_active boolean);
      ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "${policy}" ON public.${table} FOR SELECT TO anon,authenticated USING(is_active AND EXISTS(
        SELECT 1 FROM public.profiles p WHERE p.id=${table}.profile_id AND p.is_published ${proOnly?"AND p.plan='premier'":''}));`);
  }
  await db.exec(`CREATE TABLE public.hub_activity_events(profile_id uuid);ALTER TABLE public.hub_activity_events ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Public can record published hub activity" ON public.hub_activity_events FOR INSERT TO anon,authenticated
      WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=hub_activity_events.profile_id AND p.is_published));
    CREATE TRIGGER enforce_vendor_plan_rules_before_insert BEFORE INSERT ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.enforce_vendor_plan_rules();
    CREATE TRIGGER enforce_vendor_plan_rules_before_update BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.enforce_vendor_plan_rules();
    CREATE TRIGGER enforce_vendor_plan_rules_before_delete BEFORE DELETE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.enforce_vendor_plan_rules();`);
  await db.exec(read('../supabase/migrations/20261019025425_restrict_standard_vendor_helper.sql'));
  await db.exec(read('../supabase/migrations/20261019032658_enforce_profile_branding.sql'));
  return db;
}

test('Pro→Core, Pro→Free, Core→Free and re-upgrade cap public rows without changing saved vendor records',async()=>{
  const db=await fixture();try{
    await db.exec(migration);
    for(const [id,start,target,limit,total] of [[a,'premier','pro',15,30],[a,'premier','partner',5,30],[c,'pro','partner',5,15]]) {
      await db.query('UPDATE public.profiles SET plan=$1 WHERE id=$2',[start,id]);
      const before=await saved(db,id);
      await db.query('UPDATE public.profiles SET plan=$1 WHERE id=$2',[target,id]);
      const publicRows=await view(db,id);
      assert.equal(customs(publicRows).length,limit);assert.equal(publicRows.filter(v=>v.is_default).length,1);
      assert.deepEqual(await saved(db,id),before);
      assert.equal((await actor(db,'anon',null,()=>db.query('SELECT * FROM public.vendors WHERE profile_id=$1',[id]))).rows.length,0);
      assert.equal((await actor(db,'authenticated',id===a?c:a,()=>db.query('SELECT * FROM public.vendors WHERE profile_id=$1',[id]))).rows.length,0);
      assert.equal((await actor(db,'authenticated',id,()=>db.query('SELECT * FROM public.vendors WHERE profile_id=$1 AND NOT is_default',[id]))).rows.length,total);
      assert.equal(customs(await view(db,id,'authenticated',id)).length,limit,'signed-in public/preview view must also be capped');
      await db.query('UPDATE public.profiles SET plan=$1 WHERE id=$2',[start,id]);
      assert.equal(customs(await view(db,id)).length,total);
    }
  }finally{await db.close();}
});

test('existing over-limit data, reorder, inactive/reactivated rows, edited notes and insert/default-flag attacks cannot exceed the cap',async()=>{
  const db=await fixture(40);try{
    await db.exec(migration);await db.query("UPDATE public.profiles SET plan='partner' WHERE id=$1",[a]);
    const before=await saved(db,a),all=before.filter(v=>!v.is_default).sort(compareVendorOrder);
    for(const row of all.slice(0,3))await actor(db,'authenticated',a,()=>db.query('UPDATE public.vendors SET is_active=false WHERE id=$1',[row.id]));
    assert.deepEqual(customs(await view(db,a)).map(v=>v.id),all.slice(3,8).map(v=>v.id));
    const moved=all[39];
    await actor(db,'authenticated',a,()=>db.query('UPDATE public.vendors SET sort_order=-100 WHERE id=$1',[moved.id]));
    assert.equal(customs(await view(db,a))[0].id,moved.id);
    await actor(db,'authenticated',a,()=>db.query('UPDATE public.vendors SET is_active=true,sort_order=-200 WHERE id=$1',[all[0].id]));
    assert.equal(customs(await view(db,a)).length,5);assert.equal(customs(await view(db,a))[0].id,all[0].id);
    await actor(db,'authenticated',a,()=>db.query("UPDATE public.vendors SET name='Edited safely' WHERE id=$1",[moved.id]));
    assert.equal((await db.query('SELECT recommendation FROM public.vendors WHERE id=$1',[moved.id])).rows[0].recommendation,'Saved paid note');
    assert.ok(customs(await view(db,a)).every(v=>v.recommendation===null));
    await assert.rejects(actor(db,'authenticated',a,()=>db.query("UPDATE public.vendors SET recommendation='Free edit' WHERE id=$1",[moved.id])),denied);
    await assert.rejects(actor(db,'authenticated',a,()=>db.query("INSERT INTO public.vendors(profile_id,name,category,is_active) VALUES ($1,'New','Plumbing',false)",[a])),/up to 5/);
    await assert.rejects(actor(db,'authenticated',a,()=>db.query('UPDATE public.vendors SET is_default=true WHERE id=$1',[moved.id])),/designation/);
    await assert.rejects(actor(db,'authenticated',a,()=>db.query('UPDATE public.vendors SET profile_id=$1 WHERE id=$2',[b,moved.id])),/moved/);
    await assert.rejects(actor(db,'authenticated',a,()=>db.query("INSERT INTO public.vendors(profile_id,name,category,is_default) VALUES ($1,'Injected','Plumbing',true)",[a])),denied);
    assert.equal((await saved(db,a)).length,before.length);
  }finally{await db.close();}
});

test('removed or inactive/customized Pro standard resource reappears canonically on Free/Core without overwriting saved Pro choices',async()=>{
  const db=await fixture();try{
    await db.exec(migration);
    await actor(db,'authenticated',a,()=>db.query('DELETE FROM public.vendors WHERE profile_id=$1 AND is_default',[a]));
    assert.equal((await view(db,a)).filter(v=>v.is_default).length,0);
    for(const plan of ['pro','partner']) {
      await db.query('UPDATE public.profiles SET plan=$1 WHERE id=$2',[plan,a]);
      const standard=(await view(db,a)).filter(v=>v.is_default);
      assert.equal(standard.length,1);assert.equal(standard[0].name,'Roger With Vivint');assert.equal(standard[0].phone,'463-281-3454');
      assert.match(standard[0].id,/^platform-standard-/);
      assert.equal((await db.query('SELECT * FROM public.vendors WHERE profile_id=$1 AND is_default',[a])).rows.length,0);
    }
    await db.query("UPDATE public.profiles SET plan='premier' WHERE id=$1",[a]);
    assert.equal((await view(db,a)).filter(v=>v.is_default).length,0);
    await actor(db,'authenticated',b,()=>db.query("UPDATE public.vendors SET name='Pro personal version',is_active=false WHERE profile_id=$1 AND is_default",[b]));
    const preserved=await saved(db,b);
    await db.query("UPDATE public.profiles SET plan='partner' WHERE id=$1",[b]);
    assert.equal((await view(db,b))[0].name,'Roger With Vivint');assert.deepEqual(await saved(db,b),preserved);
    await db.query("UPDATE public.profiles SET plan='premier' WHERE id=$1",[b]);
    assert.deepEqual(await view(db,b),[]);
    await actor(db,'authenticated',b,()=>db.query('UPDATE public.vendors SET is_active=true WHERE profile_id=$1 AND is_default',[b]));
    assert.equal((await view(db,b))[0].name,'Pro personal version');
    await actor(db,'authenticated',a,()=>db.query('SELECT public.restore_close_relax_standard_vendor()'));
    assert.equal((await view(db,a)).filter(v=>v.is_default).length,1);
  }finally{await db.close();}
});

test('only the owner can preview draft vendors; migration preserves rows, standard restore RPC and limit function',async()=>{
  const db=await fixture();try{
    const snapshot=async()=>({rows:await saved(db,a),restore:(await db.query("SELECT pg_get_functiondef('public.restore_close_relax_standard_vendor()'::regprocedure) def")).rows,limit:(await db.query("SELECT pg_get_functiondef('public.vendor_plan_limit(uuid)'::regprocedure) def")).rows});
    const before=await snapshot();await db.exec(migration);assert.deepEqual(await snapshot(),before);
    await db.query('UPDATE public.profiles SET is_published=false WHERE id=$1',[a]);
    assert.deepEqual(await view(db,a),[]);assert.deepEqual(await view(db,a,'authenticated',c),[]);
    assert.equal(customs(await view(db,a,'authenticated',a)).length,30);
    await assert.rejects(actor(db,'authenticated',c,()=>db.query('SELECT public.add_standard_close_relax_vendor($1)',[a])),e=>e.code==='42501');
    assert.match(migration,/FROM public\.profiles p WHERE p\.id=target_id FOR UPDATE/);
    assert.match(migration,/REVOKE ALL ON FUNCTION public\.get_hub_vendors\(uuid\) FROM PUBLIC/);
  }finally{await db.close();}
});
