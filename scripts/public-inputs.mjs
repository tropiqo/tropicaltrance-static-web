import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parseJson, validateSchema } from './closed-json.mjs';
import { fixtureDigests, fixtureMarker } from './fixture-guards.mjs';
import { trancy, validateTrancy } from './trancy-static.mjs';
import { channelsForFlavor, loadSalesChannels } from './sales-channels.mjs';

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
function fixtureRecipe(artwork, base) {
  requireThat(artwork.recipe === 'fixture-placeholder' && artwork.recipeVersion === '1','No reviewed fixture recipe/version profile');
  validateSchema(artwork.parameters,resolve(base,'schemas/fixture-placeholder-parameters.schema.json'));
}
function loadReviewRelease({ base }) {
  const review = true;
  const input = 'tests/fixtures/public-inputs';
  const assets = input + '/assets';
  const schema = name => resolve(base,'schemas',name + '.schema.json');
  const bytes = path => { const p = safePath(base,path); requireThat(lstatSync(p).isFile(),'Expected regular file'); return readFileSync(p); };
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
    const value = read(path,name); if (name === 'publication/projection') fixtureRecipe(value.artwork,base);
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
    const deliveryBytes = bytes(item.path);
    same(digest(deliveryBytes),item.asset.contentId,'Delivery digest mismatch');
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
    for (const e of entries) fixtureRecipe(e.artwork,base);
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
  const served=inventory(base,assets);
  same(served.sort(),[...selected].sort(),'Unlisted file would be copied by review publicDir');
  return {site,flavors,review,deliveries:media.entries.filter(x=>selected.has(x.path)).sort((a,b)=>a.deliveryRef<b.deliveryRef?-1:a.deliveryRef>b.deliveryRef?1:0)};
}

function loadFlavorContent({base}) {
  const schema = resolve(base,'schemas/flavor-content.schema.json');
  const sitePath = safePath(base,'content/site.json');
  const readContent=path=>{const bytes=readFileSync(safePath(base,path));rejectFixture(bytes);return bytes;};
  const site = validateSchema(parseJson(readContent('content/site.json')),resolve(base,'schemas/site.schema.json'));
  const flavorsPath = 'content/flavors';
  const flavorFiles = inventory(base,flavorsPath,true);
  const rootEntries = readdirSync(safePath(base,'content'));
  requireThat(rootEntries.every(name=>['site.json','flavors','editorial','sales-channels.json'].includes(name)),'Unexpected normal content entry');
  requireThat(inventory(base,'content/editorial',true).length===0,'Unsupported normal editorial content');
  unique(flavorFiles,x=>x,'Duplicate flavor content path');
  const flavors = flavorFiles.map(path=>{
    requireThat(/^content\/flavors\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(path),'Unexpected flavor content path');
    const value=validateSchema(parseJson(readContent(path)),schema);
    const slug=path.slice('content/flavors/'.length,-'.json'.length);
    same(value.slug,slug,'Flavor slug/file name mismatch');
    const mediaPath='public-astro/'+value.media.path;
    requireThat(value.media.path.startsWith('assets/') && value.media.path===`assets/${slug}-web-r${value.revision}.webp`,'Flavor media path mismatch');
    const bytes=readFileSync(safePath(base,mediaPath));
    rejectFixture(bytes);
    requireThat(bytes.length>=16 && bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP','Flavor delivery is not a WebP image');
    same(digest(bytes),value.media.contentId,'Flavor media digest mismatch');
    return {flavor:{id:slug,revision:value.revision},slug,name:value.name,shortDescription:value.shortDescription,alt:value.alt,mediaUrl:'/'+value.media.path,media:{contentId:value.media.contentId}};
  }).sort((a,b)=>a.slug.localeCompare(b.slug));
  unique(flavors,x=>x.slug,'Duplicate Flavor slug');
  const channelConfig = loadSalesChannels({base,flavors:flavors.map(flavor=>flavor.slug)});
  for (const flavor of flavors) flavor.salesChannels = channelsForFlavor(channelConfig,flavor);
  const deliveries=flavors.map(f=>({path:'public-astro/'+f.mediaUrl.slice(1),asset:{contentId:f.media.contentId}}));
  const selected=new Set([trancy.path,...deliveries.map(d=>d.path)]);
  const trancyPath=safePath(base,trancy.path);
  requireThat(lstatSync(trancyPath).isFile(),'Expected regular static Trancy image');
  validateTrancy(readFileSync(trancyPath));
  same(inventory(base,'public-astro').sort(),[...selected].sort(),'Unlisted file would be copied by publicDir');
  return {site,flavors,review:false,deliveries};
}

export function loadRelease({base=process.cwd(),review=false}={}) {
  requireThat(typeof review==='boolean','Explicit boolean review context required');
  return review ? loadReviewRelease({base}) : loadFlavorContent({base});
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = loadRelease(); console.log(`Normal website content: PASS (${result.flavors.length} flavors)`);
}
