import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { digest, inventory, loadRelease } from '../scripts/public-inputs.mjs';
import { checkOutput } from '../scripts/check-static.mjs';
import { checkReviewOutput } from '../scripts/check-review.mjs';
const root=process.cwd();
const env={PATH:process.env.PATH,HOME:tmpdir(),ASTRO_TELEMETRY_DISABLED:'1',NODE_ENV:'production'};
function run(base,script) {
 const result=spawnSync(process.execPath,[script],{cwd:base,env,encoding:'utf8',timeout:60000,maxBuffer:1024*1024});
 assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
}
function snapshot(base,path) { return inventory(base,path).map(p=>[p.slice(path.length+1),digest(readFileSync(join(base,p)))]); }
test('isolated website-only builds: deterministic normal and fixture outputs, no Studio/network',async()=>{
 const base=mkdtempSync(join(tmpdir(),'tt-isolated-')),editorialBackup=mkdtempSync(join(tmpdir(),'tt-editorial-baseline-'));
 try {
  for(const path of ['src','scripts','schemas','content','public-astro','astro.config.mjs','package.json','package-lock.json','.npmrc'])cpSync(join(root,path),join(base,path),{recursive:true});
  const configPath=join(base,'astro.config.mjs');writeFileSync(configPath,readFileSync(configPath,'utf8').replace('vite: { resolve:', `vite: { cacheDir: '${join(base,'.vite-cache')}', resolve:`));
  mkdirSync(join(base,'public-astro/assets'),{recursive:true});
  const initial=loadRelease({base});assert(initial.flavors.some(f=>f.slug==='grape'));
  const editorialPath=join(base,'content/editorial'),hasEditorial=existsSync(editorialPath);
  if(hasEditorial)cpSync(editorialPath,join(editorialBackup,'editorial'),{recursive:true});
  symlinkSync(join(root,'node_modules'),join(base,'node_modules'));
  // Dependencies are reused locally; content/source are isolated with no Studio/artwork/credentials.
  const blocker=join(base,'no-network.cjs');
  writeFileSync(blocker,"const fail=()=>{throw Error('Content network forbidden in isolated test')};globalThis.fetch=fail;for(const name of ['http','https','net','tls','dns']){const m=require('node:'+name);for(const k of ['request','get','connect','lookup','resolve'])if(typeof m[k]==='function')m[k]=fail;}\n");
  env.NODE_OPTIONS='--require='+blocker;
  writeFileSync(join(base,'normal-build.mjs'),"import {build} from 'astro';await build({root:process.cwd()});await import('./scripts/write-seo-output.mjs');\n");
  run(base,'normal-build.mjs');await checkOutput(base);const normal=snapshot(base,'dist');
  run(base,'normal-build.mjs');assert.deepEqual(snapshot(base,'dist'),normal);await checkOutput(base);
  // Website editorial uses a bilingual synthetic record only inside this isolated build.
  const grape=initial.flavors.find(flavor=>flavor.slug==='grape');
  mkdirSync(join(base,'content/editorial'),{recursive:true});
  writeFileSync(join(base,'content/editorial/grape.json'),JSON.stringify({contractVersion:'1',kind:'website-editorial',flavor:grape.flavor,story:{translations:{
   en:{title:'A sample English story.',paragraphs:['First English sample paragraph.','Second English sample paragraph.']},
   'es-MX':{title:'Un relato de ejemplo.',paragraphs:['Primer párrafo de ejemplo.','Segundo párrafo de ejemplo.']},
  }}},null,2)+'\n');
  run(base,'normal-build.mjs');await checkOutput(base);
  const englishStory=readFileSync(join(base,'dist/flavors/grape/index.html'),'utf8');
  const spanishStory=readFileSync(join(base,'dist/es/flavors/grape/index.html'),'utf8');
  assert(englishStory.includes('A sample English story.')&&englishStory.includes('First English sample paragraph.')&&englishStory.includes('Second English sample paragraph.'));
  assert(spanishStory.includes('Un relato de ejemplo.')&&spanishStory.includes('Primer párrafo de ejemplo.')&&spanishStory.includes('Segundo párrafo de ejemplo.'));
  assert(!englishStory.includes('Un relato de ejemplo.')&&!englishStory.includes('Primer párrafo de ejemplo.'));
  assert(!spanishStory.includes('A sample English story.')&&!spanishStory.includes('First English sample paragraph.'));
  for(const path of ['flavors/cherry/index.html','flavors/lime/index.html','es/flavors/cherry/index.html','es/flavors/lime/index.html','index.html','es/index.html','flavors/index.html','es/flavors/index.html']) {
   const html=readFileSync(join(base,'dist',path),'utf8');
   assert(!html.includes('A sample English story.')&&!html.includes('Un relato de ejemplo.'),`Story leaked to ${path}`);
  }
  rmSync(editorialPath,{recursive:true,force:true});
  if(hasEditorial)cpSync(join(editorialBackup,'editorial'),editorialPath,{recursive:true});
  run(base,'normal-build.mjs');await checkOutput(base);assert.deepEqual(snapshot(base,'dist'),normal,'Restoring the initial editorial records restores the initial output');
  // Withdraw only in this isolated candidate; preserve all original repository inputs/history.
  const selectedPaths=initial.flavors.flatMap(f=>[`content/flavors/${f.slug}.json`,`public-astro/${f.mediaUrl.slice(1)}`]);
  const selectedBytes=Object.fromEntries(selectedPaths.map(p=>[p,readFileSync(join(base,p))]));
  rmSync(editorialPath,{recursive:true,force:true});
  for(const p of selectedPaths)rmSync(join(base,p));
  run(base,'normal-build.mjs');await checkOutput(base);const empty=snapshot(base,'dist');assert.equal(empty.length,17);
  // A page-level style update changes the shared CSS asset URL; pin the resulting documents.
  const baselineHashes={'index.html':'11f3e479cf8a3a561aa00e49a3308cb1666d5001ad522291ae1a61fb6839f4bf','about/index.html':'bcd467a086073b205a62c03a71a2b0bc398b6d53a63fdf6f332df807e255708e','flavors/index.html':'94ca818dce1d6f2248b563ceb5c3d95b4026f3d7ec8e5346861b82235108060b','es/flavors/index.html':'b25f53305ccef5230bd512edbd62835c9c051c7915004bebee2e1d620f2e101b','es/index.html':'26e7fdef5904b4ce8ef56c77d10fc3c5855e657c5a1a13ee5784ae9d1780db5e'};
  const baselineMismatches=[];
  for(const [p,h]of empty){if(p in baselineHashes){if(h!=='sha256:'+baselineHashes[p])baselineMismatches.push([p,h]);}else assert.equal(h,normal.find(([n])=>n===p)[1],p);}
  assert.deepEqual(baselineMismatches,[],'Empty-release pinned HTML outputs changed');
  // Leftover bytes are not a valid withdrawal even without references.
  const firstMedia=initial.flavors[0].mediaUrl.slice(1),strayPath=`public-astro/${firstMedia}`;
  writeFileSync(join(base,strayPath),selectedBytes[strayPath]);assert.throws(()=>loadRelease({base}),/Unlisted/);rmSync(join(base,strayPath));
  for(const [p,b]of Object.entries(selectedBytes))writeFileSync(join(base,p),b);
  if(hasEditorial)cpSync(join(editorialBackup,'editorial'),editorialPath,{recursive:true});
  run(base,'normal-build.mjs');await checkOutput(base);assert.deepEqual(snapshot(base,'dist'),normal);
  // Demonstrate that the same filename/digest comparator detects nondeterminism and extra output.
  const homePath=join(base,'dist/index.html'),homeBytes=readFileSync(homePath);
  writeFileSync(homePath,Buffer.concat([homeBytes,Buffer.from('\n<!-- nondeterministic output -->')]));
  assert.throws(()=>assert.deepEqual(snapshot(base,'dist'),normal));writeFileSync(homePath,homeBytes);
  const extraPath=join(base,'dist/_astro/unlisted.css');writeFileSync(extraPath,'body {}');
  assert.throws(()=>assert.deepEqual(snapshot(base,'dist'),normal));await assert.rejects(()=>checkOutput(base));rmSync(extraPath);
  cpSync(join(root,'tests/fixtures'),join(base,'tests/fixtures'),{recursive:true});
  // Selected review delivery suffices: no legacy master or Studio is present in this copy.
  cpSync(join(root,'review-assets'),join(base,'review-assets'),{recursive:true});
  run(base,'scripts/build-review.mjs');await checkReviewOutput(base);const fixture=snapshot(base,'.review-build');
  // Reverse set-like source arrays and re-pin exact bytes; the rendered output must remain identical.
  for(const [file,key] of [['release-set.json','members'],['media.json','entries'],['eligibility.json','assumptions']]) {
   const path=join(base,'tests/fixtures/public-inputs',file);const v=JSON.parse(readFileSync(path));v[key].reverse();writeFileSync(path,JSON.stringify(v,null,2)+'\n');
  }
  const ep=join(base,'tests/fixtures/public-inputs/eligibility.json');const e=JSON.parse(readFileSync(ep));e.mediaContentId=digest(readFileSync(join(base,'tests/fixtures/public-inputs/media.json')));writeFileSync(ep,JSON.stringify(e,null,2)+'\n');
  const rp=join(base,'tests/fixtures/public-inputs/release-set.json');const r=JSON.parse(readFileSync(rp));r.eligibilitySnapshot.contentId=digest(readFileSync(ep));writeFileSync(rp,JSON.stringify(r,null,2)+'\n');
  run(base,'scripts/build-review.mjs');assert.deepEqual(snapshot(base,'.review-build'),fixture);await checkReviewOutput(base);
  assert.deepEqual(snapshot(base,'dist'),normal,'Review build must not touch normal output');
  // A subsequent normal build remains fixture-free even with fixture inputs and review output present.
  run(base,'normal-build.mjs');assert.deepEqual(snapshot(base,'dist'),normal);await checkOutput(base);
  console.log(`Isolated determinism: ${normal.length} normal files, ${fixture.length} review files; content network blocked.`);
 } finally { delete env.NODE_OPTIONS;rmSync(base,{recursive:true,force:true});rmSync(editorialBackup,{recursive:true,force:true}); }
});
test('normal output rejects fixture bytes/markers and unexpected Flavor routes',async()=>{
 const base=mkdtempSync(join(tmpdir(),'tt-output-'));
 try {
  for (const path of ['dist','schemas','content','public-astro']) cpSync(join(root,path),join(base,path),{recursive:true});
  for(const marker of ['fixture-coral','INTERNAL SYNTHETIC TEST ONLY','authorityEvidence','/Users/private/record','publication-decision']) {
   const p=join(base,'dist/index.html');const original=readFileSync(p);writeFileSync(p,Buffer.concat([original,Buffer.from(marker)]));await assert.rejects(()=>checkOutput(base));writeFileSync(p,original);
  }
  mkdirSync(join(base,'dist/flavors/unlisted'),{recursive:true});writeFileSync(join(base,'dist/flavors/unlisted/index.html'),readFileSync(join(base,'dist/index.html')));await assert.rejects(()=>checkOutput(base));
 }finally{rmSync(base,{recursive:true,force:true});}
});
