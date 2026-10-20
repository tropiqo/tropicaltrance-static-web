import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync, mkdirSync, symlinkSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { digest, loadRelease } from '../scripts/public-inputs.mjs';
import { checkFlavorMedia } from '../scripts/check-static.mjs';
import { parseJson, validateSchema } from '../scripts/closed-json.mjs';

const root=process.cwd();
function sandbox(fn) {
  const base=mkdtempSync(join(tmpdir(),'tt-flavor-inputs-'));
  try {
    for(const path of ['schemas','content','public-astro','tests/fixtures']) cpSync(resolve(root,path),resolve(base,path),{recursive:true});
    for(const name of readdirSync(join(base,'content/flavors')))if(name!=='grape.json')rmSync(join(base,'content/flavors',name));
    const grape=JSON.parse(readFileSync(join(base,'content/flavors/grape.json'),'utf8'));
    for(const name of readdirSync(join(base,'public-astro/assets')))if(/-web-r[0-9]+\.webp$/.test(name)&&![grape.media.path.slice('assets/'.length),'trancy-web-r1.webp'].includes(name))rmSync(join(base,'public-astro/assets',name));
    return fn(base);
  }
  finally { rmSync(base,{recursive:true,force:true}); }
}
const read=(base,path)=>JSON.parse(readFileSync(join(base,path),'utf8'));
const write=(base,path,value)=>writeFileSync(join(base,path),JSON.stringify(value,null,2)+'\n');
const selectedGrapeMedia=base=>join(base,'public-astro',read(base,'content/flavors/grape.json').media.path);
function webp(label='sample') { const body=Buffer.from(label);const b=Buffer.alloc(12+body.length);b.write('RIFF',0);b.writeUInt32LE(b.length-8,4);b.write('WEBP',8);body.copy(b,12);return b; }
function addFlavor(base,slug='mango',bytes=webp()) {
  const path=`assets/${slug}-web-r1.webp`;
  writeFileSync(join(base,'public-astro',path),bytes);
  writeFileSync(join(base,`content/flavors/${slug}.json`),JSON.stringify({contractVersion:'1',slug,revision:'1',name:slug[0].toUpperCase()+slug.slice(1),shortDescription:`Explore ${slug}.`,alt:`${slug} flavor artwork.`,media:{path,contentId:digest(bytes)}},null,2)+'\n');
}
test('current Grape maps through the simple local content record and exact delivery',()=>{
 const r=loadRelease();const grape=r.flavors.find(f=>f.slug==='grape');assert(grape);
 assert.equal(grape.slug,'grape');assert.equal(grape.media.contentId,r.deliveries.find(d=>d.path.endsWith(grape.mediaUrl.slice(1))).asset.contentId);
});
test('normal release derives multiple detail routes and deliveries from validated flavor records without eligibility or release manifests',()=>sandbox(base=>{
 addFlavor(base);const r=loadRelease({base});assert.deepEqual(r.flavors.map(f=>f.slug),['grape','mango']);assert.equal(r.deliveries.length,2);assert.equal(r.flavors[1].mediaUrl,'/assets/mango-web-r1.webp');
}));
test('empty flavor directory remains a valid normal release',()=>sandbox(base=>{
 const selectedMedia=selectedGrapeMedia(base);rmSync(join(base,'content/flavors/grape.json'));rmSync(selectedMedia);
 assert.deepEqual(loadRelease({base}).flavors,[]);
}));
test('closed schema rejects missing fields, unknown fields, invalid and reserved slugs',()=>sandbox(base=>{
 for(const mutate of [v=>delete v.alt,v=>v.private='secret',v=>v.slug='../escape',v=>v.slug='404',v=>v.media.path='../../secret.webp']) {
   const value=read(base,'content/flavors/grape.json');mutate(value);write(base,'content/flavors/grape.json',value);assert.throws(()=>loadRelease({base}));
   cpSync(join(root,'content/flavors/grape.json'),join(base,'content/flavors/grape.json'));
 }
}));
test('duplicate JSON keys are rejected',()=>sandbox(base=>{
 const p=join(base,'content/flavors/grape.json');const value=readFileSync(p,'utf8').replace('"slug": "grape"','"slug": "grape", "slug": "grape"');writeFileSync(p,value);assert.throws(()=>loadRelease({base}));
}));
test('media digest mismatch, wrong signature, and wrong path are rejected',()=>sandbox(base=>{
 const value=read(base,'content/flavors/grape.json');value.media.contentId='sha256:'+'0'.repeat(64);write(base,'content/flavors/grape.json',value);assert.throws(()=>loadRelease({base}),/digest/);
 cpSync(join(root,'content/flavors/grape.json'),join(base,'content/flavors/grape.json'));
 addFlavor(base,'mango',Buffer.from('not webp'));assert.throws(()=>loadRelease({base}),/WebP/);
 rmSync(join(base,'content/flavors/mango.json'));rmSync(join(base,'public-astro/assets/mango-web-r1.webp'));
 const changed=read(base,'content/flavors/grape.json');changed.media.path='assets/renamed-web-r1.webp';write(base,'content/flavors/grape.json',changed);assert.throws(()=>loadRelease({base}),/path mismatch/);
}));
test('matching digest cannot make a corrupt WebP decode as valid media',async()=>{
 const base=mkdtempSync(join(tmpdir(),'tt-bad-webp-'));
 try {for(const path of ['schemas','content','public-astro'])cpSync(resolve(root,path),resolve(base,path),{recursive:true});addFlavor(base,'mango',webp('corrupt payload'));const release=loadRelease({base});await assert.rejects(()=>checkFlavorMedia(base,release));}
 finally {rmSync(base,{recursive:true,force:true});}
});
test('unlisted media and stray public files fail complete inventory',()=>sandbox(base=>{
 writeFileSync(join(base,'public-astro/assets/unlisted.webp'),webp());assert.throws(()=>loadRelease({base}),/Unlisted/);
}));
test('fixture media and private or review content cannot enter normal flavor records',()=>sandbox(base=>{
 const v=read(base,'content/flavors/grape.json');v.name='INTERNAL SYNTHETIC TEST ONLY';write(base,'content/flavors/grape.json',v);assert.throws(()=>loadRelease({base}),/Fixture/);
 cpSync(join(root,'tests/fixtures/public-inputs/assets/coral.svg'),selectedGrapeMedia(base));assert.throws(()=>loadRelease({base}));
}));
test('symlinked flavor content and media paths fail closed',()=>sandbox(base=>{
 const p=selectedGrapeMedia(base),other=join(base,'outside.webp');cpSync(p,other);rmSync(p);symlinkSync(other,p);assert.throws(()=>loadRelease({base}),/Symlink/);
}));
test('legacy eligibility/media/release files are rejected rather than silently read',()=>sandbox(base=>{
 writeFileSync(join(base,'content/eligibility.json'),'{}');assert.throws(()=>loadRelease({base}),/Unexpected normal content/);
}));
test('normal mapper never activates review fixtures from environment variables',()=>{
 const r=loadRelease();assert.equal(r.review,false);assert(r.flavors.some(f=>f.slug==='grape'));assert(r.flavors.every(f=>!f.slug.startsWith('fixture-')));
});
test('review mapper remains on the isolated synthetic Flavor v1 fixture contract',()=>{
 const r=loadRelease({review:true});assert.equal(r.review,true);assert.deepEqual(r.flavors.map(f=>f.slug),['fixture-coral','fixture-orchid']);
});
test('schema parser rejects malformed, duplicate and non-finite JSON',()=>{
 for(const value of ['{"x":1,"\\u0078":2}','{"x":1e999}','{} trailing'])assert.throws(()=>parseJson(Buffer.from(value)));
 const schema=resolve(root,'schemas/flavor-content.schema.json');assert.doesNotThrow(()=>validateSchema(read(root,'content/flavors/grape.json'),schema));
});
