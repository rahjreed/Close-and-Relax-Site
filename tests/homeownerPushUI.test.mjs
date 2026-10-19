import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
const require=createRequire(import.meta.url);
const esbuild=createRequire(require.resolve('vite'))('esbuild');
const source=readFileSync(new URL('../src/components/HomeownerReminderSettings.jsx',import.meta.url),'utf8');
const libSource=readFileSync(new URL('../src/lib/homeownerPush.js',import.meta.url),'utf8');
const defaults=()=>({timezone:'America/New_York',delivery_time:'10:00',reminders:[{kind:'hvac',enabled:false,first_date:'2026-11-01',interval_days:90},{kind:'monthly',enabled:false},{kind:'seasonal',enabled:false}]});
const text=node=>node.children.map(c=>typeof c==='string'?c:text(c)).join('');
test('settings interaction: explicit opt-in, three types, saved schedules, updates, unsubscribe, unsupported and preview',async()=>{
  let calls=[],state=null,support='supported',listener;
  const helpers={defaultReminderPreferences:defaults,pushSupport:()=>support,
    loadReminderState:async()=>{calls.push('read');return state;},
    enableHomeReminders:async(id,prefs)=>{calls.push(['enable',id,prefs]);state={status:'active',preferences:prefs};return state;},
    disableHomeReminders:async()=>{calls.push('off');state=null;}};
  const module={exports:{}};
  const context=vm.createContext({module,exports:module.exports,require:name=>name==='react'?React:helpers,
    document:{addEventListener(){},removeEventListener(){},visibilityState:'visible'},navigator:{serviceWorker:{addEventListener(n,fn){listener=fn;},removeEventListener(){}}}});
  vm.runInContext(esbuild.transformSync(source,{loader:'jsx',format:'cjs'}).code,context);
  const Component=module.exports.default;let tree;
  await act(async()=>{tree=TestRenderer.create(React.createElement(Component,{profileId:'hub-a'}));});
  assert.deepEqual(calls,['read']);assert(!calls.some(c=>Array.isArray(c)),'mount must never enable permission');
  await act(async()=>tree.root.findAllByType('button')[0].props.onClick());
  assert.equal(tree.root.findAllByProps({type:'checkbox'}).length,3);
  await act(async()=>tree.root.findAllByProps({type:'checkbox'})[0].props.onChange({target:{checked:true}}));
  assert.equal(tree.root.findAllByProps({type:'date'}).length,1);
  await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
  assert.equal(calls.at(-1)[0],'enable');assert.equal(calls.at(-1)[1],'hub-a');assert.equal(calls.at(-1)[2].reminders[0].enabled,true);
  assert(text(tree.root).includes('independent of your checklist'));
  await act(async()=>tree.root.findAllByType('button').find(b=>text(b)==='Turn off all reminders').props.onClick());
  assert.equal(calls.at(-1),'off');assert(text(tree.root).includes('All reminders are off'));
  await act(async()=>tree.unmount());
  for(const [mode,copy] of [['install-ios','Add to Home Screen'],['unsupported','unavailable in this browser'],['preview','disabled in private preview']]){
    support=mode;calls=[];await act(async()=>{tree=TestRenderer.create(React.createElement(Component,{profileId:'hub-a',preview:mode==='preview'}));});
    await act(async()=>tree.root.findAllByType('button')[0].props.onClick());
    assert(text(tree.root).includes(copy));assert.equal(tree.root.findAllByType('form').length,0);assert.equal(calls.length,0);
    await act(async()=>tree.unmount());
  }
});
function clientFixture(){
  let record,offline=false;const calls=[],response={status:'pending'},subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test',toJSON(){return {endpoint:this.endpoint,keys:{}};},async unsubscribe(){calls.push('browser-off');}};
  const storage=async(key,value,mode)=>{calls.push(`storage:${mode||'read'}`);if(mode==='write')record=value;if(mode==='delete')record=undefined;return record;};
  const registration={pushManager:{getSubscription:async()=>subscription,subscribe:async()=>subscription}};
  const nav={userAgent:'Android Chrome',serviceWorker:{getRegistration:async()=>registration}};
  const module={exports:{}};
  const browser={module,exports:module.exports,require:name=>name.includes('pushDeviceStore')?{pushStore:storage}:{ensureHubWorker:async()=>{calls.push('worker');return registration;}},
    __env:{VITE_SUPABASE_URL:'https://test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'public',VITE_WEB_PUSH_VAPID_PUBLIC_KEY:'B'.repeat(87)},
    navigator:nav,Notification:{permission:'granted',requestPermission:async()=>{calls.push('permission');return 'granted';}},PushManager:{},indexedDB:{},isSecureContext:true,
    crypto,btoa,atob,Uint8Array,Intl,fetch:async(url,options)=>{calls.push(JSON.parse(options.body));if(offline)throw new Error('Offline');return {ok:true,json:async()=>({...response,preferences:record.preferences})};}};
  vm.createContext(browser);vm.runInContext(esbuild.transformSync(libSource.replaceAll('import.meta.env','__env'),{format:'cjs'}).code,browser);
  return {api:module.exports,calls,response,setOffline(value){offline=value;},get record(){return record;}};
}
test('actual client requests permission only on Enable, binds one hub, persists capability and retries revocation',async()=>{
  const f=clientFixture();assert.equal(await f.api.loadReminderState('hub-a'),null);assert(!f.calls.includes('permission'));
  await f.api.enableHomeReminders('hub-a',defaults());
  assert(f.calls.indexOf('permission')<f.calls.indexOf('worker'));
  assert.equal(f.record.token.length,43);assert.equal(f.record.profile_id,'hub-a');
  assert.equal(f.calls.find(c=>typeof c==='object').action,'enroll');
  await assert.rejects(f.api.loadReminderState('hub-b'),/different hub/);
  await f.api.disableHomeReminders('hub-a');assert(f.calls.includes('browser-off'));assert.equal(f.record,undefined);
});
test('no feature side effects in preview, including client registration and storage',async()=>{
  const f=clientFixture();await f.api.loadReminderState('hub-a',{preview:true});await f.api.disableHomeReminders('hub-a',{preview:true});
  await assert.rejects(f.api.enableHomeReminders('hub-a',defaults(),{preview:true}));assert.equal(f.calls.length,0);
});
test('offline unsubscribe stops the browser first and retains only the credential needed to retry server removal',async()=>{
  const f=clientFixture();await f.api.enableHomeReminders('hub-a',defaults());f.setOffline(true);
  await assert.rejects(f.api.disableHomeReminders('hub-a'),/Offline/);
  assert.equal(f.record.unsubscribe_pending,true);assert(f.calls.includes('browser-off'));
  f.setOffline(false);assert.equal(await f.api.loadReminderState('hub-a'),null);assert.equal(f.record,undefined);
});
test('stable manifest identity ignores tracking URLs, preserves public branding, and registers only outside private preview',async()=>{
  const source=readFileSync(new URL('../src/lib/pwa.js',import.meta.url),'utf8');let writes=0,registrations=0,manifest;
  const module={exports:{}};
  const context=vm.createContext({module,exports:module.exports,require:()=>({pushStore:async(key,value)=>{writes++;manifest=value;}}),
    location:{protocol:'https:',hostname:'alex.closeandrelax.com',href:'https://alex.closeandrelax.com/?utm_source=test'},
    navigator:{serviceWorker:{controller:{},ready:Promise.resolve(),register:async(url,options)=>{registrations++;assert.equal(url,'/sw.js');assert.equal(options.scope,'/');return {};}}},setTimeout,clearTimeout});
  vm.runInContext(esbuild.transformSync(source,{format:'cjs'}).code,context);
  const {saveHubManifest,ensureHubWorker}=module.exports;
  await saveHubManifest({name:'Alex’s Home Hub',start_url:'/?tracking=yes',id:'/?tracking=yes'},{preview:true});await ensureHubWorker({preview:true});assert.equal(writes+registrations,0);
  await saveHubManifest({name:'Alex’s Home Hub',start_url:'/?tracking=yes',id:'/?tracking=yes'});
  assert.equal(manifest.name,'Alex’s Home Hub');assert.equal(manifest.id,'/');assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');assert.equal(registrations,1);
});
