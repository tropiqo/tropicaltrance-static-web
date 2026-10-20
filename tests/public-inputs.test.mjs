import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync, mkdirSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadRelease, digest, rejectFixture } from '../scripts/public-inputs.mjs';
import { parseJson, validateSchema } from '../scripts/closed-json.mjs';
const root=process.cwd(), prefix='tests/fixtures/public-inputs';
function sandbox(fn) {
  const base=mkdtempSync(join(tmpdir(),'tt-public-'));
  try { for (const path of ['schemas','content','tests/fixtures','public-astro']) cpSync(resolve(root,path),resolve(base,path),{recursive:true}); mkdirSync(join(base,'public-astro/assets'),{recursive:true}); return fn(base); }
  finally { rmSync(base,{recursive:true,force:true}); }
}
function clearGrape(base) {
 for (const path of ['content/flavors/grape.json','content/eligibility.json','public-astro/assets/grape-web-r1.webp']) rmSync(join(base,path),{force:true});
 writeFileSync(join(base,'content/media.json'),JSON.stringify({contractVersion:'1',kind:'website-public-media',entries:[]},null,2)+'\n');
 writeFileSync(join(base,'content/release-set.json'),JSON.stringify({contractVersion:'1',kind:'website-release-set',members:[]},null,2)+'\n');
}
const read=(base,path)=>JSON.parse(readFileSync(join(base,path),'utf8'));
const write=(base,path,v)=>writeFileSync(join(base,path),JSON.stringify(v,null,2)+'\n');
function mutate(base,path,fn) { const v=read(base,path);fn(v);write(base,path,v); }
function repin(base) {
  const e=read(base,prefix+'/eligibility.json'); e.mediaContentId=digest(readFileSync(join(base,prefix+'/media.json')));
  const r=read(base,prefix+'/release-set.json');
  for (const m of r.members) { if (m.editorial) m.editorial.contentId=digest(readFileSync(join(base,m.editorial.path))); const h=digest(readFileSync(join(base,m.projection.path)));m.projection.contentId=h; const entry=e.assumptions.find(x=>x.flavor.id===m.flavor.id);if(entry)entry.projectionContentId=h; }
  write(base,prefix+'/eligibility.json',e);r.eligibilitySnapshot.contentId=digest(readFileSync(join(base,prefix+'/eligibility.json')));write(base,prefix+'/release-set.json',r);
}
const review=base=>loadRelease({base,review:true});
function negative(name,fn,{pin=false}={}) { test(name,()=>sandbox(base=>{fn(base);if(pin)repin(base);assert.throws(()=>review(base));})); }
const proj=prefix+'/flavors/fixture-orchid.json';
const ep=prefix+'/eligibility.json',mp=prefix+'/media.json',rp=prefix+'/release-set.json';
test('genuine normal Grape release has one selected flavor and exact shared delivery',()=>{ const r=loadRelease();assert.deepEqual(r.flavors.map(f=>f.slug),['grape']);assert.equal(r.deliveries.length,1);assert.equal(r.flavors[0].artwork.contentId,r.deliveries[0].asset.contentId); });
test('optional supplied empty snapshot is validated and pinned',()=>sandbox(base=>{clearGrape(base);
  const e={contractVersion:'1',kind:'public-eligibility-snapshot',id:'empty-review',revision:'1',reviewedAt:'2026-10-09T00:00:00Z',mediaContentId:digest(readFileSync(join(base,'content/media.json'))),entries:[]};write(base,'content/eligibility.json',e);
  mutate(base,'content/release-set.json',r=>r.eligibilitySnapshot={id:e.id,revision:e.revision,contentId:digest(readFileSync(join(base,'content/eligibility.json')))});
  assert.equal(loadRelease({base}).flavors.length,0);
  mutate(base,'content/eligibility.json',e=>e.reviewedAt='2026-02-30T00:00:00Z');assert.throws(()=>loadRelease({base}));
}));
test('explicit fictional membership sorted with optional story omitted',()=>{const r=review(root);assert.deepEqual(r.flavors.map(x=>x.slug),['fixture-coral','fixture-orchid']);assert.equal(r.flavors[0].editorial,undefined);assert(r.flavors[1].editorial);});
test('unlisted valid ineligible projection/entry does not promote',()=>sandbox(base=>{
  mutate(base,rp,r=>r.members=r.members.filter(x=>x.slug!=='fixture-orchid'));
  mutate(base,mp,m=>m.entries=m.entries.filter(x=>x.deliveryRef!=='fixture-orchid-delivery'));
  rmSync(join(base,prefix+'/assets/orchid.svg'));
  mutate(base,ep,e=>e.assumptions.find(x=>x.flavor.id==='fixture-orchid').validity='ineligible');repin(base);
  assert.deepEqual(review(base).flavors.map(x=>x.slug),['fixture-coral']);
}));
test('set-like ordering independent of input order; exact byte digests stable',()=>sandbox(base=>{
 const before=review(base);for(const [p,k] of [[rp,'members'],[mp,'entries'],[ep,'assumptions']]) mutate(base,p,v=>v[k].reverse());repin(base);assert.deepEqual(review(base),before);
 const b=readFileSync(join(base,proj));assert.equal(digest(b),digest(Buffer.from(b)));assert.notEqual(digest(b),digest(Buffer.concat([b,Buffer.from(' ')])));
}));
negative('missing included projection',b=>rmSync(join(b,proj)));
negative('missing eligibility snapshot',b=>rmSync(join(b,ep)));
negative('missing included eligibility entry',b=>mutate(b,ep,e=>e.assumptions.shift()),{pin:true});
negative('missing nonempty release snapshot pin',b=>mutate(b,rp,r=>delete r.eligibilitySnapshot));
negative('wrong snapshot digest',b=>mutate(b,rp,r=>r.eligibilitySnapshot.contentId='sha256:'+'0'.repeat(64)));
negative('wrong snapshot identity',b=>mutate(b,rp,r=>r.eligibilitySnapshot.id='other'));
negative('wrong snapshot revision',b=>mutate(b,rp,r=>r.eligibilitySnapshot.revision='2'));
negative('wrong media pin',b=>mutate(b,ep,e=>e.mediaContentId='sha256:'+'0'.repeat(64)));
negative('wrong projection pin',b=>mutate(b,rp,r=>r.members[0].projection.contentId='sha256:'+'0'.repeat(64)));
negative('wrong eligibility projection pin',b=>{mutate(b,ep,e=>e.assumptions[0].projectionContentId='sha256:'+'0'.repeat(64));const r=read(b,rp);r.eligibilitySnapshot.contentId=digest(readFileSync(join(b,ep)));write(b,rp,r);});
negative('wrong delivery digest',b=>writeFileSync(join(b,prefix+'/assets/orchid.svg'),'changed bytes'));
negative('missing delivery bytes',b=>rmSync(join(b,prefix+'/assets/orchid.svg')));
for (const field of ['revision','id']) negative('Flavor '+field+' drift',b=>mutate(b,proj,p=>p.flavor[field]='changed'),{pin:true});
for (const part of ['canonicalArtwork','artwork']) for (const field of ['assetId','revision','contentId']) negative(part+' '+field+' drift',b=>mutate(b,proj,p=>p[part][field]=field==='contentId'?'sha256:'+'0'.repeat(64):'changed'),{pin:true});
for (const field of ['recipe','recipeVersion']) negative('wrong '+field,b=>mutate(b,proj,p=>p.artwork[field]='changed'),{pin:true});
negative('wrong closed recipe parameters',b=>mutate(b,proj,p=>p.artwork.parameters={width:2}),{pin:true});
negative('unsafe parameter value',b=>mutate(b,proj,p=>p.artwork.parameters={width:'/private/source'}),{pin:true});
negative('private parameter key',b=>mutate(b,proj,p=>p.artwork.parameters={reviewer:'someone'}),{pin:true});
negative('required artwork absent',b=>mutate(b,proj,p=>delete p.artwork),{pin:true});
negative('package-only scope',b=>mutate(b,ep,e=>e.assumptions[0].use='package'),{pin:true});
for(const state of ['ineligible','stale','revoked','superseded','rejected','conflicted','unverified','invalid']) negative('validity '+state+' rejected when included',b=>mutate(b,ep,e=>e.assumptions[0].validity=state),{pin:true});
for(const p of [proj,ep,mp,rp,prefix+'/site.json',prefix+'/editorial/fixture-orchid.json']) negative('unknown top-level '+p,b=>mutate(b,p,v=>v.approved=true),{pin:true});
for(const [p,fn] of [[proj,p=>p.artwork.extra=true],[proj,p=>p.flavor.extra=true],[ep,e=>e.assumptions[0].extra=true],[mp,m=>m.entries[0].asset.extra=true],[rp,r=>r.members[0].projection.extra=true]]) negative('unknown nested '+p+' '+String(fn),b=>mutate(b,p,fn),{pin:true});
for(const p of [proj,ep,mp,rp]) negative('duplicate JSON key '+p,b=>{const text=readFileSync(join(b,p),'utf8');writeFileSync(join(b,p),text.replace('"contractVersion": "1"','"contractVersion": "1", "contractVersion": "1"'));});
test('duplicate escaped/nested keys, nonfinite and malformed UTF8 rejected',()=>{for(const s of ['{"x":1,"\\u0078":2}','{"x":{"a":1,"a":2}}','1e999','9007199254740992','"\\ud800"','{} junk']) assert.throws(()=>parseJson(Buffer.from(s)));assert.throws(()=>parseJson(Buffer.from([0xff])));});
negative('duplicate Flavor record',b=>cpSync(join(b,proj),join(b,prefix+'/flavors/duplicate.json')));
negative('duplicate member',b=>mutate(b,rp,r=>r.members.push(r.members[0])));
negative('duplicate slug/route',b=>mutate(b,rp,r=>r.members[1].slug=r.members[0].slug));
negative('duplicate eligibility entry',b=>mutate(b,ep,e=>e.assumptions.push(e.assumptions[0])),{pin:true});
negative('duplicate media ref',b=>mutate(b,mp,m=>m.entries[1].deliveryRef=m.entries[0].deliveryRef),{pin:true});
negative('duplicate media destination',b=>mutate(b,mp,m=>m.entries[1].path=m.entries[0].path),{pin:true});
negative('duplicate derivative identity',b=>mutate(b,mp,m=>m.entries[1].asset.assetId=m.entries[0].asset.assetId),{pin:true});
for(const slug of ['../bad','Bad','bad_slug','index','404','bad/slug']) negative('invalid/reserved slug '+slug,b=>mutate(b,rp,r=>r.members[0].slug=slug));
for(const path of ['/Users/private.png','../private.png','public-astro/assets/a.svg','https://example.invalid/a.svg','tests/fixtures/public-inputs/assets/../a.svg','tests/fixtures/public-inputs/assets/%2e%2e/a.svg','tests\\fixtures\\a.svg','tests/fixtures/public-inputs/assets/a.svg?x','tests/fixtures/public-inputs/assets/a.svg#x','artwork/source.png','tropical-trance-studio/private.png','assets/images/TRANCY-01.png']) negative('unsafe/private/external path '+path,b=>mutate(b,mp,m=>m.entries[0].path=path),{pin:true});
negative('symlink delivery escape',b=>{const p=join(b,prefix+'/assets/orchid.svg');rmSync(p);symlinkSync('/etc/hosts',p);});
negative('symlink ancestor escape',b=>{const p=join(b,prefix+'/assets');const outside=join(b,'outside');cpSync(p,outside,{recursive:true});rmSync(p,{recursive:true});symlinkSync(outside,p);});
negative('nonregular delivery directory',b=>{const p=join(b,prefix+'/assets/orchid.svg');rmSync(p);mkdirSync(p);});
negative('unlinked public file copied by review publicDir',b=>writeFileSync(join(b,prefix+'/assets/stray.svg'),'stray'));
negative('unknown unlisted malformed projection',b=>write(b,prefix+'/flavors/unlisted.json',{approved:true}));
test('normal publicDir rejects unlisted/unlinked file outside assets',()=>sandbox(b=>{writeFileSync(join(b,'public-astro/stray.txt'),'unapproved');assert.throws(()=>loadRelease({base:b}));}));
test('normal rejects fixture input kinds, markers, paths and relabelled digests',()=>sandbox(b=>{
 cpSync(join(b,prefix+'/eligibility.json'),join(b,'content/eligibility.json'));assert.throws(()=>loadRelease({base:b}));rmSync(join(b,'content/eligibility.json'));
 cpSync(join(b,proj),join(b,'content/flavors/renamed.json'));assert.throws(()=>loadRelease({base:b}));
 const p=read(b,proj);p.flavor.id='renamed';p.name='Renamed';p.shortDescription='Neutral';p.canonicalArtwork.assetId='source';p.artwork.assetId='derivative';p.artwork.deliveryRef='delivery';p.artwork.recipe='neutral';write(b,'content/flavors/renamed.json',p);assert.throws(()=>loadRelease({base:b}));
 for(const s of ['fixture-orchid','INTERNAL SYNTHETIC TEST ONLY','tests/fixtures/public-inputs',p.artwork.contentId])assert.throws(()=>rejectFixture(Buffer.from(s)));
 assert.throws(()=>rejectFixture(readFileSync(join(b,prefix+'/assets/orchid.svg'))));
}));
test('no environment fixture activation or fixture fallback discovery',()=>{
 const r=spawnSync(process.execPath,['scripts/public-inputs.mjs'],{cwd:root,encoding:'utf8',env:{...process.env,CONTENT_ROOT:prefix,RELEASE_MODE:'fixture',FIXTURE_MODE:'true',ASTRO_FIXTURES:'1',NODE_ENV:'production'}});assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/1 members/);
});
test('pinned public schemas unchanged and no public authority additions',()=>sandbox(b=>{writeFileSync(join(b,'schemas/publication/projection.schema.json'),'{}');assert.throws(()=>loadRelease({base:b}));}));
test('normal schema rejects assumption envelope structurally even without marker guard',()=>{assert.throws(()=>validateSchema(read(root,ep),join(root,'schemas/eligibility.schema.json')));});
test('empty normal supplied snapshot may be unpinned; media pin remains mandatory',()=>sandbox(b=>{clearGrape(b);
 const e={contractVersion:'1',kind:'public-eligibility-snapshot',id:'empty',revision:'1',reviewedAt:'2026-10-09T00:00:00Z',mediaContentId:digest(readFileSync(join(b,'content/media.json'))),entries:[]};write(b,'content/eligibility.json',e);assert.equal(loadRelease({base:b}).flavors.length,0);
 e.mediaContentId='sha256:'+'0'.repeat(64);write(b,'content/eligibility.json',e);assert.throws(()=>loadRelease({base:b}));
}));
test('absent empty content directories are valid with the static image present',()=>sandbox(b=>{clearGrape(b);for(const p of ['content/flavors','content/editorial'])rmSync(join(b,p),{recursive:true,force:true});assert.equal(loadRelease({base:b}).flavors.length,0);}));
negative('missing included media mapping',b=>mutate(b,mp,m=>m.entries.shift()),{pin:true});
negative('media derivative revision drift',b=>mutate(b,mp,m=>m.entries[0].asset.revision='other'),{pin:true});
negative('wrong editorial revision',b=>mutate(b,prefix+'/editorial/fixture-orchid.json',e=>e.flavor.revision='other'),{pin:true});
negative('missing editorial referenced file',b=>rmSync(join(b,prefix+'/editorial/fixture-orchid.json')));
negative('bad editorial digest',b=>mutate(b,rp,r=>r.members[0].editorial.contentId='sha256:'+'0'.repeat(64)));
negative('projection path outside declared root',b=>mutate(b,rp,r=>r.members[0].projection.path='content/site.json'));
negative('symlink content directory',b=>{const p=join(b,prefix+'/flavors');const other=join(b,'copied');cpSync(p,other,{recursive:true});rmSync(p,{recursive:true});symlinkSync(other,p);});
test('normal eligibility root and nested closed schema positive/negative vocabulary',()=>{
 const e={contractVersion:'1',kind:'public-eligibility-snapshot',id:'review',revision:'1',reviewedAt:'2026-10-09T00:00:00Z',mediaContentId:'sha256:'+'0'.repeat(64),entries:read(root,ep).assumptions};const schema=join(root,'schemas/eligibility.schema.json');validateSchema(e,schema);
 for(const mutate of [v=>v.approved=true,v=>v.entries[0].approved=true,v=>v.entries[0].artwork.extra=true,v=>delete v.reviewedAt,v=>v.reviewedAt='2026-02-30T00:00:00Z',v=>v.reviewedAt='2026-10-09T00:00:00+00:00',v=>v.reviewedAt='now',v=>v.entries[0].use='website']) {const v=structuredClone(e);mutate(v);assert.throws(()=>validateSchema(v,schema));}
});
test('unlisted normal media map never authorizes public copying',()=>sandbox(b=>{clearGrape(b);
 const path='public-astro/assets/unlisted.svg';writeFileSync(join(b,path),'<svg><rect/></svg>');write(b,'content/media.json',{contractVersion:'1',kind:'website-public-media',entries:[{deliveryRef:'unlisted',asset:{assetId:'unlisted',revision:'1',contentId:digest(readFileSync(join(b,path)))},path}]});assert.throws(()=>loadRelease({base:b}),/Unlisted file/);
}));
test('symlink normal public root and input root rejected',()=>sandbox(b=>{
 const path=join(b,'public-astro');const target=join(b,'alternate');mkdirSync(target);rmSync(path,{recursive:true});symlinkSync(target,path);assert.throws(()=>loadRelease({base:b}),/Symlink/);
 unlinkSync(path);mkdirSync(path);const c=join(b,'content');cpSync(c,join(b,'other-content'),{recursive:true});rmSync(c,{recursive:true});symlinkSync(join(b,'other-content'),c);assert.throws(()=>loadRelease({base:b}),/Symlink/);
}));

