import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { applyCandidate, applyRemoval, cancelCandidate, createCandidate, createRemovalCandidate } from '../scripts/flavor-workflow.mjs';
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
async function addFlavorRecord(base,slug){
 const bytes=await sharp({create:{width:32,height:48,channels:3,background:{r:70,g:180,b:80}}}).webp({lossless:true}).toBuffer();
 const mediaPath=`assets/${slug}-web-r1.webp`;
 writeFileSync(join(base,'public-astro',mediaPath),bytes);
 writeFileSync(join(base,`content/flavors/${slug}.json`),JSON.stringify({contractVersion:'1',slug,revision:'1',name:slug[0].toUpperCase()+slug.slice(1),shortDescription:`Explore ${slug}.`,alt:`${slug} test artwork.`,translations:{'es-MX':{shortDescription:`Explora ${slug}.`,alt:`Ilustración de ${slug}.`}},media:{path:mediaPath,contentId:digest(bytes)}},null,2)+'\n');
}

test('new flavor can be prepared and rendered in an isolated Astro preview build then cancelled without website changes',async()=>{
 const base=sandbox(),image=join(base,'input.png');await sample(image);
 const before=loadRelease({base});const original=readFileSync(join(base,'content/flavors/grape.json'));
 const candidate=await createCandidate({mode:'add',websiteRoot:base,slug:'kiwi',imagePath:image,name:'Kiwi',shortDescription:'Explore Kiwi.',alt:'Kiwi flavor artwork.',esShortDescription:'Explora Kiwi.',esAlt:'Ilustración de Kiwi.'});
 try {
  assert.deepEqual(loadRelease({base}).flavors.map(f=>f.slug),['grape']);
  assert(readFileSync(join(candidate.candidateRoot,'dist/flavors/kiwi/index.html'),'utf8').includes('Kiwi flavor artwork.'));
  assert(readFileSync(join(candidate.candidateRoot,'dist/es/flavors/kiwi/index.html'),'utf8').includes('Ilustración de Kiwi.'));
  assert.deepEqual(loadRelease({base}).flavors,before.flavors);cancelCandidate(candidate);
  assert.deepEqual(readFileSync(join(base,'content/flavors/grape.json')),original);
 } finally {rmSync(base,{recursive:true,force:true});}
});

test('confirmed replacement applies one new revision and safely withdraws old unshared bytes',async()=>{
 const base=sandbox(),image=join(base,'replace.png');await sample(image,{color:{r:190,g:50,b:110,alpha:1}});
 const prior=JSON.parse(readFileSync(join(base,'content/flavors/grape.json'),'utf8'));
 const revision=String(Number(prior.revision)+1),oldAsset=`public-astro/${prior.media.path}`;
 const candidate=await createCandidate({mode:'update',websiteRoot:base,slug:'grape',imagePath:image});
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
 const candidate=await createCandidate({mode:'add',websiteRoot:base,slug:'kiwi',imagePath:image,name:'Kiwi',shortDescription:'Explore Kiwi.',alt:'Kiwi flavor artwork.',esShortDescription:'Explora Kiwi.',esAlt:'Ilustración de Kiwi.'});
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
 const candidate=await createCandidate({mode:'update',websiteRoot:base,slug:'grape',imagePath:image});
 try {
  assert.throws(()=>applyCandidate(candidate,{runValidation:()=>{throw Error('fixture validation failure');}}),/fixture validation failure/);
  assert.deepEqual(readFileSync(join(base,'content/flavors/grape.json')),priorContent);
  assert.deepEqual(readFileSync(join(base,'public-astro',prior.media.path)),priorImage);
  assert.deepEqual(loadRelease({base}).flavors.map(f=>f.slug),['grape']);
 } finally {cancelCandidate(candidate);rmSync(base,{recursive:true,force:true});}
});

test('failed new-flavor validation rolls back its record and prepared artwork',async()=>{
 const base=sandbox(),image=join(base,'failed-add.png');await sample(image);
 const candidate=await createCandidate({mode:'add',websiteRoot:base,slug:'kiwi',imagePath:image,name:'Kiwi',shortDescription:'Explore Kiwi.',alt:'Kiwi flavor artwork.',esShortDescription:'Explora Kiwi.',esAlt:'Ilustración de Kiwi.'});
 const asset=join(base,'public-astro',candidate.projection.media.path);
 try {
  assert.throws(()=>applyCandidate(candidate,{runValidation:()=>{throw Error('fixture add validation failure');}}),/fixture add validation failure/);
  assert.equal(existsSync(join(base,'content/flavors/kiwi.json')),false);
  assert.equal(existsSync(asset),false);
  assert.deepEqual(loadRelease({base}).flavors.map(flavor=>flavor.slug),['grape']);
 } finally {cancelCandidate(candidate);rmSync(base,{recursive:true,force:true});}
});

