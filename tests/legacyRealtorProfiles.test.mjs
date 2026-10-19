import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { HISTORICAL_MAPPINGS } from '../tools/prepare-pre-stripe-release.mjs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const migration = read('../supabase/migrations/20261019175354_deprecate_legacy_realtor_profiles.sql');
const owner = '00000000-0000-4000-8000-000000000081';
const other = '00000000-0000-4000-8000-000000000082';
async function fixture() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    INSERT INTO auth.users VALUES ('${owner}'),('${other}');`);
  await db.exec(read('./fixtures/legacy-realtor-profiles.sql'));
  return db;
}
async function actor(db, role, run, user = owner) {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec(`SET ROLE ${role}`);
  try { return await run(); } finally { await db.exec('RESET ROLE'); }
}
const denied = (error) => error.code === '42501';

test('a retained paid legacy row cannot become an alternate account profile after real bootstrap and lockdown', async () => {
  const db = new PGlite();
  try {
    await db.exec(read('./fixtures/launch-production-baseline.sql'));
    // Reconstruct only historical schema in the isolated local database, then
    // the two migrations actually rehearsed on staging; no other launch fixes.
    for (const [file] of HISTORICAL_MAPPINGS) await db.exec(read(`../supabase/migrations/${file}`));
    await db.exec(read('../supabase/migrations/20261019172710_bootstrap_realtor_profile.sql'));
    await db.query(`INSERT INTO auth.users(id,email,raw_user_meta_data,email_confirmed_at)
      VALUES($1,'synthetic@example.invalid','{"full_name":"Synthetic active identity","plan":"premier"}',now())`, [owner]);
    await db.query(`INSERT INTO public.realtor_profiles(user_id,slug,full_name,email,plan,page_data)
      VALUES($1,'legacy-only','Synthetic legacy identity','legacy@example.invalid','premier','{"is_published":true}')`, [owner]);
    const legacyBefore = (await db.query('SELECT to_jsonb(p) p FROM public.realtor_profiles p')).rows;
    await db.exec(migration);
    await db.query("SELECT set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: owner, role: 'authenticated' })]);
    await db.exec('SET ROLE authenticated');
    const active = (await db.query('SELECT public.bootstrap_own_profile() p')).rows[0].p;
    assert.equal(active.id, owner); assert.equal(active.plan, 'partner');
    assert.equal(active.full_name, 'Synthetic active identity'); assert.equal(active.email, 'synthetic@example.invalid');
    assert.equal(active.slug, null); assert.equal(active.is_published, false);
    assert.equal((await db.query('SELECT public.bootstrap_own_profile() p')).rows[0].p.id, owner);
    await db.query("UPDATE public.profiles SET phone='202-555-0101' WHERE id=$1", [owner]);
    await assert.rejects(db.query('SELECT * FROM public.realtor_profiles WHERE user_id=$1', [owner]), denied);
    await db.exec('RESET ROLE');
    assert.deepEqual((await db.query('SELECT to_jsonb(p) p FROM public.realtor_profiles p')).rows, legacyBefore);
    assert.equal((await db.query('SELECT count(*)::int n FROM public.profiles WHERE id=$1', [owner])).rows[0].n, 1);
    assert.equal((await db.query('SELECT count(*)::int n FROM public.vendors WHERE profile_id=$1 AND is_default', [owner])).rows[0].n, 1);
    await db.exec('SET ROLE anon');
    assert.equal((await db.query('SELECT * FROM public.profiles')).rows.length, 0);
    await assert.rejects(db.query('SELECT slug FROM public.realtor_profiles'), denied);
    await db.exec('RESET ROLE');
    // Validate the staging acceptance script locally before any hosted run.
    await db.exec("SELECT set_config('request.jwt.claims','{}',false)");
    const freeFixture = '00000000-0000-4000-8000-000000000083';
    for (const [user, plan] of [[freeFixture, 'partner'], [other, 'pro']]) {
      await db.query("INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES($1,$2,now(),'{}')", [user, `${plan}@example.invalid`]);
      await db.query('INSERT INTO public.profiles(id,plan,full_name) VALUES($1,$2,$3)', [user, plan, 'Synthetic staging fixture']);
    }
    await db.exec(`CREATE SCHEMA staging_control;
      CREATE TABLE staging_control.environment_guard(project_ref text);
      INSERT INTO staging_control.environment_guard VALUES('amopxaadnvubvveqpkvu');
      CREATE TABLE staging_control.fixture_identities(fixture text,user_id uuid);`);
    await db.query("INSERT INTO staging_control.fixture_identities VALUES('free',$1),('core',$2)", [freeFixture, other]);
    await db.exec(read('./fixtures/legacy-realtor-profiles-staging.sql'));
    assert.deepEqual((await db.query('SELECT to_jsonb(p) p FROM public.realtor_profiles p')).rows, legacyBefore);
  } finally { await db.close(); }
});

test('legacy exposure is reproduced, then API table/column reads and writes are denied without deleting data', async () => {
  const db = await fixture();
  try {
    await actor(db, 'authenticated', () => db.query('INSERT INTO public.realtor_profiles(user_id,slug,email) VALUES ($1,$2,$3)', [owner,'old-hub','private@example.com']));
    assert.equal((await actor(db, 'anon', () => db.query('SELECT email FROM public.realtor_profiles'))).rows[0].email, 'private@example.com');
    // Extra PUBLIC and column grants must be closed too, even though absent live.
    await db.exec('GRANT SELECT ON public.realtor_profiles TO PUBLIC; GRANT SELECT(email), INSERT(slug), UPDATE(email), REFERENCES(id) ON public.realtor_profiles TO PUBLIC,anon,authenticated,service_role;');
    const before = (await db.query('SELECT to_jsonb(p) p FROM public.realtor_profiles p')).rows;
    await db.exec(migration);
    await db.exec(migration); // Safe to retry; existing rows remain intact.
    for (const role of ['anon','authenticated','service_role']) {
      for (const user of [owner,other]) await actor(db, role, async () => {
        for (const sql of [
          'SELECT * FROM public.realtor_profiles', 'SELECT email FROM public.realtor_profiles',
          "INSERT INTO public.realtor_profiles(slug) VALUES ('injected')",
          "INSERT INTO public.realtor_profiles(slug) VALUES ('old-hub') ON CONFLICT(slug) DO UPDATE SET email='injected'",
          "UPDATE public.realtor_profiles SET email='injected'", 'DELETE FROM public.realtor_profiles',
          'TRUNCATE public.realtor_profiles',
        ]) await assert.rejects(db.exec(sql), denied);
      }, user);
      for (const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])
        assert.equal((await db.query('SELECT has_table_privilege($1,$2,$3) permitted', [role,'public.realtor_profiles',privilege])).rows[0].permitted, false);
      for (const privilege of ['SELECT','INSERT','UPDATE','REFERENCES'])
        assert.equal((await db.query('SELECT has_any_column_privilege($1,$2,$3) permitted', [role,'public.realtor_profiles',privilege])).rows[0].permitted, false);
    }
    assert.deepEqual((await db.query('SELECT to_jsonb(p) p FROM public.realtor_profiles p')).rows, before);
    assert.equal((await db.query("SELECT count(*)::int n FROM pg_policies WHERE tablename='realtor_profiles'")).rows[0].n, 0);
    assert.equal((await db.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.realtor_profiles'::regclass")).rows[0].relrowsecurity, true);
    // Default-deny RLS remains a second barrier if table grants are accidentally restored.
    await db.exec('GRANT SELECT,INSERT,UPDATE,DELETE ON public.realtor_profiles TO anon,authenticated;');
    for (const role of ['anon','authenticated']) await actor(db, role, async () => {
      assert.deepEqual((await db.query('SELECT * FROM public.realtor_profiles')).rows, []);
      await assert.rejects(db.exec("INSERT INTO public.realtor_profiles(slug) VALUES ('blocked')"), denied);
      await db.exec("UPDATE public.realtor_profiles SET email='blocked'; DELETE FROM public.realtor_profiles;");
    });
    assert.deepEqual((await db.query('SELECT to_jsonb(p) p FROM public.realtor_profiles p')).rows, before);
  } finally { await db.close(); }
});

test('legacy lockdown leaves active profile grants, policies, owner updates and published-only public reads unchanged', async () => {
  const db = await fixture();
  try {
    await db.exec(`CREATE TABLE public.profiles(id uuid PRIMARY KEY,full_name text,is_published boolean DEFAULT false);
      ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
      GRANT SELECT ON public.profiles TO anon,authenticated;
      GRANT UPDATE ON public.profiles TO authenticated;
      CREATE POLICY published ON public.profiles FOR SELECT USING(is_published);
      CREATE POLICY own_read ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid());
      CREATE POLICY own_update ON public.profiles FOR UPDATE TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
      INSERT INTO public.profiles VALUES ('${owner}','Owner',false),('${other}','Public',true);`);
    const snapshot = async () => (await db.query(`SELECT c.relacl::text,c.relrowsecurity,
      (SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname) FROM pg_policies p WHERE tablename='profiles') policies
      FROM pg_class c WHERE c.oid='public.profiles'::regclass`)).rows;
    const before = await snapshot();
    await db.exec(migration);
    assert.deepEqual(await snapshot(), before);
    assert.deepEqual((await actor(db,'anon',()=>db.query('SELECT id FROM public.profiles'))).rows,[{id:other}]);
    await actor(db,'authenticated',()=>db.query('UPDATE public.profiles SET full_name=$1 WHERE id=$2',['Saved',owner]));
    assert.equal((await db.query('SELECT full_name FROM public.profiles WHERE id=$1',[owner])).rows[0].full_name,'Saved');
    assert.deepEqual((await actor(db,'authenticated',()=>db.query('SELECT id FROM public.profiles WHERE id=$1',[owner]),other)).rows,[]);
    assert.doesNotMatch(migration,/DROP TABLE|DELETE FROM|TRUNCATE TABLE|CREATE FUNCTION|CREATE TRIGGER|ALTER TABLE public\.profiles\b/i);
  } finally { await db.close(); }
});

test('frontend, public assets, Edge Functions and previous migrations do not depend on the legacy table', () => {
  function scan(directory) {
    for (const entry of readdirSync(new URL(directory,import.meta.url),{withFileTypes:true})) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) scan(path);
      else if (/\.(jsx?|tsx?|sql|json|toml|html|webmanifest)$/i.test(entry.name)) {
        if (entry.name === '20261019175354_deprecate_legacy_realtor_profiles.sql') continue;
        assert.doesNotMatch(read(path),/realtor_profiles/i,path);
      }
    }
  }
  for (const path of ['../src','../public','../supabase']) scan(path);
  assert.match(read('../src/lib/profileBootstrap.js'),/rpc\('bootstrap_own_profile'\)/);
  assert.match(read('../src/App.jsx'),/from\('profiles'\)/);
  assert.match(read('../src/components/PublicRealtorHub.jsx'),/profileForHub\(profile\)/);
});
