import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithEsbuild } from 'vite';
import { newPasswordError } from '../src/lib/passwordPolicy.js';
import * as passwordPolicy from '../src/lib/passwordPolicy.js';
const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const app=read('../src/App.jsx');
function realHandler(name,next,context) {
  const start=app.indexOf(`const ${name} = `),end=app.indexOf(`const ${next} = `,start);
  assert.ok(start>=0 && end>start);
  return new Function(...Object.keys(context),`${app.slice(start,end)}\nreturn ${name};`)(...Object.values(context));
}
test('logout clears account state only after a confirmed successful signOut; returned/thrown errors remain actionable',async()=>{
  for(const outcome of ['success','returned_error','thrown_error','busy']) {
    const changes=[],errors=[],loading=[],toasts=[];let calls=0;
    const context={actionLoading:outcome==='busy',supabase:{auth:{signOut:async()=>{calls++;if(outcome==='thrown_error')throw Error('offline');return {error:outcome==='returned_error'?{message:'offline'}:null};}}},
      setActionLoading:v=>loading.push(v),setLogoutError:v=>errors.push(v),showToast:v=>toasts.push(v)};
    for(const name of ['setAccountSettingsOpen','setMobileMenuOpen','setSession','setUser','setProfile','setCurrentView'])context[name]=value=>changes.push([name,value]);
    await realHandler('handleLogout','toggleFaq',context)();
    assert.equal(calls,outcome==='busy'?0:1);
    if(outcome==='success') {
      assert.ok(changes.some(([name,value])=>name==='setUser'&&value===null));
      assert.deepEqual(toasts,['You have been logged out.']);assert.equal(errors.at(-1),'');
    } else {assert.deepEqual(changes,outcome==='busy'?[]:[['setAccountSettingsOpen',false]]);assert.deepEqual(toasts,[]);if(outcome!=='busy')assert.match(errors.at(-1),/could not confirm logout.*retry/i);}
    if(outcome!=='busy')assert.deepEqual(loading,[true,false]);
  }
});
test('closure request opens existing Support with login email, manual request text and no deletion operation',()=>{
  let draft,opened=false,settings=true;
  const context={profile:{full_name:'Public Realtor',email:'public@example.invalid'},user:{email:'login@example.invalid'},
    setAccountSettingsOpen:v=>{settings=v;},setSupportDraftContext:v=>{draft=v;},setContactModalOpen:v=>{opened=v;}};
  const open=realHandler('openAccountSupport','focusPublicationControl',context);
  open(true);assert.equal(opened,true);assert.equal(settings,false);
  assert.equal(draft.initialEmail,'login@example.invalid');assert.equal(draft.initialName,'Public Realtor');
  assert.match(draft.initialMessage,/verify ownership.*before deleting anything/s);
  open();assert.equal(draft.initialMessage,'');
  assert.doesNotMatch(app,/auth\.admin\.deleteUser|rpc\(['"]delete|from\(['"]profiles['"]\)\s*\.delete/);
});
test('password update followed by failed logout reports the successful password change honestly without claiming signout',async()=>{
  for(const failure of ['returned','thrown']) {
    let message='',navigated=false,cleared=false;
    const context={newPasswordError,newPasswordData:{password:'new-password-123',confirmPassword:'new-password-123'},
      supabase:{auth:{updateUser:async()=>({error:null}),signOut:async()=>{if(failure==='thrown')throw Error();return {error:{message:'offline'}};}}},
      setPasswordRecoveryError:v=>{message=v;},setPasswordRecoveryLoading:()=>{},setNewPasswordData:()=>{cleared=true;},
      _setCurrentView:()=>{navigated=true;},updateBrowserPath:()=>{navigated=true;},_setLoginModalOpen:()=>{},showToast:()=>{throw Error('No success toast expected');}};
    await realHandler('handleResetPasswordSubmit','handleSignupSubmit',context)({preventDefault(){}});
    assert.match(message,/password was updated, but logout could not be confirmed/);assert.equal(navigated,false);assert.equal(cleared,true);
  }
});
test('Account Settings separates public/login email for Free/Core/Pro and has only request/navigation controls',async()=>{
  const compiled=await transformWithEsbuild(read('../src/components/AccountSettingsDialog.jsx'),'AccountSettingsDialog.jsx',{loader:'jsx',format:'cjs',jsx:'transform'});
  const module={exports:{}},require=createRequire(import.meta.url);
  new Function('require','module','exports',compiled.code)(name=>name==='../lib/passwordPolicy'?passwordPolicy:require(name),module,module.exports);
  const Settings=module.exports.default;
  for(const [planName,vendorLimit] of [['Free',5],['Core',15],['Pro',30]]) {
    const html=renderToStaticMarkup(React.createElement(Settings,{user:{email:'login@example.invalid'},profile:{email:'public@example.invalid',is_published:false},planName,vendorLimit}));
    for(const copy of ['Account &amp; Settings','login@example.invalid','public@example.invalid',`${planName} · up to ${vendorLimit}`,'Reset password','Contact Support','Request account closure / deletion','Manage hub visibility','not instantly close or delete','not a billing statement'])assert.ok(html.includes(copy),copy);
    assert.match(html,/role="dialog".*aria-modal="true"/);assert.doesNotMatch(html,/Publish My Hub|Unpublish Hub|Change plan|Save login email/);
  }
  assert.match(app,/handleOpenForgotPassword\(user\.email\)/);
  assert.match(app,/This does not change your account login email/);
  assert.equal((app.match(/onClick=\{handleTogglePublish\}/g)||[]).length,1);
  assert.match(app,/else if \(step === 'publish'\) focusPublicationControl\(\)/);
});
test('closing password recovery returns signed-in Realtors to their dashboard and visitors to login',()=>{
  for(const signedIn of [false,true]) {
    const calls=[];
    const context={user:signedIn?{id:'fixture'}:null};
    for(const name of ['setForgotPasswordOpen','setPasswordRecoveryError','setForgotPasswordSent','_setLoginModalOpen','setCurrentView','setLoginModalOpen'])context[name]=value=>calls.push([name,value]);
    realHandler('closePasswordRequest','handleForgotPasswordSubmit',context)();
    assert.ok(calls.some(([name,value])=>name==='setForgotPasswordOpen'&&value===false));
    if(signedIn){assert.ok(calls.some(([name,value])=>name==='setCurrentView'&&value==='dashboard'));assert.ok(!calls.some(([name])=>name==='setLoginModalOpen'));}
    else assert.ok(calls.some(([name,value])=>name==='setLoginModalOpen'&&value===true));
  }
});
