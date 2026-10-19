import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { MIN_PASSWORD_LENGTH, PASSWORD_LENGTH_HINT, newPasswordError } from '../src/lib/passwordPolicy.js';
const app = readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
// Run the real submit handlers with isolated Auth/UI dependencies. No real Auth
// requests or passwords are sent, and no duplicate implementation is tested.
function handler(name,next,context) {
  const source = app.slice(app.indexOf(`const ${name} = async`),app.indexOf(`const ${next} = async`)).trim();
  assert.ok(source.startsWith(`const ${name} = async`));
  return new Function(...Object.keys(context),`${source}\nreturn ${name};`)(...Object.values(context));
}
function fixture({password='eight123',confirm=password,result={data:{user:{id:'fixture'},session:null}},throws=false}={}) {
  const calls=[],errors=[],recoveryErrors=[],loading=[],confirmation=[];
  const request = async (name,args) => {calls.push({name,args});if(throws)throw result;return result;};
  const context={newPasswordError,
    signupData:{password,email:'fixture@example.invalid',name:'Fixture',brokerage:'Example',marketCity:'City'},
    loginData:{password,email:'fixture@example.invalid'},newPasswordData:{password,confirmPassword:confirm},selectedPlan:'partner',
    supabase:{auth:{signUp:(args)=>request('signup',args),updateUser:(args)=>request('update',args),signInWithPassword:(args)=>request('login',args),signOut:()=>request('logout')}},
    setAuthError:(v)=>errors.push(v),setPasswordRecoveryError:(v)=>recoveryErrors.push(v),
    setActionLoading:(v)=>loading.push(v),setPasswordRecoveryLoading:(v)=>loading.push(v),
    setEmailConfirmationRequired:(v)=>confirmation.push(v),setSignupModalOpen:()=>{},setCurrentView:()=>{},showToast:()=>{},
    setLoginModalOpen:()=>{},setNewPasswordData:()=>{},_setCurrentView:()=>{},updateBrowserPath:()=>{},_setLoginModalOpen:()=>{},
  };
  return {calls,errors,recoveryErrors,loading,confirmation,
    signup:handler('handleSignupSubmit','handleLoginSubmit',context),
    reset:handler('handleResetPasswordSubmit','handleSignupSubmit',context),
    login:handler('handleLoginSubmit','handleLogout',context)};
}
const event={preventDefault(){}};

test('new-password minimum and shared copy are eight; passwords are not trimmed or transformed',()=>{
  assert.equal(MIN_PASSWORD_LENGTH,8);assert.equal(PASSWORD_LENGTH_HINT,'At least 8 characters');
  for(const value of [undefined,null,'','123456','1234567'])assert.equal(newPasswordError(value),'Your password must be at least 8 characters.');
  for(const value of ['12345678',' long password ','a'.repeat(64)])assert.equal(newPasswordError(value),'');
});
test('signup and reset handlers reject 6/7-character passwords before Auth and accept the same eight-character boundary',async()=>{
  for(const password of ['123456','1234567'])for(const flow of ['signup','reset']) {
    const f=fixture({password});await f[flow](event);
    assert.deepEqual(f.calls,[]);
    assert.equal((flow==='signup'?f.errors:f.recoveryErrors).at(-1),newPasswordError(password));
  }
  for(const flow of ['signup','reset']) {
    const f=fixture({password:' eight12',result:flow==='reset'?{data:{},error:null}:undefined});
    await f[flow](event);
    assert.equal(f.calls[0].args.password,' eight12');
    if(flow==='signup')assert.equal(f.confirmation.at(-1),true); // Neutral existing/new account acknowledgement retained.
  }
  const mismatch=fixture({confirm:'different'});await mismatch.reset(event);
  assert.equal(mismatch.recoveryErrors.at(-1),'The two passwords do not match.');assert.deepEqual(mismatch.calls,[]);
});
test('Supabase returned/thrown password errors remain visible and failed updates do not sign out or show success',async()=>{
  for(const flow of ['signup','reset'])for(const throws of [false,true]) {
    const message='Password does not meet the server security requirements.';
    const f=fixture({result:throws?new Error(message):{error:{message,code:'weak_password'}},throws});
    await f[flow](event);
    assert.equal((flow==='signup'?f.errors:f.recoveryErrors).at(-1),message);
    assert.equal(f.loading.at(-1),false);assert.equal(f.calls.length,1);
    assert.ok(!f.confirmation.includes(true));
  }
});
test('existing six-character login credentials still reach Auth unchanged',async()=>{
  const f=fixture({password:'old123',result:{data:{user:{id:'fixture'}}}});await f.login(event);
  assert.equal(f.calls[0].name,'login');assert.equal(f.calls[0].args.password,'old123');assert.equal(f.errors.at(-1),null);
  const input=app.match(/<input\s+type="password"\s+id="loginPassword"[\s\S]*?\/>/)[0];
  assert.doesNotMatch(input,/minLength/);
});
test('all new-password fields use shared native constraints/copy and no six-character signup guidance remains',()=>{
  assert.equal((app.match(/minLength=\{MIN_PASSWORD_LENGTH\}/g)||[]).length,3);
  assert.equal((app.match(/placeholder=\{PASSWORD_LENGTH_HINT\}/g)||[]).length,2);
  assert.doesNotMatch(app,/minLength=\{[68]\}|Minimum 6 characters|password\.length\s*<\s*[68]/);
});
