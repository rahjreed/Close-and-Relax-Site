import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const read = (path) => readFileSync(new URL(path,import.meta.url),'utf8');
const migration = read('../supabase/migrations/20261019181529_harden_vendor_updated_at_search_path.sql');
const owner = '00000000-0000-4000-8000-000000000101';
async function fixture() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
    CREATE TABLE public.vendors(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),profile_id uuid,name text,
      created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
    ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
    GRANT SELECT,INSERT,UPDATE ON public.vendors TO authenticated;
    CREATE POLICY own_read ON public.vendors FOR SELECT TO authenticated USING(profile_id='${owner}'::uuid);
    CREATE POLICY own_insert ON public.vendors FOR INSERT TO authenticated WITH CHECK(profile_id='${owner}'::uuid);
    CREATE POLICY own_update ON public.vendors FOR UPDATE TO authenticated USING(profile_id='${owner}'::uuid) WITH CHECK(profile_id='${owner}'::uuid);
    CREATE FUNCTION public.unrelated_helper() RETURNS integer LANGUAGE sql AS $$SELECT 1$$;
    REVOKE ALL ON FUNCTION public.unrelated_helper() FROM PUBLIC,anon,authenticated,service_role;`);
  await db.exec(read('./fixtures/vendor-updated-at.sql'));
  return db;
}
async function asAuthenticated(db,run) {
  await db.exec('SET ROLE authenticated');
  try { return await run(); } finally { await db.exec('RESET ROLE'); }
}
const functions = async (db) => (await db.query(`SELECT p.oid,p.proname,p.prosrc,p.proowner,p.proacl::text,p.prosecdef,p.provolatile,p.prorettype,p.proconfig
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.oid`)).rows;
const triggers = async (db) => (await db.query("SELECT oid,tgfoid,tgenabled,pg_get_triggerdef(oid) definition FROM pg_trigger WHERE tgrelid='public.vendors'::regclass AND NOT tgisinternal")).rows;

test('search_path-only ALTER preserves function identity/body/owner/grants and all trigger/policy metadata; caller paths cannot shadow now()', async () => {
  const db = await fixture();
  try {
    const before = await functions(db), attached = await triggers(db);
    const policies = (await db.query('SELECT * FROM pg_policies ORDER BY policyname')).rows;
    assert.equal(before.find(p=>p.proname==='set_vendor_updated_at').proconfig,null);
    await db.exec(migration); await db.exec(migration);
    const after = await functions(db);
    for (const p of after) {
      const old = before.find(f=>f.oid===p.oid);
      if (p.proname==='set_vendor_updated_at') {
        assert.deepEqual(p.proconfig,['search_path=""']);
        assert.deepEqual({...p,proconfig:old.proconfig},old);
        assert.equal(p.prosecdef,false);
      } else assert.deepEqual(p,old);
    }
    assert.equal(after.length,before.length);
    assert.deepEqual(await triggers(db),attached);
    assert.deepEqual((await db.query('SELECT * FROM pg_policies ORDER BY policyname')).rows,policies);
    // A writable schema can define a conflicting builtin name. The fixed path
    // must ignore this even when the caller explicitly places pg_catalog last.
    await db.exec(`CREATE FUNCTION public.now() RETURNS timestamptz LANGUAGE sql AS $$SELECT '1900-01-01'::timestamptz$$;
      SET search_path=public,pg_catalog;
      INSERT INTO public.vendors(id,profile_id,name,updated_at) VALUES ('${owner}','${owner}','Original','2000-01-01');`);
    await asAuthenticated(db,async()=>{
      const result = await db.query("UPDATE public.vendors SET name='Edited' RETURNING updated_at=pg_catalog.now() AS correct");
      assert.deepEqual(result.rows,[{correct:true}]);
      await assert.rejects(db.exec('SELECT public.set_vendor_updated_at()'),/trigger functions can only be called as triggers/);
      await assert.rejects(db.exec('SELECT public.unrelated_helper()'),e=>e.code==='42501');
    });
  } finally { await db.close(); }
});

test('vendor inserts, ordinary edits, no-op/multi-row updates and supplied timestamps behave identically before and after hardening', async () => {
  for (const hardened of [false,true]) {
    const db = await fixture();
    try {
      if (hardened) await db.exec(migration);
      await asAuthenticated(db,async()=>{
        assert.deepEqual((await db.query(`INSERT INTO public.vendors(profile_id,name) VALUES ($1,'Default timestamps')
          RETURNING created_at=pg_catalog.now() AS created,updated_at=pg_catalog.now() AS updated`,[owner])).rows,[{created:true,updated:true}]);
        const row = (await db.query(`INSERT INTO public.vendors(profile_id,name,created_at,updated_at)
          VALUES ($1,'Saved vendor','2000-01-01','2001-01-01') RETURNING id,created_at,updated_at`,[owner])).rows[0];
        assert.equal(new Date(row.updated_at).getUTCFullYear(),2001); // INSERT never invokes UPDATE trigger.
        for (const changes of ["name='Changed'","name=name","updated_at='1900-01-01'","updated_at=NULL"])
          assert.deepEqual((await db.query(`UPDATE public.vendors SET ${changes} WHERE id=$1
            RETURNING updated_at=pg_catalog.now() AS correct,created_at=$2::timestamptz AS preserved`,[row.id,row.created_at])).rows,[{correct:true,preserved:true}]);
        assert.deepEqual((await db.query("UPDATE public.vendors SET name=name RETURNING updated_at=pg_catalog.now() AS correct")).rows,[{correct:true},{correct:true}]);
      });
    } finally { await db.close(); }
  }
});
