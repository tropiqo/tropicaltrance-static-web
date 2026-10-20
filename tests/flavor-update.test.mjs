import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { applyCandidate, cancelCandidate, createCandidate } from '../scripts/flavor-update.mjs';
import { digest, loadRelease } from '../scripts/public-inputs.mjs';

const root=process.cwd();
function sandbox(){
 const base=mkdtempSync(join(tmpdir(),'tt-flavor-update-'));
 for(const path of ['src','scripts','schemas','content','public-astro','astro.config.mjs','package.json','package-lock.json'])if(existsSync(join(root,path)))cpSync(join(root,path),join(base,path),{recursive:true});
 for(const name of readdirSync(join(base,'content/flavors')))if(name!=='grape.json')rmSync(join(base,'content/flavors',name));
 const grape=JSON.parse(readFileSync(join(base,'content/flavors/grape.json'),'utf8'));
 for(const name of readdirSync(join(base,'public-astro/assets')))if(/-web-r[0-9]+\.webp$/.test(name)&&![grape.media.path.slice('assets/'.length),'trancy-web-r1.webp'].includes(name))rmSync(join(base,'public-astro/assets',name));
 symlinkSync(join(root,'node_modules'),join(base,'node_modules'),'dir');return base;
}
async function sample(path,{color={r:80,g:120,b:180,alpha:0.7},format='png'}={}){
 let pipeline=sharp({create:{width:40,height:60,channels:4,background:color}});
 if(format==='png')pipeline=pipeline.png();else if(format==='jpeg')pipeline=pipeline.flatten({background:'#fff'}).jpeg();
 await pipeline.toFile(path);
}

test('new flavor can be prepared and rendered in an isolated Astro preview build then cancelled without website changes',async()=>{
 const base=sandbox(),image=join(base,'input.png');await sample(image);
 const before=loadRelease({base});const original=readFileSync(join(base,'content/flavors/grape.json'));
 const candidate=await createCandidate({websiteRoot:base,slug:'kiwi',imagePath:image,name:'Kiwi',shortDescription:'Explore Kiwi.',alt:'Kiwi flavor artwork.'});
 try {
  assert.deepEqual(loadRelease({base}).flavors.map(f=>f.slug),['grape']);
  assert(readFileSync(join(candidate.candidateRoot,'dist/flavors/kiwi/index.html'),'utf8').includes('Kiwi flavor artwork.'));
  assert.deepEqual(loadRelease({base}).flavors,before.flavors);cancelCandidate(candidate);
  assert.deepEqual(readFileSync(join(base,'content/flavors/grape.json')),original);
 } finally {rmSync(base,{recursive:true,force:true});}
});

test('confirmed replacement applies one new revision and safely withdraws old unshared bytes',async()=>{
 const base=sandbox(),image=join(base,'replace.png');await sample(image,{color:{r:190,g:50,b:110,alpha:1}});
 const prior=JSON.parse(readFileSync(join(base,'content/flavors/grape.json'),'utf8'));
 const revision=String(Number(prior.revision)+1),oldAsset=`public-astro/${prior.media.path}`;
 const candidate=await createCandidate({websiteRoot:base,slug:'grape',imagePath:image});
 try {
  assert(readFileSync(join(candidate.candidateRoot,'dist/flavors/grape/index.html'),'utf8').includes(prior.shortDescription));
  const changed=applyCandidate(candidate,{validate:false});assert.equal(changed.removedOld,oldAsset);
  const release=loadRelease({base});const grape=release.flavors.find(f=>f.slug==='grape');assert.equal(grape.flavor.revision,revision);assert.equal(grape.mediaUrl,`/assets/grape-web-r${revision}.webp`);
  assert.equal(grape.media.contentId,digest(readFileSync(join(base,'public-astro',grape.mediaUrl.slice(1)))));
 } finally {cancelCandidate(candidate);rmSync(base,{recursive:true,force:true});}
});

test('new sample flavor can be confirmed without touching the accepted Grape record',async()=>{
 const base=sandbox(),image=join(base,'new-flavor.png');await sample(image);
 const grapeBefore=readFileSync(join(base,'content/flavors/grape.json'));
 const candidate=await createCandidate({websiteRoot:base,slug:'kiwi',imagePath:image,name:'Kiwi',shortDescription:'Explore Kiwi.',alt:'Kiwi flavor artwork.'});
 try {
  const changed=applyCandidate(candidate,{validate:false});assert.match(changed.contentPath,/content\/flavors\/kiwi\.json$/);
  const release=loadRelease({base});assert.deepEqual(release.flavors.map(f=>f.slug),['grape','kiwi']);
  assert.deepEqual(readFileSync(join(base,'content/flavors/grape.json')),grapeBefore);
  assert.equal(release.flavors[1].mediaUrl,'/assets/kiwi-web-r1.webp');
 } finally {cancelCandidate(candidate);rmSync(base,{recursive:true,force:true});}
});

test('failed post-apply validation restores prior content and image bytes',async()=>{
 const base=sandbox(),image=join(base,'failed-validation.png');await sample(image);
 const priorContent=readFileSync(join(base,'content/flavors/grape.json'));
 const prior=JSON.parse(priorContent),priorImage=readFileSync(join(base,'public-astro',prior.media.path));
 const candidate=await createCandidate({websiteRoot:base,slug:'grape',imagePath:image});
 try {
  assert.throws(()=>applyCandidate(candidate,{runValidation:()=>{throw Error('fixture validation failure');}}),/fixture validation failure/);
  assert.deepEqual(readFileSync(join(base,'content/flavors/grape.json')),priorContent);
  assert.deepEqual(readFileSync(join(base,'public-astro',prior.media.path)),priorImage);
  assert.deepEqual(loadRelease({base}).flavors.map(f=>f.slug),['grape']);
 } finally {cancelCandidate(candidate);rmSync(base,{recursive:true,force:true});}
});

test('stale candidates and invalid or symlinked image inputs are rejected before application',async()=>{
 const base=sandbox(),image=join(base,'sample.png');await sample(image);
 const candidate=await createCandidate({websiteRoot:base,slug:'kiwi',imagePath:image,name:'Kiwi',shortDescription:'Explore Kiwi.',alt:'Kiwi artwork.'});
 try {writeFileSync(join(base,'content/site.json'),readFileSync(join(base,'content/site.json')));writeFileSync(join(base,'content/site.json'),JSON.stringify({contractVersion:'1',kind:'development-site',lang:'en',title:'Changed locally',description:'No publication approval.'},null,2)+'\n');assert.throws(()=>applyCandidate(candidate,{validate:false}),/stale/);} finally {cancelCandidate(candidate);}
 const bad=join(base,'bad.png');writeFileSync(bad,'not an image');await assert.rejects(()=>createCandidate({websiteRoot:base,slug:'kiwi',imagePath:bad,name:'Kiwi',shortDescription:'Explore Kiwi.',alt:'Kiwi artwork.'}));
 const link=join(base,'linked.png');symlinkSync(image,link);await assert.rejects(()=>createCandidate({websiteRoot:base,slug:'kiwi',imagePath:link,name:'Kiwi',shortDescription:'Explore Kiwi.',alt:'Kiwi artwork.'}));
 rmSync(base,{recursive:true,force:true});
});
