import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { applyCandidate, cancelCandidate, createCandidate } from '../scripts/flavor-workflow.mjs';

const root=process.cwd();

if(process.env.TT_SKIP_METADATA_VALIDATION_REGRESSION!=='1')test('valid Cherry metadata-only update passes full validation in an isolated website copy',async()=>{
 const base=mkdtempSync(join(tmpdir(),'tt-cherry-metadata-validation-'));
 for(const path of ['src','scripts','schemas','content','public-astro','tests','assets/images','astro.config.mjs','package.json','package-lock.json','tsconfig.json']){
  if(existsSync(join(root,path)))cpSync(join(root,path),join(base,path),{recursive:true});
 }
 symlinkSync(join(root,'node_modules'),join(base,'node_modules'),'dir');
 const contentPath=join(base,'content/flavors/cherry.json');
 const before=JSON.parse(readFileSync(contentPath,'utf8'));
 const originalImage=readFileSync(join(base,'public-astro',before.media.path));
 const candidate=await createCandidate({mode:'update',websiteRoot:base,slug:'cherry',shortDescription:'Discover a new tropical Cherry adventure.'});
 try{
  assert.equal(candidate.kind,'metadata-only');
  assert.equal(candidate.projection.shortDescription,'Discover a new tropical Cherry adventure.');
  assert.equal(candidate.projection.translations['es-MX'].shortDescription,before.translations['es-MX'].shortDescription);
  assert.equal(candidate.projection.revision,before.revision);
  assert.deepEqual(candidate.projection.media,before.media);
  applyCandidate(candidate,{runValidation:()=>{
   const result=spawnSync('npm',['run','validate'],{cwd:base,encoding:'utf8',timeout:120000,maxBuffer:10*1024*1024,env:{...process.env,TT_SKIP_METADATA_VALIDATION_REGRESSION:'1'}});
   assert.equal(result.status,0,`${result.stdout||''}\n${result.stderr||''}`);
  }});
  const after=JSON.parse(readFileSync(contentPath,'utf8'));
  assert.equal(after.shortDescription,'Discover a new tropical Cherry adventure.');
  assert.equal(after.revision,before.revision);
  assert.deepEqual(after.media,before.media);
  assert.deepEqual(readFileSync(join(base,'public-astro',after.media.path)),originalImage);
 }finally{
  cancelCandidate(candidate);
  rmSync(base,{recursive:true,force:true});
 }
});
