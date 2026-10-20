import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parseJson, validateSchema } from './closed-json.mjs';
import { fixtureDigests, fixtureMarker } from './fixture-guards.mjs';
import { trancy, validateTrancy } from './trancy-static.mjs';

export const digest = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const requireThat = (ok, message) => { if (!ok) throw Error(message); };
const same = (a,b,message) => requireThat(isDeepStrictEqual(a,b),message);
export function safePath(base, path) {
  requireThat(typeof path === 'string' && /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(path) && !/(?:^|\/)\.{1,2}(?:\/|$)/.test(path), 'Unsafe local path');
  const root = resolve(base);
  requireThat(!lstatSync(root).isSymbolicLink(),'Symlink input root');
  let p = root;
  for (const part of path.split('/')) { p = join(p,part); requireThat(!lstatSync(p).isSymbolicLink(),'Symlink path component'); }
  requireThat(p.startsWith(root + '/'), 'Path escapes root');
  return p;
}
export function inventory(base, path, allowAbsent = false) {
  let dir;
  try { dir = safePath(base,path); } catch (error) { if (allowAbsent && error.code === 'ENOENT') return []; throw error; } requireThat(lstatSync(dir).isDirectory(),'Expected input directory');
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = path + '/' + name; const stat = lstatSync(safePath(base,p));
    if (stat.isDirectory()) out.push(...inventory(base,p));
    else { requireThat(stat.isFile(),'Nonregular file'); out.push(p); }
  }
  return out;
}
export function rejectFixture(bytes) {
  requireThat(!fixtureMarker.test(bytes.toString('utf8')) && !fixtureDigests.includes(digest(bytes)), 'Fixture contamination in normal data/output');
  for (const h of fixtureDigests) requireThat(!bytes.toString('utf8').includes(h),'Relabelled fixture digest');
}
function unique(items, key, message) {
  const keys = items.map(key); requireThat(new Set(keys).size === keys.length,message);
}
function recipe(artwork, review, base) {
  // No real recipe has been supplied/reviewed. Do not invent a production profile.
  requireThat(review && artwork.recipe === 'fixture-placeholder' && artwork.recipeVersion === '1','No reviewed recipe/version profile');
  validateSchema(artwork.parameters,resolve(base,'schemas/fixture-placeholder-parameters.schema.json'));
}
export function loadRelease({ base = process.cwd(), review = false } = {}) {
  requireThat(typeof review === 'boolean','Explicit boolean review context required');
  const input = review ? 'tests/fixtures/public-inputs' : 'content';
  const assets = review ? input + '/assets' : 'public-astro/assets';
  const schema = name => resolve(base,'schemas',name + '.schema.json');
  const bytes = path => { const p = safePath(base,path); requireThat(lstatSync(p).isFile(),'Expected regular file'); const b = readFileSync(p); if (!review) rejectFixture(b); return b; };
  const read = (path,name) => validateSchema(parseJson(bytes(path)),schema(name));
  const origin = parseJson(readFileSync(safePath(base,'schemas/origin.json')));
  requireThat(origin.contractVersion === '1' && origin.sourceRevision === '24d848f691dd99cbb844374fb2f992f4804183ca','Schema provenance drift');
  for (const f of origin.files) same(digest(readFileSync(safePath(base,'schemas/'+f.path))),f.contentId,'Pinned Studio schema drift');
  const site = read(input+'/site.json','site');
  const media = read(input+'/media.json','media');
  const release = read(input+'/release-set.json','release-set');
  // Complete input inventory: unknown/unlisted files are never silently ignored.
  const expectedRoot = new Set(['site.json','media.json','release-set.json','eligibility.json','flavors','editorial',...(review?['assets']:[])]);
  for (const name of readdirSync(safePath(base,input))) requireThat(expectedRoot.has(name),'Unexpected input root entry');
  const records = (dir,name) => inventory(base,input+'/'+dir,true).map(path => {
    requireThat(new RegExp('^'+input+'/'+dir+'/[A-Za-z0-9_.-]+\\.json$').test(path),'Unexpected content path');
    const value = read(path,name); if (name === 'publication/projection') recipe(value.artwork,review,base);
    return {path,contentId:digest(bytes(path)),value};
  });
  const projections = records('flavors','publication/projection');
  const editorials = records('editorial','editorial');
  unique(projections,x=>x.value.flavor.id,'Duplicate Flavor record');
  unique(editorials,x=>x.value.flavor.id,'Duplicate editorial Flavor');
  unique(release.members,x=>x.flavor.id,'Duplicate release Flavor/member');
  unique(release.members,x=>x.slug,'Duplicate slug/route');
  unique(release.members,x=>x.projection.path,'Duplicate projection path');
  unique(media.entries,x=>x.deliveryRef,'Duplicate media deliveryRef');
  unique(media.entries,x=>x.path,'Duplicate media destination');
  unique(media.entries,x=>x.asset.assetId,'Duplicate derivative identity');
  for (const item of media.entries) {
    requireThat(item.path.startsWith(assets+'/'),'Delivery outside approved asset root');
    same(digest(bytes(item.path)),item.asset.contentId,'Delivery digest mismatch');
  }
  const hasSnapshot = readdirSync(safePath(base,input)).includes('eligibility.json');
  requireThat(!release.members.length || (hasSnapshot && release.eligibilitySnapshot),'Included member requires pinned eligibility snapshot');
  let entries = [];
  if (hasSnapshot) {
    const snapshot = read(input+'/eligibility.json',review?'fixture-assumptions':'eligibility');
    if (release.eligibilitySnapshot) same(release.eligibilitySnapshot,{id:snapshot.id,revision:review?snapshot.contractVersion:snapshot.revision,contentId:digest(bytes(input+'/eligibility.json'))},'Eligibility snapshot pin mismatch');
    same(snapshot.mediaContentId,digest(bytes(input+'/media.json')),'Media map pin mismatch');
    entries = review ? snapshot.assumptions : snapshot.entries;
    unique(entries,x=>x.flavor.id,'Duplicate eligibility Flavor');
    unique(entries,x=>x.artwork.deliveryRef,'Duplicate eligibility delivery');
    for (const e of entries) recipe(e.artwork,review,base);
  } else requireThat(!release.eligibilitySnapshot,'Snapshot pin without snapshot');
  const selected = new Set();
  const flavors = [...release.members].sort((a,b)=>a.flavor.id < b.flavor.id ? -1 : a.flavor.id > b.flavor.id ? 1 : 0).map(member=>{
    const p = projections.find(x=>x.path===member.projection.path);
    requireThat(p,'Missing included projection'); same(p.contentId,member.projection.contentId,'Projection digest mismatch'); same(p.value.flavor,member.flavor,'Flavor revision/identity mismatch');
    const e = entries.find(x=>x.flavor.id===member.flavor.id);
    requireThat(e,'Missing included eligibility entry'); same(e.flavor,member.flavor,'Eligibility Flavor revision mismatch');
    requireThat(e.use==='web' && e.validity==='eligible-at-review','Included member is not eligible for website use');
    same(e.projectionContentId,p.contentId,'Eligibility projection digest mismatch'); same(e.canonicalArtwork,p.value.canonicalArtwork,'Canonical source identity drift'); same(e.artwork,p.value.artwork,'Derivative/recipe identity drift');
    const m = media.entries.find(x=>x.deliveryRef===e.artwork.deliveryRef); requireThat(m,'Missing media delivery');
    same(m.asset,{assetId:e.artwork.assetId,revision:e.artwork.revision,contentId:e.artwork.contentId},'Media derivative identity drift');
    requireThat(!selected.has(m.path),'Duplicate selected destination'); selected.add(m.path);
    let editorial;
    if (member.editorial) {
      const item = editorials.find(x=>x.path===member.editorial.path); requireThat(item,'Missing editorial record'); same(item.contentId,member.editorial.contentId,'Editorial pin mismatch'); same(item.value.flavor,member.flavor,'Editorial Flavor revision mismatch'); editorial=item.value;
    }
    return {slug:member.slug,...p.value,mediaUrl:'/'+m.path.slice(review?assets.length+1:'public-astro/'.length),editorial};
  });
  // One explicitly owner-approved static image, independent of Flavor publication authority.
  if (!review) {
    const path = safePath(base, trancy.path);
    requireThat(lstatSync(path).isFile(), 'Expected regular static Trancy image');
    validateTrancy(readFileSync(path));
    selected.add(trancy.path);
  }
  const served = inventory(base,review?assets:'public-astro',!review);
  same(served.sort(),[...selected].sort(),'Unlisted file would be copied by publicDir');
  return {site,flavors,review,deliveries:media.entries.filter(x=>selected.has(x.path)).sort((a,b)=>a.deliveryRef<b.deliveryRef?-1:a.deliveryRef>b.deliveryRef?1:0)};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = loadRelease(); console.log(`Normal public inputs: PASS (${result.flavors.length} members)`);
}
