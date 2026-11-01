import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from 'node:fs';
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
 const base=mkdtempSync(join(tmpdir(),'tt-isolated-'));
 try {
  for(const path of ['src','scripts','schemas','content','public-astro','astro.config.mjs','package.json','package-lock.json','.npmrc'])cpSync(join(root,path),join(base,path),{recursive:true});
  const configPath=join(base,'astro.config.mjs');writeFileSync(configPath,readFileSync(configPath,'utf8').replace('vite: { resolve:', `vite: { cacheDir: '${join(base,'.vite-cache')}', resolve:`));
  mkdirSync(join(base,'public-astro/assets'),{recursive:true});
  const initial=loadRelease({base});assert(initial.flavors.some(f=>f.slug==='grape'));
  symlinkSync(join(root,'node_modules'),join(base,'node_modules'));
  // Dependencies are reused locally; content/source are isolated with no Studio/artwork/credentials.
  const blocker=join(base,'no-network.cjs');
  writeFileSync(blocker,"const fail=()=>{throw Error('Content network forbidden in isolated test')};globalThis.fetch=fail;for(const name of ['http','https','net','tls','dns']){const m=require('node:'+name);for(const k of ['request','get','connect','lookup','resolve'])if(typeof m[k]==='function')m[k]=fail;}\n");
  env.NODE_OPTIONS='--require='+blocker;
  writeFileSync(join(base,'normal-build.mjs'),"import {build} from 'astro';await build({root:process.cwd()});await import('./scripts/write-seo-output.mjs');\n");
  run(base,'normal-build.mjs');await checkOutput(base);const normal=snapshot(base,'dist');
  run(base,'normal-build.mjs');assert.deepEqual(snapshot(base,'dist'),normal);await checkOutput(base);
  // Withdraw only in this isolated candidate; preserve all original repository inputs/history.
  const selectedPaths=initial.flavors.flatMap(f=>[`content/flavors/${f.slug}.json`,`public-astro/${f.mediaUrl.slice(1)}`]);
  const selectedBytes=Object.fromEntries(selectedPaths.map(p=>[p,readFileSync(join(base,p))]));
  for(const p of selectedPaths)rmSync(join(base,p));
  run(base,'normal-build.mjs');await checkOutput(base);const empty=snapshot(base,'dist');assert.equal(empty.length,17);
  const baselineHashes={'index.html':'f07a3cc641ac234da4b91f78d1e7d499a65e82f060f2685312767b73a8b9fb08','about/index.html':'c2edb6324dc3dc5d8a0d1afffe30b5cfe1d191b869c7872724449358944e7dbe','flavors/index.html':'11982141937439ab317eb264c8fcd84a6d28849deb196fde6d90db2dcc65943f','es/flavors/index.html':'f5ef1d115146a9e966d4ded94b22fdfed5b2107d54bf9b6392e0b9d47cf893c8','es/index.html':'2baefbfa26338a3e4fbb78bbf157aa87b945bb31f0d1ed2f97197e6f8490a190'};
  const baselineMismatches=[];
  for(const [p,h]of empty){if(p in baselineHashes){if(h!=='sha256:'+baselineHashes[p])baselineMismatches.push([p,h]);}else assert.equal(h,normal.find(([n])=>n===p)[1],p);}
  assert.deepEqual(baselineMismatches,[],'Empty-release pinned HTML outputs changed');
  // Leftover bytes are not a valid withdrawal even without references.
  const firstMedia=initial.flavors[0].mediaUrl.slice(1),strayPath=`public-astro/${firstMedia}`;
  writeFileSync(join(base,strayPath),selectedBytes[strayPath]);assert.throws(()=>loadRelease({base}),/Unlisted/);rmSync(join(base,strayPath));
  for(const [p,b]of Object.entries(selectedBytes))writeFileSync(join(base,p),b);
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
 } finally { delete env.NODE_OPTIONS;rmSync(base,{recursive:true,force:true}); }
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
