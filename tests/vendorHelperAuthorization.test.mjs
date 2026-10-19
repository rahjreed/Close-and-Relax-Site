import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = readFileSync(new URL('../supabase/migrations/20261019025425_restrict_standard_vendor_helper.sql', import.meta.url), 'utf8');
const functions = readFileSync(new URL('./fixtures/vendor-functions.sql', import.meta.url), 'utf8');
const free = '00000000-0000-4000-8000-000000000001';
const core = '00000000-0000-4000-8000-000000000002';
const pro = '00000000-0000-4000-8000-000000000003';
const victim = '00000000-0000-4000-8000-000000000004';
const newcomer = '00000000-0000-4000-8000-000000000005';

// Minimal table/Auth setup plus verbatim inspected production function bodies.
// Only this isolated in-memory database receives writes during these tests.
async function fixture(secured = true) {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY,plan text NOT NULL,is_published boolean DEFAULT false);
    CREATE TABLE public.vendors(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),profile_id uuid NOT NULL REFERENCES public.profiles(id),
      name text,category text,phone text,website text,recommendation text,sort_order integer DEFAULT 0,
      is_active boolean DEFAULT true,is_default boolean DEFAULT false,
      created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
  `);
  await db.exec(functions);
  await db.exec(readFileSync(new URL('./fixtures/vendor-updated-at.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../supabase/migrations/20261019181529_harden_vendor_updated_at_search_path.sql', import.meta.url), 'utf8'));
  await db.exec(`
    GRANT EXECUTE ON FUNCTION public.add_standard_close_relax_vendor(uuid) TO PUBLIC,anon,authenticated,service_role;
    REVOKE EXECUTE ON FUNCTION public.restore_close_relax_standard_vendor() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.restore_close_relax_standard_vendor() TO anon,authenticated,service_role;
    CREATE TRIGGER add_standard_vendor_after_profile_insert AFTER INSERT ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile_standard_vendor();
    CREATE TRIGGER enforce_vendor_plan_rules_before_insert BEFORE INSERT ON public.vendors
      FOR EACH ROW EXECUTE FUNCTION public.enforce_vendor_plan_rules();
    CREATE TRIGGER enforce_vendor_plan_rules_before_update BEFORE UPDATE ON public.vendors
      FOR EACH ROW EXECUTE FUNCTION public.enforce_vendor_plan_rules();
    CREATE TRIGGER enforce_vendor_plan_rules_before_delete BEFORE DELETE ON public.vendors
      FOR EACH ROW EXECUTE FUNCTION public.enforce_vendor_plan_rules();
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
    GRANT SELECT,INSERT,UPDATE ON public.profiles TO authenticated;
    GRANT SELECT ON public.profiles TO anon;
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.vendors TO anon,authenticated;
    CREATE POLICY "Public can view published profiles" ON public.profiles FOR SELECT USING(is_published=true);
    CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING(auth.uid()=id);
    CREATE POLICY "Users can create own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK(auth.uid()=id);
    CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING(auth.uid()=id) WITH CHECK(auth.uid()=id);
    CREATE POLICY "Public can view vendors for published profiles" ON public.vendors FOR SELECT TO anon,authenticated
      USING(is_active=true AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=vendors.profile_id AND p.is_published=true));
    CREATE POLICY "Users can view their own vendors" ON public.vendors FOR SELECT TO authenticated USING(profile_id=auth.uid());
    CREATE POLICY "Users can create their own vendors" ON public.vendors FOR INSERT TO authenticated WITH CHECK(profile_id=auth.uid() AND is_default=false);
    CREATE POLICY "Users can update their own vendors" ON public.vendors FOR UPDATE TO authenticated
      USING(profile_id=auth.uid() AND (is_default=false OR coalesce(public.vendor_plan_allows_default_control(profile_id),false))) WITH CHECK(profile_id=auth.uid());
    CREATE POLICY "Users can delete their own vendors" ON public.vendors FOR DELETE TO authenticated
      USING(profile_id=auth.uid() AND (is_default=false OR coalesce(public.vendor_plan_allows_default_control(profile_id),false)));
  `);
  await db.query("INSERT INTO public.profiles(id,plan) VALUES ($1,'partner'),($2,'pro'),($3,'premier'),($4,'premier')", [free,core,pro,victim]);
  if (secured) await db.exec(migration);
  return db;
}
async function asRole(db, role, userId, run) {
  assert.ok(['anon','authenticated'].includes(role));
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [userId || '']);
  await db.exec(`SET ROLE ${role}`);
  try { return await run(); }
  finally { await db.exec('RESET ROLE'); }
}
const countDefaults = async (db,id) => Number((await db.query('SELECT count(*) AS n FROM public.vendors WHERE profile_id=$1 AND is_default', [id])).rows[0].n);
const permissionDenied = error => error.code === '42501';

test('regression reproduces cross-profile anonymous helper write before the ACL fix', async () => {
  const db=await fixture(false);
  try {
    await db.query('DELETE FROM public.vendors WHERE profile_id=$1',[victim]);
    await asRole(db,'anon',null,()=>db.query('SELECT public.add_standard_close_relax_vendor($1)',[victim]));
    assert.equal(await countDefaults(db,victim),1);
  } finally { await db.close(); }
});

test('anon and authenticated cannot execute the helper for own, foreign, or nonexistent profiles', async () => {
  const db=await fixture();
  try {
    await db.query('DELETE FROM public.vendors WHERE profile_id=$1',[victim]);
    for (const [role,id] of [['anon',null],['authenticated',free],['authenticated',core],['authenticated',pro]]) {
      for (const target of [id || free,victim,newcomer]) {
        await assert.rejects(asRole(db,role,id,()=>db.query('SELECT public.add_standard_close_relax_vendor($1)',[target])),permissionDenied);
      }
    }
    assert.equal(await countDefaults(db,victim),0);
    for (const role of ['anon','authenticated']) {
      assert.equal((await db.query("SELECT has_function_privilege($1,'public.add_standard_close_relax_vendor(uuid)','EXECUTE') allowed",[role])).rows[0].allowed,false);
    }
    assert.equal((await db.query("SELECT has_function_privilege('service_role','public.add_standard_close_relax_vendor(uuid)','EXECUTE') allowed")).rows[0].allowed,true);
  } finally { await db.close(); }
});

test('ordinary owner profile creation still adds exactly one standard vendor through the privileged trigger', async () => {
  const db=await fixture();
  try {
    await asRole(db,'authenticated',newcomer,()=>db.query("INSERT INTO public.profiles(id,plan) VALUES ($1,'partner')",[newcomer]));
    assert.equal(await countDefaults(db,newcomer),1);
    await asRole(db,'authenticated',newcomer,()=>db.query('UPDATE public.profiles SET is_published=true WHERE id=$1',[newcomer]));
    assert.equal(await countDefaults(db,newcomer),1);
    await assert.rejects(asRole(db,'authenticated',free,()=>db.query("INSERT INTO public.profiles(id,plan) VALUES ($1,'partner')",['00000000-0000-4000-8000-000000000099'])),permissionDenied);
  } finally { await db.close(); }
});

test('authorized Pro restoration remains owner-only and idempotent; Free/Core/anon are rejected', async () => {
  const db=await fixture();
  try {
    await db.query('DELETE FROM public.vendors WHERE profile_id IN ($1,$2)',[pro,victim]);
    for (const [role,id] of [['anon',null],['authenticated',free],['authenticated',core]]) {
      await assert.rejects(asRole(db,role,id,()=>db.query('SELECT public.restore_close_relax_standard_vendor()')), /signed in|requires Pro/);
    }
    const restore=()=>asRole(db,'authenticated',pro,()=>db.query('SELECT * FROM public.restore_close_relax_standard_vendor()'));
    const first=(await restore()).rows[0],second=(await restore()).rows[0];
    assert.equal(first.profile_id,pro);assert.equal(first.id,second.id);
    assert.equal(await countDefaults(db,pro),1);assert.equal(await countDefaults(db,victim),0);
    await assert.rejects(asRole(db,'authenticated',pro,()=>db.query('SELECT public.restore_close_relax_standard_vendor($1::uuid)',[victim])),error=>error.code==='42883');
    assert.equal(await countDefaults(db,victim),0);
  } finally { await db.close(); }
});

test('owner vendor CRUD, publication RLS, standard-vendor restrictions and 5/15/30 limits still work', async () => {
  const db=await fixture();
  try {
    for (const [id,limit] of [[free,5],[core,15],[pro,30]]) {
      assert.equal((await db.query('SELECT public.vendor_plan_limit($1) lim',[id])).rows[0].lim,limit);
      await asRole(db,'authenticated',id,async()=>{
        for(let i=0;i<limit;i++)await db.query("INSERT INTO public.vendors(profile_id,name) VALUES ($1,$2)",[id,`Custom ${i}`]);
        await assert.rejects(db.query("INSERT INTO public.vendors(profile_id,name) VALUES ($1,'Overflow')",[id]),new RegExp(`up to ${limit}`));
        const row=(await db.query('SELECT id FROM public.vendors WHERE profile_id=$1 AND NOT is_default LIMIT 1',[id])).rows[0];
        await db.query("UPDATE public.vendors SET name='Edited' WHERE id=$1",[row.id]);
        await db.query('DELETE FROM public.vendors WHERE id=$1',[row.id]);
      });
    }
    await assert.rejects(asRole(db,'authenticated',free,()=>db.query("INSERT INTO public.vendors(profile_id,name,is_default) VALUES ($1,'Injected',true)",[victim])),permissionDenied);
    await assert.rejects(asRole(db,'authenticated',free,()=>db.query("INSERT INTO public.vendors(profile_id,name) VALUES ($1,'Injected')",[victim])),permissionDenied);
    await asRole(db,'authenticated',free,async()=>{
      assert.equal((await db.query("UPDATE public.vendors SET name='Foreign' WHERE profile_id=$1 RETURNING id",[victim])).rows.length,0);
      assert.equal((await db.query('DELETE FROM public.vendors WHERE profile_id=$1 RETURNING id',[victim])).rows.length,0);
      assert.equal((await db.query('DELETE FROM public.vendors WHERE profile_id=$1 AND is_default RETURNING id',[free])).rows.length,0);
    });
    assert.equal((await asRole(db,'anon',null,()=>db.query('SELECT * FROM public.profiles'))).rows.length,0);
    assert.equal((await asRole(db,'anon',null,()=>db.query('SELECT * FROM public.vendors'))).rows.length,0);
    await asRole(db,'authenticated',free,()=>db.query('UPDATE public.profiles SET is_published=true WHERE id=$1',[free]));
    assert.ok((await asRole(db,'anon',null,()=>db.query('SELECT * FROM public.vendors'))).rows.every(row=>row.profile_id===free));
  } finally { await db.close(); }
});

test('permission migration is repeatable and leaves function bodies, Pro RPC grants, RLS and triggers unchanged', async () => {
  const db=await fixture(false);
  try {
    const snapshot=async()=>({
      functions:(await db.query("SELECT proname,pg_get_functiondef(oid) def FROM pg_proc WHERE pronamespace='public'::regnamespace ORDER BY proname")).rows,
      restore:(await db.query("SELECT proacl::text acl FROM pg_proc WHERE oid='public.restore_close_relax_standard_vendor()'::regprocedure")).rows,
      policies:(await db.query('SELECT * FROM pg_policies ORDER BY schemaname,tablename,policyname')).rows,
      triggers:(await db.query('SELECT pg_get_triggerdef(oid) def FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname')).rows,
      rls:(await db.query("SELECT relname,relrowsecurity FROM pg_class WHERE oid IN ('public.profiles'::regclass,'public.vendors'::regclass) ORDER BY relname")).rows,
    });
    const before=await snapshot();await db.exec(migration);await db.exec(migration);
    assert.deepEqual(await snapshot(),before);
  } finally { await db.close(); }
});