test('stale candidates and invalid or symlinked image inputs are rejected before application',async()=>{
 const base=sandbox(),image=join(base,'sample.png');await sample(image);
 const candidate=await createCandidate({mode:'add',websiteRoot:base,slug:'kiwi',imagePath:image,name:'Kiwi',shortDescription:'Explore Kiwi.',alt:'Kiwi artwork.',esShortDescription:'Explora Kiwi.',esAlt:'Ilustración de Kiwi.'});
 try {writeFileSync(join(base,'content/site.json'),readFileSync(join(base,'content/site.json')));writeFileSync(join(base,'content/site.json'),JSON.stringify({contractVersion:'1',kind:'development-site',lang:'en',title:'Changed locally',description:'No publication approval.'},null,2)+'\n');assert.throws(()=>applyCandidate(candidate,{validate:false}),/stale/);} finally {cancelCandidate(candidate);}
 const bad=join(base,'bad.png');writeFileSync(bad,'not an image');await assert.rejects(()=>createCandidate({mode:'add',websiteRoot:base,slug:'kiwi',imagePath:bad,name:'Kiwi',shortDescription:'Explore Kiwi.',alt:'Kiwi artwork.',esShortDescription:'Explora Kiwi.',esAlt:'Ilustración de Kiwi.'}));
 const link=join(base,'linked.png');symlinkSync(image,link);await assert.rejects(()=>createCandidate({mode:'add',websiteRoot:base,slug:'kiwi',imagePath:link,name:'Kiwi',shortDescription:'Explore Kiwi.',alt:'Kiwi artwork.',esShortDescription:'Explora Kiwi.',esAlt:'Ilustración de Kiwi.'}));
 rmSync(base,{recursive:true,force:true});
});

test('add rejects an existing slug and update rejects an unknown slug without changing content or assets',async()=>{
 const base=sandbox(),image=join(base,'invalid-operation.png');await sample(image);
 const before=readFileSync(join(base,'content/flavors/grape.json'));
 const media=readFileSync(join(base,'public-astro/assets/grape-web-r1.webp'));
 await assert.rejects(()=>createCandidate({mode:'add',websiteRoot:base,slug:'grape',imagePath:image}),/already exists/);
 await assert.rejects(()=>createCandidate({mode:'update',websiteRoot:base,slug:'kiwi',imagePath:image}),/Unknown flavor/);
 assert.deepEqual(readFileSync(join(base,'content/flavors/grape.json')),before);
 assert.deepEqual(readFileSync(join(base,'public-astro/assets/grape-web-r1.webp')),media);
 assert.deepEqual(loadRelease({base}).flavors.map(f=>f.slug),['grape']);
 rmSync(base,{recursive:true,force:true});
});

test('flavor removal preview can be cancelled without changing record or artwork',async()=>{
 const base=sandbox();
 const content=readFileSync(join(base,'content/flavors/grape.json'));
 const media=readFileSync(join(base,'public-astro/assets/grape-web-r1.webp'));
 const candidate=await createRemovalCandidate({websiteRoot:base,slug:'grape'});
 try {
  assert.equal(candidate.record.name,'Grape');
  assert(readFileSync(join(candidate.candidateRoot,'dist/flavors/grape/index.html'),'utf8').includes(candidate.record.alt));
  cancelCandidate(candidate);
  assert.deepEqual(readFileSync(join(base,'content/flavors/grape.json')),content);
  assert.deepEqual(readFileSync(join(base,'public-astro/assets/grape-web-r1.webp')),media);
 } finally {cancelCandidate(candidate);rmSync(base,{recursive:true,force:true});}
});

test('confirmed flavor removal deletes its record and unshared artwork',async()=>{
 const base=sandbox(),candidate=await createRemovalCandidate({websiteRoot:base,slug:'grape'});
 try {
  const changed=applyRemoval(candidate,{validate:false});
  assert.equal(changed.shared,false);assert.equal(changed.assetPath,join(base,'public-astro/assets/grape-web-r1.webp'));
  assert.equal(existsSync(join(base,'content/flavors/grape.json')),false);
  assert.equal(existsSync(join(base,'public-astro/assets/grape-web-r1.webp')),false);
  assert.deepEqual(loadRelease({base}).flavors,[]);
 } finally {cancelCandidate(candidate);rmSync(base,{recursive:true,force:true});}
});

test('flavor removal never deletes bytes referenced by another flavor',async()=>{
 const base=sandbox();await addFlavorRecord(base,'lime');
 const candidate=await createRemovalCandidate({websiteRoot:base,slug:'grape'});
 try {
  candidate.record.media.path='assets/lime-web-r1.webp';
  const changed=applyRemoval(candidate,{validate:false});
  assert.equal(changed.shared,true);assert.equal(changed.assetPath,undefined);
  assert.equal(existsSync(join(base,'public-astro/assets/lime-web-r1.webp')),true);
  assert.equal(existsSync(join(base,'content/flavors/grape.json')),false);
 } finally {cancelCandidate(candidate);rmSync(base,{recursive:true,force:true});}
});

test('failed removal validation restores exact content and artwork bytes',async()=>{
 const base=sandbox(),candidate=await createRemovalCandidate({websiteRoot:base,slug:'grape'});
 const content=readFileSync(join(base,'content/flavors/grape.json'));
 const media=readFileSync(join(base,'public-astro/assets/grape-web-r1.webp'));
 try {
  assert.throws(()=>applyRemoval(candidate,{runValidation:()=>{throw Error('fixture removal validation failure');}}),/fixture removal validation failure/);
  assert.deepEqual(readFileSync(join(base,'content/flavors/grape.json')),content);
  assert.deepEqual(readFileSync(join(base,'public-astro/assets/grape-web-r1.webp')),media);
  assert.deepEqual(loadRelease({base}).flavors.map(flavor=>flavor.slug),['grape']);
 } finally {cancelCandidate(candidate);rmSync(base,{recursive:true,force:true});}
});

test('removing an unknown flavor fails without changing the current release',async()=>{
 const base=sandbox(),content=readFileSync(join(base,'content/flavors/grape.json'));
 await assert.rejects(()=>createRemovalCandidate({websiteRoot:base,slug:'kiwi'}),/Unknown flavor/);
 assert.deepEqual(readFileSync(join(base,'content/flavors/grape.json')),content);
 assert.deepEqual(loadRelease({base}).flavors.map(flavor=>flavor.slug),['grape']);
 rmSync(base,{recursive:true,force:true});
});
