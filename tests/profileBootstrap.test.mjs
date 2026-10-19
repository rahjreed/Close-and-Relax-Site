import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createProfileBootstrap, PROFILE_SETUP_ERROR } from '../src/lib/profileBootstrap.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const migration = read('../supabase/migrations/20261019172710_bootstrap_realtor_profile.sql');
const id = '00000000-0000-4000-8000-000000000071';
const other = '00000000-0000-4000-8000-000000000072';
const third = '00000000-0000-4000-8000-000000000073';

async function fixture() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE SCHEMA close_relax_private;
    REVOKE ALL ON SCHEMA close_relax_private FROM PUBLIC;
    GRANT USAGE ON SCHEMA close_relax_private TO authenticated,service_role;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT (auth.jwt()->>'sub')::uuid$$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb,email_confirmed_at timestamptz,is_anonymous boolean DEFAULT false,deleted_at timestamptz);
    REVOKE ALL ON auth.users FROM PUBLIC,anon,authenticated,service_role;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz DEFAULT now(),
      slug text UNIQUE,full_name text,email text,phone text,brokerage text,city text,state text,title text,
      plan text DEFAULT 'free',is_published boolean DEFAULT false,homeowner_savings_visible boolean NOT NULL DEFAULT true,
      headshot_url text,photo_url text,bio text,welcome_message text,website_url text,instagram_url text,facebook_url text,linkedin_url text,
      welcome_video_url text,video_url text,app_icon_initials text,app_initials text,
      CHECK (lower(coalesce(plan,'partner'))='premier' OR homeowner_savings_visible));
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    GRANT SELECT,INSERT,UPDATE ON public.profiles TO authenticated;
    GRANT INSERT ON public.profiles TO anon;
    GRANT INSERT(id) ON public.profiles TO authenticated;
    CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid());
    CREATE POLICY "Users can create own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK(id=auth.uid());
    CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
    CREATE TABLE public.vendors(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
      name text,category text,phone text,website text,recommendation text,sort_order integer DEFAULT 0,is_active boolean DEFAULT true,is_default boolean DEFAULT false,
      created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());`);
  // Compose the bootstrap with inspected standard-vendor functions and the local
  // plan/branding and vendor enforcement fixes, without replacing their behavior.
  await db.exec(read('./fixtures/vendor-functions.sql'));
  for (const [file, pattern] of [
    ['../supabase/migrations/20261019032658_enforce_profile_branding.sql', /CREATE OR REPLACE FUNCTION public\.protect_profile_plan\(\)[\s\S]*?\$function\$;/],
    ['../supabase/migrations/20261019034056_enforce_vendor_downgrade_visibility.sql', /CREATE OR REPLACE FUNCTION public\.enforce_vendor_plan_rules\(\)[\s\S]*?\$function\$;/],
  ]) await db.exec(read(file).match(pattern)[0]);
  await db.exec(`CREATE TRIGGER protect_profile_plan_before_insert BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_plan();
    CREATE TRIGGER protect_profile_plan_before_update BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_plan();
    CREATE TRIGGER add_standard_vendor_after_profile_insert AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile_standard_vendor();
    CREATE TRIGGER enforce_vendor_plan_rules_before_insert BEFORE INSERT ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.enforce_vendor_plan_rules();`);
  await db.exec(read('../supabase/migrations/20261019025425_restrict_standard_vendor_helper.sql'));
  await db.exec(migration);
  return db;
}
async function addUser(db, userId = id, metadata = {}, confirmed = true) {
  await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data,email_confirmed_at) VALUES ($1,$2,$3::jsonb,$4)',
    [userId, 'owner@example.com', JSON.stringify(metadata), confirmed ? '2026-10-19T00:00:00Z' : null]);
}
async function actor(db, userId, run, role = 'authenticated') {
  await db.query("SELECT set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: userId, role })]);
  await db.exec(`SET ROLE ${role}`);
  try { return await run(); } finally { await db.exec('RESET ROLE'); await db.exec("SELECT set_config('request.jwt.claims','{}',false)"); }
}
const bootstrap = async (db) => (await db.query('SELECT public.bootstrap_own_profile() AS profile')).rows[0].profile;

test('new confirmed signup and existing missing-profile user bootstrap safely; repeated/concurrent callers create one profile and standard vendor', async () => {
  const db = await fixture();
  try {
    await addUser(db, id, { full_name: '  Pat Realtor  ', brokerage: 'Example Realty', market_city: 'Indianapolis', plan: 'premier', is_published: true,
      id: other, email: 'untrusted@example.com', slug: 'stolen', headshot_url: 'paid', photo_url: 'legacy-paid', welcome_message: 'paid', admin: true, homeowner_savings_visible: false });
    const results = await actor(db, id, () => Promise.all(Array.from({ length: 8 }, () => bootstrap(db))));
    for (const row of results) {
      assert.equal(row.id, id); assert.equal(row.plan, 'partner'); assert.equal(row.full_name, 'Pat Realtor');
      assert.equal(row.email, 'owner@example.com'); assert.equal(row.slug, null); assert.equal(row.is_published, false);
      assert.equal(row.homeowner_savings_visible, true); assert.equal(row.photo_url, null); assert.equal(row.headshot_url, null); assert.equal(row.welcome_message, null);
    }
    assert.equal((await db.query('SELECT count(*)::int n FROM public.profiles')).rows[0].n, 1);
    assert.equal((await db.query('SELECT count(*)::int n FROM public.vendors WHERE is_default')).rows[0].n, 1);
    await addUser(db, other); // Represents an older Auth user with no corresponding profile.
    const recovered = await actor(db, other, () => bootstrap(db));
    assert.equal(recovered.id, other); assert.equal(recovered.plan, 'partner');
    await actor(db, id, () => assert.rejects(db.query('SELECT public.bootstrap_own_profile($1::uuid)', [other]), /does not exist/));
  } finally { await db.close(); }
});

test('bootstrap preserves existing Free/Core/Pro profiles, saved branding, slug, publication and owner isolation', async () => {
  const db = await fixture();
  try {
    for (const [userId, plan] of [[id, 'partner'], [other, 'pro'], [third, 'premier']]) {
      await addUser(db, userId, { full_name: 'Overwritten?', plan: 'premier' });
      await db.query('INSERT INTO public.profiles(id,plan,slug,full_name,is_published) VALUES ($1,$2,$3,$4,true)', [userId, plan, plan, 'Saved owner']);
      if (plan !== 'partner') await db.query("UPDATE public.profiles SET photo_url='Saved photo',welcome_message='Saved welcome' WHERE id=$1", [userId]);
      const before = (await db.query('SELECT to_jsonb(p) AS profile FROM public.profiles p WHERE id=$1', [userId])).rows[0].profile;
      const result = await actor(db, userId, () => bootstrap(db));
      assert.deepEqual(before, result);
      assert.deepEqual((await db.query('SELECT to_jsonb(p) AS profile FROM public.profiles p WHERE id=$1', [userId])).rows[0].profile, before);
      await actor(db, userId, () => assert.rejects(db.query('UPDATE public.profiles SET plan=$2 WHERE id=$1', [userId, plan === 'premier' ? 'pro' : 'premier']), /billing/));
      if (plan === 'premier') {
        await db.query('DELETE FROM public.vendors WHERE profile_id=$1', [userId]);
        await actor(db, userId, () => bootstrap(db));
        assert.equal((await db.query('SELECT count(*)::int n FROM public.vendors WHERE profile_id=$1', [userId])).rows[0].n, 0);
      }
    }
    await actor(db, id, async () => {
      assert.equal((await db.query('SELECT * FROM public.profiles WHERE id=$1', [other])).rows.length, 0);
      await assert.rejects(db.query("UPDATE public.profiles SET plan='pro' WHERE id=$1", [id]), /billing/);
      await db.query("UPDATE public.profiles SET phone='3175550100' WHERE id=$1", [id]);
    });
  } finally { await db.close(); }
});

test('unauthenticated, stale/deleted, anonymous and unconfirmed identities cannot bootstrap; direct browser insertion and paid-plan injection are denied', async () => {
  const db = await fixture();
  try {
    await addUser(db, id, { plan: 'premier' }, false);
    for (const role of ['anon', 'service_role']) await actor(db, id, () => assert.rejects(bootstrap(db), /permission denied/), role);
    await actor(db, id, () => assert.rejects(bootstrap(db), /confirmed Realtor/));
    await actor(db, other, () => assert.rejects(bootstrap(db), /confirmed Realtor/));
    await addUser(db, other);
    await db.query('UPDATE auth.users SET is_anonymous=true WHERE id=$1', [other]);
    await actor(db, other, () => assert.rejects(bootstrap(db), /confirmed Realtor/));
    await db.query('UPDATE auth.users SET is_anonymous=false,deleted_at=now() WHERE id=$1', [other]);
    await actor(db, other, () => assert.rejects(bootstrap(db), /confirmed Realtor/));
    await actor(db, id, () => assert.rejects(db.query("INSERT INTO public.profiles(id,plan) VALUES ($1,'premier')", [id]), /permission denied/));
    await actor(db, id, () => assert.rejects(db.query('INSERT INTO public.profiles(id) VALUES ($1)', [id]), /permission denied/));
    await db.query('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1', [id]);
    assert.equal((await actor(db, id, () => bootstrap(db))).plan, 'partner');
    await db.query('DELETE FROM auth.users WHERE id=$1', [id]); // Local integrity/deletion-semantics test only.
    await actor(db, id, () => assert.rejects(bootstrap(db), /confirmed Realtor/));
  } finally { await db.close(); }
});

test('a failing standard-vendor insert rolls back profile creation atomically, then a retry recovers without duplicates or policy changes', async () => {
  const db = await fixture();
  try {
    const policies = (await db.query("SELECT policyname,cmd,qual,with_check FROM pg_policies WHERE tablename='profiles' ORDER BY policyname")).rows;
    await addUser(db);
    await db.exec(`CREATE FUNCTION public.test_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Simulated vendor failure'; END$$;
      CREATE TRIGGER test_failure BEFORE INSERT ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.test_failure();`);
    await actor(db, id, () => assert.rejects(bootstrap(db), /Simulated vendor failure/));
    assert.equal((await db.query('SELECT count(*)::int n FROM public.profiles')).rows[0].n, 0);
    assert.equal((await db.query('SELECT count(*)::int n FROM public.vendors')).rows[0].n, 0);
    await db.exec('DROP TRIGGER test_failure ON public.vendors;');
    assert.equal((await actor(db, id, () => bootstrap(db))).id, id);
    await actor(db, id, () => bootstrap(db));
    assert.equal((await db.query('SELECT count(*)::int n FROM public.vendors')).rows[0].n, 1);
    assert.deepEqual((await db.query("SELECT policyname,cmd,qual,with_check FROM pg_policies WHERE tablename='profiles' ORDER BY policyname")).rows, policies);
    assert.deepEqual((await db.query("SELECT public.vendor_plan_limit($1) AS n", [id])).rows, [{ n: 5 }]);
  } finally { await db.close(); }
});

const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const clientFor = (run) => ({ rpc(name) { assert.equal(name, 'bootstrap_own_profile'); assert.equal(arguments.length, 1); return { abortSignal: run }; } });

test('client deduplicates simultaneous bootstrap, exposes failure/retry, and validates returned owner', async () => {
  const states = [], pending = deferred(); let calls = 0;
  const runner = createProfileBootstrap(clientFor(() => { calls++; return calls === 1 ? pending.promise : { data: { id, plan: 'partner' } }; }), (state) => states.push(state));
  const first = runner.load(id); assert.equal(runner.load(id), first);
  await Promise.resolve(); assert.equal(calls, 1);
  pending.resolve({ error: { message: 'Do not expose database details' } }); await first;
  assert.equal(states.at(-1).status, 'error'); assert.equal(states.at(-1).error, PROFILE_SETUP_ERROR);
  assert.equal((await runner.load(id)).id, id); assert.equal(states.at(-1).status, 'ready');
  const wrong = createProfileBootstrap(clientFor(() => ({ data: { id: other } })), (state) => states.push(state));
  assert.equal(await wrong.load(id), null); assert.equal(states.at(-1).profile, null);
});

test('client cancels account-switch/logout/unmount work and ignores late replies without exposing stale profiles', async () => {
  const states = [], a = deferred(), b = deferred(); let calls = 0;
  const runner = createProfileBootstrap(clientFor(() => ++calls === 1 ? a.promise : b.promise), (state) => states.push(state));
  const first = runner.load(id); await Promise.resolve();
  const second = runner.load(other); await Promise.resolve();
  a.resolve({ data: { id } }); await first;
  assert.ok(!states.some((s) => s.status === 'ready' && s.profile.id === id));
  b.resolve({ data: { id: other } }); await second;
  assert.equal(states.at(-1).profile.id, other);
  await runner.load(null); assert.deepEqual(states.at(-1), { profile: null, status: 'idle', error: '' });
  const c = deferred(), cancelled = createProfileBootstrap(clientFor(() => c.promise), (state) => states.push(state));
  const p = cancelled.load(id); cancelled.cancel(); await p; const count = states.length;
  c.resolve({ data: { id } }); await Promise.resolve(); assert.equal(states.length, count);
});

test('hung bootstrap exits loading with retry enabled; it never inserts through the browser or overwrites a paid profile', async () => {
  const states = []; let calls = 0;
  const runner = createProfileBootstrap(clientFor(() => ++calls === 1 ? new Promise(() => {}) : { data: { id, plan: 'premier' } }), (state) => states.push(state), 10);
  assert.equal(await runner.load(id), null); assert.equal(states.at(-1).status, 'error');
  assert.equal((await runner.load(id)).plan, 'premier'); assert.equal(states.at(-1).status, 'ready');
  assert.doesNotMatch(migration, /CREATE TRIGGER|ALTER TABLE auth\.users|UPDATE public\.profiles|INSERT INTO auth\.users/i);
});
