// Offline only: validate/stage an explicit package. Never connects to Supabase or deploys.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, copyFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, relative, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
export const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const MANIFEST_PATH='release/pre-stripe-security/manifest.json';
export const HISTORICAL_MAPPINGS=Object.freeze([
  ['20261012000000_update_preferred_vendor_limits.sql','20261015163221','update_preferred_vendor_limits'],
  ['20261016021806_emergency_services.sql','20261016023454','emergency_services'],
  ['20261016033634_homeowner_savings.sql','20261016043104','homeowner_savings'],
  ['20261016054605_insurance_funnel.sql','20261016060341','insurance_funnel'],
  ['20261017025446_insurance_structured_address.sql','20261017034234','insurance_structured_address'],
  ['20261018171924_homeowner_push.sql','20261018212856','homeowner_push'],
]);
export const ALLOWED_MIGRATIONS=Object.freeze([
  '20261019025425_restrict_standard_vendor_helper.sql',
  '20261019032658_enforce_profile_branding.sql',
  '20261019034056_enforce_vendor_downgrade_visibility.sql',
  '20261019035914_support_inbox.sql',
  '20261019172710_bootstrap_realtor_profile.sql',
  '20261019175354_deprecate_legacy_realtor_profiles.sql',
  '20261019180243_enforce_realtor_slugs.sql',
  '20261019181529_harden_vendor_updated_at_search_path.sql',
  '20261019183523_restrict_hub_activity_ingestion.sql',
  '20261019200249_realtor_signup_owner_notifications.sql',
]);
export const sha256LF=text=>createHash('sha256').update(text.replace(/\r\n/g,'\n')).digest('hex');
export const digestFile=path=>sha256LF(readFileSync(path,'utf8'));
function filesIn(dir) {
  return readdirSync(dir,{withFileTypes:true}).flatMap(item=>item.isDirectory()?filesIn(join(dir,item.name)):[join(dir,item.name)]);
}
export function frontendFiles(root=ROOT) {
  return [...filesIn(join(root,'src')),...filesIn(join(root,'public')),
    ...['index.html','package.json','pnpm-lock.yaml','vercel.json','vite.config.js','tailwind.config.js','postcss.config.js'].map(file=>join(root,file))]
    .filter(existsSync).map(file=>relative(root,file).replaceAll('\\','/')).sort();
}
export function validateRelease(manifest=JSON.parse(readFileSync(join(ROOT,MANIFEST_PATH),'utf8')),root=ROOT) {
  const fail=message=>{throw Error(`Release validation failed: ${message}`);};
  if(manifest.project_ref!=='hphcejnvxyccmwmofdqc'||manifest.mode!=='explicit_allowlist')fail('unexpected target/mode');
  if(JSON.stringify(manifest.selected.map(item=>item.file))!==JSON.stringify(ALLOWED_MIGRATIONS))fail('selected migration order/allowlist differs');
  if(manifest.excluded.length!==1||manifest.excluded[0]!=='20261018151224_retire_emergency_services.sql')fail('retirement exclusion missing');
  const seen=new Set();
  for(const item of manifest.selected) {
    if(seen.has(item.file))fail('duplicate migration');
    for(const dependency of item.depends_on)if(!seen.has(dependency))fail('dependency not applied first');
    if(digestFile(join(root,'supabase/migrations',item.file))!==item.sha256_lf)fail(`source changed: ${item.file}`);
    seen.add(item.file);
  }
  if(manifest.historical.length!==6||new Set(manifest.historical.map(item=>item.production_version)).size!==6)fail('historical mapping incomplete');
  if(JSON.stringify(manifest.historical.map(item=>[item.file,item.production_version,item.name]))!==JSON.stringify(HISTORICAL_MAPPINGS))fail('historical alias mapping changed');
  for(const item of manifest.historical) {
    if(item.action!=='already_applied_do_not_execute'||seen.has(item.file))fail('historical replay requested');
    if(digestFile(join(root,'supabase/migrations',item.file))!==item.sha256_lf)fail('historical source changed; review mapping');
  }
  if(JSON.stringify(frontendFiles(root))!==JSON.stringify(manifest.frontend.files.map(item=>item.file)))fail('frontend file inventory changed');
  for(const item of manifest.frontend.files)if(digestFile(join(root,item.file))!==item.sha256_lf)fail(`frontend changed: ${item.file}`);
  for(const item of manifest.edge_files)if(digestFile(join(root,item.file))!==item.sha256_lf)fail(`Edge dependency changed: ${item.file}`);
  return manifest;
}
export function validateInitialHistory(snapshot,manifest=validateRelease()) {
  if(snapshot.project_ref!=='hphcejnvxyccmwmofdqc'||!Array.isArray(snapshot.migrations))throw Error('Wrong history target or shape.');
  const expected=manifest.historical.map(item=>({version:item.production_version,name:item.name})).sort((a,b)=>a.version.localeCompare(b.version));
  const observed=snapshot.migrations.map(item=>({version:item.version,name:item.name})).sort((a,b)=>a.version.localeCompare(b.version));
  if(JSON.stringify(expected)!==JSON.stringify(observed))throw Error('Initial production history differs; stop and review drift/partial rollout.');
  return true;
}
export function stageRelease(output,manifest=validateRelease(),root=ROOT) {
  // Revalidate even when caller supplied a manifest; staging never applies SQL.
  validateRelease(manifest,root);
  const target=resolve(output),migrationRoot=join(root,'supabase/migrations');
  if(target===root||target===migrationRoot||relative(migrationRoot,target)===''||!relative(migrationRoot,target).startsWith('..'))throw Error('Do not stage inside source migrations.');
  if(existsSync(target))throw Error('Output must be a new directory; nothing will be overwritten.');
  mkdirSync(join(target,'selected-migrations'),{recursive:true});
  for(const item of manifest.selected)copyFileSync(join(root,'supabase/migrations',item.file),join(target,'selected-migrations',item.file));
  writeFileSync(join(target,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  for(const file of ['README.md','preflight.sql','postflight.sql','production-history-observed.json','rehearsal-results.md'])copyFileSync(join(root,'release/pre-stripe-security',file),join(target,file));
  return target;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  try {
    const args=process.argv.slice(2);
    if(args.length&&!(args.length===2&&['--out','--history'].includes(args[0])))throw Error('Usage: node tools/prepare-pre-stripe-release.mjs [--out NEW_DIRECTORY | --history READ_ONLY_HISTORY_JSON]');
    const manifest=validateRelease();
    const observed=JSON.parse(readFileSync(join(ROOT,'release/pre-stripe-security/production-history-observed.json'),'utf8'));
    validateInitialHistory(observed,manifest);
    console.log('Validated: 10 selected migrations, 6 historical mappings, matching frontend/Edge sources. No database connection or deployment.');
    if(args[0]==='--out')console.log(`Offline package staged: ${stageRelease(args[1],manifest)}`);
    if(args[0]==='--history'){validateInitialHistory(JSON.parse(readFileSync(resolve(args[1]),'utf8')),manifest);console.log('Supplied initial history matches the six approved production aliases.');}
  }catch(error){console.error(error.message);process.exitCode=1;}
}
