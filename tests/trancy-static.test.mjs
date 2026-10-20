import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { loadRelease, digest, rejectFixture } from '../scripts/public-inputs.mjs';
import { trancy, trancyMedia, validateTrancy } from '../scripts/trancy-static.mjs';
import { checkOutput } from '../scripts/check-static.mjs';
import normal from '../src/lib/normal-release.mjs';
function sandbox(run) {
  const base = mkdtempSync(join(tmpdir(), 'tt-static-trancy-'));
  try {
    for (const path of ['content','schemas','public-astro','dist']) cpSync(path,join(base,path),{recursive:true});
    return run(base);
  } finally { rmSync(base,{recursive:true,force:true}); }
}
test('one exact approved static image is shared by Home and About', async () => {
  const bytes = readFileSync(trancy.path); validateTrancy(bytes);
  assert.equal(digest(bytes), digest(readFileSync('review-assets/trancy-review-r1.webp')));
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width,1440); assert.equal(metadata.height,1282); assert.equal(metadata.hasAlpha,true);
  assert.equal(normal.brandMedia['home-hero'],normal.brandMedia['about-mascot']);
  assert.equal(normal.brandMedia['home-hero'],trancyMedia);
  assert.deepEqual(normal.flavors,[]); assert.deepEqual(normal.deliveries,[]);
  await checkOutput();
});
test('canonical PNG remains byte-identical and excluded from public delivery',()=>{
  assert.equal(digest(readFileSync('assets/images/TRANCY-01.png')),'sha256:61088b9e5e4b1ec9f80c2b17e8ab79d3443b5af63347cb141684de5cc02dab5d');
  for(const file of ['index.html','about/index.html']) {
    const html=readFileSync('dist/'+file,'utf8');
    assert.equal((html.match(/<img\b/g)||[]).length,1);assert(html.includes(trancyMedia.mediaUrl));
    assert(html.includes(trancy.alt));assert(!/TRANCY-01|review-media|review-assets|fixture-/i.test(html));
  }
});
for(const [name,change] of [
  ['missing',p=>rmSync(p)],
  ['changed',p=>{const b=readFileSync(p);b[b.length-1]^=1;writeFileSync(p,b);}],
  ['symlink',p=>{rmSync(p);symlinkSync(join(process.cwd(),trancy.path),p);}],
])test('static image '+name+' fails input validation',()=>sandbox(base=>{
  change(join(base,trancy.path));assert.throws(()=>loadRelease({base}));
}));
for(const file of ['public-astro/assets/renamed.webp','public-astro/assets/source.png','public-astro/stray.txt'])
 test('unlisted static path '+file+' is rejected',()=>sandbox(base=>{
  writeFileSync(join(base,file),readFileSync(trancy.path));assert.throws(()=>loadRelease({base}),/Unlisted/);
 }));
test('static approval creates no Flavor digest or contract exception',()=>sandbox(base=>{
  const bytes=readFileSync(trancy.path);assert.throws(()=>rejectFixture(bytes));assert.throws(()=>rejectFixture(Buffer.from(trancy.contentId)));
  const media={contractVersion:'1',kind:'website-public-media',entries:[{deliveryRef:'trancy',asset:{assetId:'trancy',revision:'1',contentId:trancy.contentId},path:trancy.path}]};
  writeFileSync(join(base,'content/media.json'),JSON.stringify(media));assert.throws(()=>loadRelease({base}),/fixture/i);
}));
test('superseded brand JSON/v2 contracts are rejected, not silently retained',()=>sandbox(base=>{
  const path=join(base,'content/release-set.json'),original=readFileSync(path);
  writeFileSync(path,JSON.stringify({contractVersion:'2',kind:'website-release-set',members:[]}));assert.throws(()=>loadRelease({base}),/schema/);
  writeFileSync(path,original);writeFileSync(join(base,'content/brand-media.json'),'{}');assert.throws(()=>loadRelease({base}),/Unexpected input/);
}));
test('copied output image drift fails the output audit',async()=>{
  const base=mkdtempSync(join(tmpdir(),'tt-trancy-output-'));
  try {
    for(const path of ['content','schemas','public-astro','dist'])cpSync(path,join(base,path),{recursive:true});
    const path=join(base,'dist',trancyMedia.mediaUrl.slice(1)),b=readFileSync(path);b[b.length-1]^=1;writeFileSync(path,b);
    await assert.rejects(()=>checkOutput(base),/digest mismatch/);
  }finally{rmSync(base,{recursive:true,force:true});}
});