// Mutate only temporary copies of the actual examined Grape handoff, never approval records.
function repinGrape(base) {
 const p=read(base,'content/flavors/grape.json'),e=read(base,'content/eligibility.json'),r=read(base,'content/release-set.json');
 const h=digest(readFileSync(join(base,'content/flavors/grape.json')));
 e.mediaContentId=digest(readFileSync(join(base,'content/media.json')));e.entries[0].projectionContentId=h;
 write(base,'content/eligibility.json',e);r.members[0].projection.contentId=h;
 r.eligibilitySnapshot.contentId=digest(readFileSync(join(base,'content/eligibility.json')));write(base,'content/release-set.json',r);
}
for(const validity of ['unverified','revoked','stale','conflicted','rejected','superseded','ineligible'])
 test('actual Grape rejects selected '+validity,()=>sandbox(base=>{
  mutate(base,'content/eligibility.json',e=>e.entries[0].validity=validity);repinGrape(base);assert.throws(()=>loadRelease({base}),/not eligible/);
 }));
for(const [name,change] of [
 ['package scope',b=>mutate(b,'content/eligibility.json',e=>e.entries[0].use='package')],
 ['source drift',b=>mutate(b,'content/flavors/grape.json',p=>p.canonicalArtwork.contentId='sha256:'+'0'.repeat(64))],
 ['derivative drift',b=>mutate(b,'content/flavors/grape.json',p=>p.artwork.contentId='sha256:'+'0'.repeat(64))],
 ['crop parameters',b=>mutate(b,'content/flavors/grape.json',p=>p.artwork.parameters.resize.fit='cover')],
 ['recipe version',b=>mutate(b,'content/flavors/grape.json',p=>p.artwork.recipeVersion='2')],
 ['unknown recipe',b=>mutate(b,'content/flavors/grape.json',p=>p.artwork.recipe='unknown')],
 ['unknown slug',b=>mutate(b,'content/release-set.json',r=>r.members[0].slug='other')],
 ['snapshot conflict',b=>mutate(b,'content/eligibility.json',e=>e.entries[0].artwork.revision='r2')],
 ['extra parameter key',b=>mutate(b,'content/flavors/grape.json',p=>p.artwork.parameters.webp.quality=80)],
 ['source ownership crossover',b=>mutate(b,'content/flavors/grape.json',p=>p.flavor.id='lime')],
 ['media Asset drift',b=>mutate(b,'content/media.json',m=>m.entries[0].asset.revision='r2')],
 ['renamed delivery',b=>{const m=read(b,'content/media.json');cpSync(join(b,m.entries[0].path),join(b,'public-astro/assets/renamed.webp'));m.entries[0].path='public-astro/assets/renamed.webp';write(b,'content/media.json',m);}],
 ['private copy',b=>mutate(b,'content/flavors/grape.json',p=>p.shortDescription='/Users/private/record')],
])test('actual Grape rejects '+name,()=>sandbox(base=>{change(base);repinGrape(base);assert.throws(()=>loadRelease({base}));}));
for(const [name,change] of [
 ['missing snapshot',b=>rmSync(join(b,'content/eligibility.json'))],
 ['missing projection',b=>rmSync(join(b,'content/flavors/grape.json'))],
 ['missing delivery',b=>rmSync(join(b,'public-astro/assets/grape-web-r1.webp'))],
 ['changed delivery',b=>{const p=join(b,'public-astro/assets/grape-web-r1.webp'),v=readFileSync(p);v[v.length-1]^=1;writeFileSync(p,v);}],
 ['symlink delivery',b=>{const p=join(b,'public-astro/assets/grape-web-r1.webp');rmSync(p);symlinkSync(join(root,'public-astro/assets/grape-web-r1.webp'),p);}],
 ['missing included eligibility',b=>{mutate(b,'content/eligibility.json',e=>e.entries=[]);const r=read(b,'content/release-set.json');r.eligibilitySnapshot.contentId=digest(readFileSync(join(b,'content/eligibility.json')));write(b,'content/release-set.json',r);}],
])test('actual Grape rejects '+name,()=>sandbox(base=>{change(base);assert.throws(()=>loadRelease({base}));}));
test('actual Grape can be unselected only after obsolete mapping and served bytes are removed',()=>sandbox(base=>{
 const r=read(base,'content/release-set.json');r.members=[];write(base,'content/release-set.json',r);assert.throws(()=>loadRelease({base}),/Unlisted/);
 clearGrape(base);assert.deepEqual(loadRelease({base}).flavors,[]);
}));
