import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { PGlite } from '@electric-sql/pglite';
import Stripe from 'stripe';
import { createBillingHandler } from '../api/billing.js';
import { createWebhookHandler } from '../api/stripe-webhook.js';
import { CATALOG, STRIPE_ACCOUNT } from '../server/billing-policy.js';
import { portal } from '../server/billing.js';

const userId='00000000-0000-4000-8000-000000000001';
const origin='https://close-relax-test.vercel.app';
function response() { return { code:0,body:null,setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;},end(){return this;} }; }
const migration = await readFile(new URL('../supabase/migrations/20261112034500_stripe_subscription_billing.sql',import.meta.url),'utf8');
// pg_cron is a hosted extension; the expiry function is tested directly below.
const migrationWithoutCron = migration.slice(0,migration.indexOf('create extension if not exists pg_cron'));

test('billing handlers + actual PostgreSQL: checkout, signed webhooks, renewals, failure, cancellation, duplicates and permissions', async t => {
  const sql = new PGlite();
  await sql.exec(`create role anon; create role authenticated; create role service_role bypassrls; create role supabase_admin;
    create table profiles(id uuid primary key,plan text default 'partner',full_name text);
    grant usage on schema public to service_role,authenticated,anon;
    grant all on profiles to service_role,authenticated;
    ${migrationWithoutCron}
    insert into profiles(id,plan) values('${userId}','premier');`);
  assert.equal((await sql.query('select plan from profiles')).rows[0].plan,'partner','even privileged signup inserts start Free');
  const db={
    auth:{getUser:async token=> token==='valid-session'?{data:{user:{id:userId,email:'billing-test@example.invalid'}}}:{data:{},error:true}},
    from(table){
      let column,value;
      return {select(){return this;},eq(c,v){column=c;value=v;return this;},async maybeSingle(){
        assert(['profiles','billing_accounts','billing_events'].includes(table));
        assert(['id','user_id','event_id','customer_id'].includes(column));
        try { const r=await sql.query(`select * from ${table} where ${column}=$1`,[value]); return {data:r.rows[0]||null}; }
        catch(error){return {error};}
      }};
    },
    async rpc(name,params){
      try {
        const keys=Object.keys(params), args=keys.map((k,i)=>`${k} => $${i+1}`).join(',');
        const values=keys.map(k=>typeof params[k]==='object'&&params[k]!==null?JSON.stringify(params[k]):params[k]);
        const r=await sql.query(`select public.${name}(${args}) as value`,values);
        return {data:r.rows[0].value};
      } catch(error){return {error};}
    },
  };
  let subs=[],invoices=[],created=[],failCheckout=false;
  const sdk = new Stripe(['rk','test',randomUUID()].join('_'));
  const secret=randomUUID(); process.env.STRIPE_WEBHOOK_SECRET=secret;
  const stripe={
    accounts:{retrieve:async()=>({id:STRIPE_ACCOUNT})},
    prices:{retrieve:async id=>{const p=Object.values(CATALOG).find(p=>p.regular===id||p.founding===id);return {id,active:true,livemode:false,currency:'usd',tax_behavior:'exclusive',recurring:{interval:'month',interval_count:1},unit_amount:p.founding===id?p.foundingAmount:p.amount};}},
    customers:{create:async()=>({id:'cus_billing_test'})},
    subscriptions:{list:async function*(){yield* subs;}},
    invoices:{list:async function*(){yield* invoices;}},
    checkout:{sessions:{create:async(params,options)=>{created.push({params,options});if(failCheckout)throw Error('Simulated network timeout');return {status:'open',url:'https://checkout.stripe.com/c/pay/test'};}}},
    webhooks:sdk.webhooks,
  };
  const ctx={db,stripe,origin};
  const billing=createBillingHandler(()=>ctx),webhook=createWebhookHandler(()=>ctx);
  const call = async(body,token='valid-session',requestOrigin=origin)=>{const res=response();await billing({method:'POST',headers:{authorization:`Bearer ${token}`,origin:requestOrigin},body},res);return res;};
  const deliver=async(type,id=randomUUID(),extra={})=>{
    const payload=JSON.stringify({id,type,livemode:false,data:{object:{customer:'cus_billing_test',...extra}}});
    const signature=sdk.webhooks.generateTestHeaderString({payload,secret});
    const req=Readable.from([Buffer.from(payload)]);req.method='POST';req.headers={'stripe-signature':signature};
    const res=response();await webhook(req,res);return res;
  };
  const tier=async()=> (await sql.query('select plan from profiles')).rows[0].plan;
  const stamp=Math.floor(Date.now()/1000);
  const invoice=(price,start=stamp-100,end=stamp+2000)=>({status:'paid',livemode:false,lines:{has_more:false,data:[{amount:1900,quantity:1,parent:{subscription_item_details:{subscription:'sub_test',proration:false}},pricing:{price_details:{price}},period:{start,end}}]}});
  const sub=(price,status='active')=>({id:'sub_test',created:stamp,status,livemode:false,items:{data:[{price:{id:price}}]}});

  await t.test('auth, origin and injected price are rejected',async()=>{
    assert.equal((await call({action:'checkout',plan:'core'},'invalid')).code,401);
    assert.equal((await call({action:'checkout',plan:'core'},'valid-session','https://evil.invalid')).code,403);
    assert.equal((await call({action:'checkout',plan:'core',price:'price_spoofed'})).code,400);
    assert.equal((await call({action:'checkout',plan:'premier'})).code,400);
  });
  await t.test('checkout crash retries same persisted idempotency key, enables tax and grants nothing',async()=>{
    failCheckout=true;assert.equal((await call({action:'checkout',plan:'core'})).code,503);
    failCheckout=false;assert.equal((await call({action:'checkout',plan:'core'})).code,200);
    assert.equal(created[0].options.idempotencyKey,created[1].options.idempotencyKey);
    assert.equal(created[1].params.line_items[0].price,CATALOG.core.founding);
    assert.deepEqual(created[1].params.automatic_tax,{enabled:true});
    assert.equal(created[1].params.payment_method_types,undefined);
    assert.equal(await tier(),'partner');
    assert.equal((await call({action:'checkout',plan:'pro'})).code,409);
  });
  await t.test('verified payment grants Core; duplicate event is applied once',async()=>{
    subs=[sub(CATALOG.core.founding)];invoices=[invoice(CATALOG.core.founding)];
    assert.equal((await deliver('invoice.paid','evt_paid')).code,200);assert.equal(await tier(),'pro');
    assert.equal((await deliver('invoice.paid','evt_paid')).code,200);
    assert.equal((await sql.query("select count(*)::int n from billing_events where event_id='evt_paid'")).rows[0].n,1);
    assert.equal((await call({action:'checkout',plan:'pro'})).code,409);
  });
  await t.test('out-of-order failure cannot roll back a paid upgrade',async()=>{
    subs=[sub(CATALOG.pro.founding)];invoices.push(invoice(CATALOG.pro.founding,stamp-50));
    assert.equal((await deliver('invoice.paid')).code,200);assert.equal(await tier(),'premier');
    assert.equal((await deliver('invoice.payment_failed')).code,200);assert.equal(await tier(),'premier');
  });
  await t.test('failed renewal and scheduled cancellation preserve paid-through access',async()=>{
    subs=[{...sub(CATALOG.pro.founding,'past_due'),cancel_at_period_end:true}];
    assert.equal((await deliver('invoice.payment_failed')).code,200);assert.equal(await tier(),'premier');
    subs=[sub(CATALOG.pro.founding,'canceled')];
    assert.equal((await deliver('customer.subscription.deleted')).code,200);assert.equal(await tier(),'premier');
    assert.equal((await call({action:'status'})).body.cancelAtPeriodEnd,false);
  });
  await t.test('renewal extends paid-through and paid downgrade changes the tier',async()=>{
    subs=[sub(CATALOG.core.founding)];invoices.push(invoice(CATALOG.core.founding,stamp-1,stamp+4000));
    assert.equal((await deliver('invoice.paid')).code,200);assert.equal(await tier(),'pro');
    const row=(await sql.query('select paid_through from billing_accounts')).rows[0];
    assert.equal(Date.parse(row.paid_through), (stamp+4000)*1000);
  });
  await t.test('unverified webhook fails closed',async()=>{
    const req=Readable.from(['{}']);req.method='POST';req.headers={'stripe-signature':'invalid'};
    const res=response();await webhook(req,res);assert.equal(res.code,400);
  });
  await t.test('occupied lease retries instead of marking event complete',async()=>{
    await sql.query("update billing_accounts set lock_token=$1,lock_until=now()+interval '1 minute'",[randomUUID()]);
    assert.equal((await deliver('invoice.paid','evt_busy')).code,503);
    assert.equal((await sql.query("select count(*)::int n from billing_events where event_id='evt_busy'")).rows[0].n,0);
    await sql.exec('update billing_accounts set lock_token=null,lock_until=null');
    assert.equal((await deliver('invoice.paid','evt_busy')).code,200);
  });
  await t.test('clients cannot write plan, billing rows or privileged RPCs; ordinary edits work',async()=>{
    await sql.exec('set role authenticated');
    await assert.rejects(sql.exec("update profiles set plan='premier'"),/managed by billing/);
    await assert.rejects(sql.exec('select * from billing_accounts'),/permission denied/);
    await assert.rejects(sql.query('select billing_acquire($1,$2)',[userId,randomUUID()]),/permission denied/);
    await sql.exec("update profiles set full_name='Realtor'; reset role;");
  });
  await t.test('expiry revokes features without a webhook and risk hold survives renewals',async()=>{
    await sql.exec("update billing_accounts set paid_through=now()-interval '1 second'; select billing_expire();");
    assert.equal(await tier(),'partner');
    await sql.exec('update billing_accounts set risk_hold=true');
    assert.equal((await deliver('invoice.paid')).code,200);assert.equal(await tier(),'partner');
  });
  delete process.env.STRIPE_WEBHOOK_SECRET;
  await sql.close();
});

