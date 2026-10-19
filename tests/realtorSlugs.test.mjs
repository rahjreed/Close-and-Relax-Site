import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { RESERVED_REALTOR_SLUGS, realtorSlugError, isValidRealtorSlug } from '../src/lib/realtorSlugs.js';
import { loadPublicHubProfile } from '../src/lib/profileBranding.js';
import { HISTORICAL_MAPPINGS } from '../tools/prepare-pre-stripe-release.mjs';
const read = (path) => readFileSync(new URL(path,import.meta.url),'utf8');
const migration = read('../supabase/migrations/20261019180243_enforce_realtor_slugs.sql');
const owner = '00000000-0000-4000-8000-000000000091';
const other = '00000000-0000-4000-8000-000000000092';
const valid = ['a','12','rahjreed','jane-doe','a--b','1-realty-2','a'.repeat(63)];
const invalid = [null,'',' ','Jane',' JANE ',' jane ','-jane','jane-','jane_doe','jane.doe','jane/doe','jane?x=1','jane#x','jane\n','\njane','jane\t','josé','𝚊','a'.repeat(64),...RESERVED_REALTOR_SLUGS];
async function fixture() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY,slug text UNIQUE,plan text DEFAULT 'partner',is_published boolean DEFAULT false,
      homeowner_savings_visible boolean DEFAULT true,full_name text,email text,phone text,brokerage text,title text,city text,state text,
      headshot_url text,photo_url text,welcome_message text,bio text,website_url text,instagram_url text,facebook_url text,linkedin_url text,
      welcome_video_url text,video_url text,app_icon_initials text,app_initials text);
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    GRANT SELECT,INSERT,UPDATE ON public.profiles TO authenticated;
    CREATE POLICY own_read ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid());
    CREATE POLICY own_update ON public.profiles FOR UPDATE TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
    CREATE POLICY own_insert ON public.profiles FOR INSERT TO authenticated WITH CHECK(id=auth.uid());
    INSERT INTO public.profiles(id,slug,is_published) VALUES ('${owner}','rahjreed',true),('${other}',null,false);`);
  const publicRpc = read('../supabase/migrations/20261019032658_enforce_profile_branding.sql')
    .match(/CREATE FUNCTION public\.get_public_realtor_profile\(hub_slug text\)[\s\S]*?GRANT EXECUTE ON FUNCTION public\.get_public_realtor_profile\(text\) TO anon,authenticated,service_role;/)[0];
  await db.exec(publicRpc);
  return db;
}
async function actor(db,role,user,run) {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[user||'']);
  await db.exec(`SET ROLE ${role}`);
  try { return await run(); } finally { await db.exec('RESET ROLE'); }
}
const state = async (db) => (await db.query('SELECT to_jsonb(p) p FROM public.profiles p ORDER BY id')).rows;
const lookup = async (db,slug) => (await db.query('SELECT public.get_public_realtor_profile($1) p',[slug])).rows[0].p;

test('reserved names cover all requested platform labels and explicit Vercel routes', () => {
  const required = ['www','app','api','admin','dashboard','login','signup','reset-password','insurance',
    'support','auth','static','assets','cdn','mail','help','billing','account','ns1','ns2','staging','preview'];
  const routes = JSON.parse(read('../vercel.json')).rewrites.map(({ source }) => source.split('/').filter(Boolean)[0]);
  for (const label of [...required,...routes]) assert.ok(RESERVED_REALTOR_SLUGS.includes(label), label);
  const sqlReserved = [...migration.match(/candidate <> ALL \(ARRAY\[([\s\S]*?)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual([...sqlReserved].sort(), [...RESERVED_REALTOR_SLUGS].sort());
  assert.equal(isValidRealtorSlug('support-realty'), true);
});

test('slug migration composes with only the already-rehearsed bootstrap and legacy lockdown', async () => {
  const db = new PGlite();
  try {
    await db.exec(read('./fixtures/launch-production-baseline.sql'));
    await db.exec('ALTER TABLE auth.users ADD COLUMN banned_until timestamptz');
    for (const [file] of HISTORICAL_MAPPINGS) await db.exec(read(`../supabase/migrations/${file}`));
    await db.exec(read('../supabase/migrations/20261019172710_bootstrap_realtor_profile.sql'));
    await db.exec(read('../supabase/migrations/20261019175354_deprecate_legacy_realtor_profiles.sql'));
    const draft = '00000000-0000-4000-8000-000000000093';
    for (const [id, plan, slug, published] of [[owner,'partner','fixture-free',true],[other,'pro','fixture-core',true],[draft,'partner','fixture-draft',false]]) {
      await db.query("INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES($1,$2,now(),'{}')", [id, `${slug}@example.invalid`]);
      await db.query('INSERT INTO public.profiles(id,plan,slug,is_published) VALUES($1,$2,$3,$4)', [id,plan,slug,published]);
    }
    await db.exec(`CREATE SCHEMA staging_control; CREATE TABLE staging_control.environment_guard(project_ref text);
      INSERT INTO staging_control.environment_guard VALUES('amopxaadnvubvveqpkvu');
      CREATE TABLE staging_control.fixture_identities(fixture text,user_id uuid);`);
    await db.query("INSERT INTO staging_control.fixture_identities VALUES('free',$1),('core',$2),('draft',$3)", [owner,other,draft]);
    const before = await state(db);
    await db.exec(migration);
    assert.deepEqual(await state(db), before);
    // The hosted acceptance script must remain rollback-only and must not rely
    // on applying branding, vendor, analytics or any other pending migration.
    await db.exec(read('./fixtures/realtor-slugs-staging.sql'));
    assert.deepEqual(await state(db), before);
    assert.equal((await db.query("SELECT to_regprocedure('public.get_public_realtor_profile(text)') p")).rows[0].p, null);
  } finally { await db.close(); }
});

test('frontend and PostgreSQL share exact canonical format and reserved-name rules', async () => {
  const db = await fixture();
  try {
    const before = await state(db);
    await db.exec(migration);
    assert.deepEqual(await state(db),before);
    for (const slug of [...valid,...invalid]) {
      const expected = valid.includes(slug);
      assert.equal(isValidRealtorSlug(slug),expected,String(slug));
      assert.equal((await db.query('SELECT public.is_valid_realtor_slug($1) valid',[slug])).rows[0].valid,expected,String(slug));
    }
    assert.match(realtorSlugError('admin'),/reserved/);
    assert.match(realtorSlugError('Jane'),/lowercase/);
    assert.equal(isValidRealtorSlug({}),false);
    assert.equal((await db.query("SELECT prosecdef FROM pg_proc WHERE oid='public.enforce_profile_slug()'::regprocedure")).rows[0].prosecdef,false);
  } finally { await db.close(); }
});

test('server rejects invalid/reserved writes, published NULL and clearing assigned URLs; valid drafts and owner edits work', async () => {
  const db = await fixture();
  try {
    await db.exec(migration);
    // NULL is valid only for a draft awaiting bootstrap/setup.
    await actor(db,'authenticated',other,()=>db.query('UPDATE public.profiles SET full_name=$1 WHERE id=$2',['Draft owner',other]));
    await actor(db,'authenticated',other,()=>assert.rejects(db.query('UPDATE public.profiles SET is_published=true WHERE id=$1',[other]),/before publishing/));
    for (const slug of invalid.filter(s=>s!==null)) {
      await actor(db,'authenticated',owner,()=>assert.rejects(db.query('UPDATE public.profiles SET slug=$1 WHERE id=$2',[slug,owner]),e=>e.code==='23514'));
      await assert.rejects(db.query('INSERT INTO public.profiles(id,slug) VALUES (gen_random_uuid(),$1)',[slug]),e=>e.code==='23514');
    }
    for (const slug of valid) {
      await actor(db,'authenticated',owner,()=>db.query('UPDATE public.profiles SET slug=$1 WHERE id=$2',[slug,owner]));
      assert.equal((await db.query('SELECT slug FROM public.profiles WHERE id=$1',[owner])).rows[0].slug,slug);
    }
    await actor(db,'authenticated',owner,()=>assert.rejects(db.query('UPDATE public.profiles SET slug=null,is_published=false WHERE id=$1',[owner]),/instead of clearing/));
    await actor(db,'authenticated',owner,()=>assert.rejects(db.exec('SELECT public.enforce_profile_slug()'),e=>e.code==='42501'));
    await actor(db,'anon',null,()=>assert.rejects(db.query('UPDATE public.profiles SET slug=$1 WHERE id=$2',['stolen',owner]),e=>e.code==='42501'));
  } finally { await db.close(); }
});

test('slug changes preserve ownership/uniqueness, old URLs stop resolving and draft publication remains private', async () => {
  const db = await fixture();
  try {
    const policies = (await db.query("SELECT * FROM pg_policies WHERE tablename='profiles' ORDER BY policyname")).rows;
    await db.exec(migration);
    assert.deepEqual((await db.query("SELECT * FROM pg_policies WHERE tablename='profiles' ORDER BY policyname")).rows,policies);
    await actor(db,'authenticated',other,()=>assert.rejects(db.query('UPDATE public.profiles SET slug=$1 WHERE id=$2',['rahjreed',other]),e=>e.code==='23505'));
    await actor(db,'authenticated',other,()=>assert.rejects(db.query('UPDATE public.profiles SET id=$1,slug=$2 WHERE id=$3',[owner,'stolen',other]),e=>['42501','23505'].includes(e.code)));
    await actor(db,'authenticated',other,()=>db.query('UPDATE public.profiles SET slug=$1 WHERE id=$2',['stolen',owner]));
    assert.equal((await lookup(db,'rahjreed')).id,owner);
    await actor(db,'authenticated',owner,()=>db.query('UPDATE public.profiles SET slug=$1 WHERE id=$2',['new-address',owner]));
    assert.equal(await actor(db,'anon',null,()=>lookup(db,'rahjreed')),null);
    assert.equal((await actor(db,'anon',null,()=>lookup(db,'new-address'))).id,owner);
    await actor(db,'authenticated',other,()=>db.query('UPDATE public.profiles SET slug=$1 WHERE id=$2',['draft-address',other]));
    for (const role of ['anon','authenticated']) assert.equal(await actor(db,role,owner,()=>lookup(db,'draft-address')),null);
    await actor(db,'authenticated',other,()=>db.query('UPDATE public.profiles SET is_published=true WHERE id=$1',[other]));
    assert.equal((await actor(db,'anon',null,()=>lookup(db,'draft-address'))).id,other);
    // A released URL is not redirected/aliased. It may later be claimed by another owner.
    await actor(db,'authenticated',other,()=>db.query('UPDATE public.profiles SET slug=$1 WHERE id=$2',['rahjreed',other]));
    assert.equal((await lookup(db,'rahjreed')).id,other);
  } finally { await db.close(); }
});

test('migration fails on pre-existing invalid URLs instead of silently renaming them', async () => {
  const db = await fixture();
  try {
    await db.exec("UPDATE public.profiles SET slug='admin' WHERE slug='rahjreed'");
    await assert.rejects(db.exec(migration),e=>e.code==='23514');
    await db.exec('ROLLBACK');
    assert.equal((await db.query('SELECT slug FROM public.profiles WHERE id=$1',[owner])).rows[0].slug,'admin');
    assert.equal((await db.query("SELECT to_regprocedure('public.is_valid_realtor_slug(text)') p")).rows[0].p,null);
  } finally { await db.close(); }
});

test('public loader rejects malformed/reserved identifiers before RPC; editor never silently rewrites input', async () => {
  const client = {rpc:()=>{throw new Error('Must not query invalid hub');}};
  for (const slug of invalid) assert.equal(await loadPublicHubProfile(client,slug),null);
  const app = read('../src/App.jsx');
  assert.doesNotMatch(app,/normalizeRealtorSlug/);
  assert.match(app,/slug: e\.target\.value/);
  assert.match(app,/changing this changes your public hub URL/i);
  assert.match(app,/Old URLs do not redirect automatically/);
  assert.match(app,/\.eq\('id', user\.id\)/);
  assert.match(app,/subdomainCandidate !== 'www'/);
});