test('portal validates expanded cohort prices and refuses a founding price in regular configuration',async()=>{
  const cfg={active:true,livemode:false,features:{payment_method_update:{enabled:true},subscription_cancel:{enabled:true,mode:'at_period_end'},subscription_update:{enabled:true,default_allowed_updates:['price'],proration_behavior:'always_invoice',schedule_at_period_end:{conditions:[{type:'decreasing_item_amount'}]},products:[{prices:[CATALOG.core.regular]},{prices:[CATALOG.pro.regular]}]}}};
  process.env.STRIPE_PORTAL_REGULAR_CONFIG='bpc_test_regular';
  const ctx={origin,stripe:{subscriptions:{list:async function*(){}},billingPortal:{configurations:{retrieve:async(id,params)=>{assert.equal(id,'bpc_test_regular');assert.deepEqual(params.expand,['features.subscription_update.products']);return cfg;}},sessions:{create:async()=>({url:'https://billing.stripe.com/test'})}}}};
  assert.equal((await portal(ctx,{customer_id:'cus_test'})).url,'https://billing.stripe.com/test');
  cfg.features.subscription_update.products[0].prices=[CATALOG.core.founding];
  await assert.rejects(portal(ctx,{customer_id:'cus_test'}),/settings require review/);
  delete process.env.STRIPE_PORTAL_REGULAR_CONFIG;
});
