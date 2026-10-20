import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { createServer } from 'node:net';
import sharp from 'sharp';
import { digest, inventory, loadRelease, safePath } from './public-inputs.mjs';

const root = resolve(new URL('..', import.meta.url).pathname);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const safeSlug = slug => slugPattern.test(slug) && !['index','404'].includes(slug) && !slug.startsWith('fixture-');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value,null,2)+'\n';

function snapshot(rootPath) {
  const paths=[];
  const walk=path=>{const absolute=join(rootPath,path),stat=lstatSync(absolute);assert(!stat.isSymbolicLink(),`Symlink in candidate source: ${path}`);if(stat.isDirectory())for(const name of readdirSync(absolute).sort())walk(`${path}/${name}`);else {assert(stat.isFile(),`Nonregular candidate source: ${path}`);paths.push(path);}};
  for(const path of ['content','public-astro','src','scripts','schemas','astro.config.mjs','package.json','package-lock.json'])if(existsSync(join(rootPath,path)))walk(path);
  paths.sort();
  return hash(Buffer.from(paths.map(path=>`${path}\0${hash(readFileSync(join(rootPath,path)))}`).join('\n')));
}
function copyCandidateTree(source,destination) {
  for (const path of ['src','scripts','schemas','content','public-astro']) cpSync(join(source,path),join(destination,path),{recursive:true});
  for (const path of ['astro.config.mjs','package.json','package-lock.json','tsconfig.json']) if (existsSync(join(source,path))) cpSync(join(source,path),join(destination,path));
  symlinkSync(join(source,'node_modules'),join(destination,'node_modules'),'dir');
}
function run(command,args,cwd,{inherit=false}={}) {
  const result=spawnSync(command,args,{cwd,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024,stdio:inherit?'inherit':'pipe'});
  if (result.error || result.status!==0) throw Error(`${command} ${args.join(' ')} failed${result.status===null?'':` (${result.status})`}: ${result.stderr||result.error?.message||''}`);
  return result.stdout||'';
}
function records(rootPath) {
  const dir=join(rootPath,'content/flavors');
  return readdirSync(dir).filter(name=>name.endsWith('.json')).sort().map(name=>JSON.parse(readFileSync(join(dir,name),'utf8')));
}
function validateImagePath(input) {
  const path=resolve(input); const stat=lstatSync(path);
  assert(stat.isFile() && !stat.isSymbolicLink(),'Image input must be a regular, non-symlink file');
  assert(stat.size>0 && stat.size<=50*1024*1024,'Image must be between 1 byte and 50 MiB');
  assert(/\.(?:png|jpe?g|webp)$/i.test(path),'Supported image formats are PNG, JPEG, and WebP');
  return path;
}

export async function createCandidate({mode,websiteRoot=root,slug,imagePath,name,shortDescription,alt}) {
  assert(['add','update'].includes(mode),'Flavor operation must be add or update');
  loadRelease({base:websiteRoot});
  const baseline=snapshot(websiteRoot);
  const current=records(websiteRoot);
  let chosen=slug;
  if (!chosen) throw Error('A flavor slug is required');
  chosen=chosen.toLowerCase();
  assert(safeSlug(chosen),`Invalid or reserved flavor slug: ${chosen}`);
  const existing=current.find(value=>value.slug===chosen);
  assert(mode==='add'?!existing:Boolean(existing),mode==='add'?`Flavor already exists: ${chosen}`:`Unknown flavor: ${chosen}`);
  assert(imagePath,'Choose artwork with --image /path/to/image.png');
  const sourcePath=validateImagePath(imagePath);
  const sourceBytes=readFileSync(sourcePath), sourceHash=hash(sourceBytes);
  const metadata=await sharp(sourceBytes,{limitInputPixels:40_000_000}).metadata();
  assert(['png','jpeg','webp'].includes(metadata.format),'Image decoder rejected the selected format');
  assert(metadata.width>0 && metadata.height>0 && metadata.width*metadata.height<=40_000_000,'Image dimensions exceed the supported limit');
  assert(!metadata.pages || metadata.pages===1,'Animated or multi-page artwork is not supported');
  const revisionNumber=existing?Number(existing.revision)+1:1;
  assert(Number.isSafeInteger(revisionNumber) && revisionNumber>0,'Flavor revision is outside the supported range');
  const nextRevision=String(revisionNumber);
  const projection={
    contractVersion:'1',slug:chosen,revision:nextRevision,
    name:name??existing?.name,shortDescription:shortDescription??existing?.shortDescription,alt:alt??existing?.alt,
    media:{path:`assets/${chosen}-web-r${nextRevision}.webp`,contentId:''}
  };
  for (const [key,value] of Object.entries({name:projection.name,shortDescription:projection.shortDescription,alt:projection.alt})) {
    assert(typeof value==='string' && value.trim(),`${key} is required`);
    assert(!/(?:\/|\\|https?:|file:|tropical-trance-studio|artwork-workspace:)/i.test(value),`${key} contains a path or private reference`);
  }
  const webp=await sharp(sourceBytes,{limitInputPixels:40_000_000})
    .resize({width:1024,height:1536,fit:'inside',withoutEnlargement:true,kernel:'lanczos3',fastShrinkOnLoad:false})
    .webp({lossless:true,effort:6}).toBuffer();
  assert.equal(hash(readFileSync(sourcePath)),sourceHash,'Source image changed during preparation');
  const outMetadata=await sharp(webp).metadata();
  assert.equal(outMetadata.format,'webp');
  projection.media.contentId=digest(webp);

  const candidateRoot=mkdtempSync(join(tmpdir(),'tropical-flavor-candidate-'));
  try {
    copyCandidateTree(websiteRoot,candidateRoot);
    const contentPath=join(candidateRoot,`content/flavors/${chosen}.json`);
    mkdirSync(dirname(contentPath),{recursive:true});
    writeFileSync(contentPath,json(projection));
    const assetPath=join(candidateRoot,'public-astro',projection.media.path);
    mkdirSync(dirname(assetPath),{recursive:true});
    writeFileSync(assetPath,webp,{flag:'wx'});
    if (existing) {
      const stillUsed=current.some(item=>item.slug!==chosen && item.media.path===existing.media.path);
      if (!stillUsed) rmSync(join(candidateRoot,'public-astro',existing.media.path),{force:true});
    }
    run('npm',['run','build'],candidateRoot);
    assert.equal(snapshot(websiteRoot),baseline,'Website inputs changed while preparing the candidate');
    const candidate={websiteRoot,candidateRoot,slug:chosen,existing,projection,webp,sourcePath,sourceHash,snapshot:baseline,width:outMetadata.width,height:outMetadata.height,size:webp.length};
    return candidate;
  } catch(error) {
    rmSync(candidateRoot,{recursive:true,force:true});
    throw error;
  }
}

export function cancelCandidate(candidate) {
  rmSync(candidate.candidateRoot,{recursive:true,force:true});
}

export function applyCandidate(candidate,{validate=true,runValidation=()=>run('npm',['run','validate'],candidate.websiteRoot,{inherit:true})}={}) {
  const {websiteRoot,candidateRoot,slug,existing,projection,webp,snapshot:baseline}=candidate;
  assert.equal(snapshot(websiteRoot),baseline,'Website inputs changed during preview; candidate is stale, prepare it again');
  assert.equal(hash(readFileSync(candidate.sourcePath)),candidate.sourceHash,'Selected source changed during preview');
  safePath(websiteRoot,'content/flavors');
  const contentRelative=`content/flavors/${slug}.json`;
  const contentPath=existsSync(join(websiteRoot,contentRelative))?safePath(websiteRoot,contentRelative):join(websiteRoot,contentRelative);
  const contentBefore=existsSync(contentPath)?readFileSync(contentPath):undefined;
  const assetRel=`public-astro/${projection.media.path}`;
  const assetPath=join(websiteRoot,assetRel);
  assert(!existsSync(assetPath),'Candidate media path already exists');
  const oldRel=existing?`public-astro/${existing.media.path}`:undefined;
  const oldPath=oldRel?join(websiteRoot,oldRel):undefined;
  const oldBytes=oldPath&&existsSync(oldPath)?readFileSync(oldPath):undefined;
  const tempJson=`${contentPath}.flavor-update-${process.pid}.tmp`;
  let installed=false,updated=false,removedOld=false;
  try {
    writeFileSync(assetPath,webp,{flag:'wx'}); installed=true;
    writeFileSync(tempJson,json(projection),{flag:'wx'});
    renameSync(tempJson,contentPath); updated=true;
    if(oldPath && oldBytes && !records(websiteRoot).some(item=>item.slug!==slug && item.media.path===existing.media.path)) {
      rmSync(oldPath); removedOld=true;
    }
    if(validate) runValidation();
  } catch(error) {
    rmSync(tempJson,{force:true});
    if(updated) {
      if(contentBefore) writeFileSync(contentPath,contentBefore);
      else rmSync(contentPath,{force:true});
    }
    if(removedOld && oldBytes) writeFileSync(oldPath,oldBytes,{flag:'wx'});
    if(installed) rmSync(assetPath,{force:true});
    throw error;
  }
  return {contentPath,assetPath,removedOld:removedOld?oldRel:undefined};
}

export async function createRemovalCandidate({websiteRoot=root,slug}) {
  loadRelease({base:websiteRoot});
  const baseline=snapshot(websiteRoot),current=records(websiteRoot);
  assert(slug && safeSlug(slug),`Invalid or reserved flavor slug: ${slug}`);
  const record=current.find(value=>value.slug===slug);
  assert(record,`Unknown flavor: ${slug}`);
  const shared=current.some(value=>value.slug!==slug && value.media.path===record.media.path);
  const candidateRoot=mkdtempSync(join(tmpdir(),'tropical-flavor-remove-'));
  try {
    copyCandidateTree(websiteRoot,candidateRoot);
    run('npm',['run','build'],candidateRoot);
    assert.equal(snapshot(websiteRoot),baseline,'Website inputs changed while preparing the removal preview');
    return {websiteRoot,candidateRoot,slug,record,shared,snapshot:baseline};
  } catch(error) {
    rmSync(candidateRoot,{recursive:true,force:true});
    throw error;
  }
}

export function applyRemoval(candidate,{validate=true,runValidation=()=>run('npm',['run','validate'],candidate.websiteRoot,{inherit:true})}={}) {
  const {websiteRoot,slug,record,snapshot:baseline}=candidate;
  assert.equal(snapshot(websiteRoot),baseline,'Website inputs changed during removal preview; prepare again');
  const shared=records(websiteRoot).some(value=>value.slug!==slug && value.media.path===record.media.path);
  const contentPath=safePath(websiteRoot,`content/flavors/${slug}.json`);
  const contentBytes=readFileSync(contentPath);
  const assetPath=shared?undefined:safePath(websiteRoot,`public-astro/${record.media.path}`);
  const assetBytes=assetPath?readFileSync(assetPath):undefined;
  let removedContent=false,removedAsset=false;
  try {
    rmSync(contentPath);removedContent=true;
    if(assetPath){rmSync(assetPath);removedAsset=true;}
    if(validate)runValidation();
  } catch(error) {
    if(removedContent && !existsSync(contentPath))writeFileSync(contentPath,contentBytes,{flag:'wx'});
    if(removedAsset && assetPath && !existsSync(assetPath))writeFileSync(assetPath,assetBytes,{flag:'wx'});
    throw error;
  }
  return {contentPath,assetPath:removedAsset?assetPath:undefined,shared};
}

async function availablePort() {
  return new Promise((resolvePort,reject)=>{
    const server=createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolvePort(port));});
  });
}
async function waitForPreview(port,child) {
  for(let attempt=0;attempt<60;attempt++){
    if(child.exitCode!==null) throw Error('Candidate preview server exited before becoming ready');
    try { const response=await fetch(`http://127.0.0.1:${port}/flavors/`);if(response.ok)return; } catch {}
    await new Promise(resolveWait=>setTimeout(resolveWait,250));
  }
  throw Error('Candidate preview server did not become ready');
}
async function stopPreview(child) {
  if(child.exitCode!==null)return;
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolveExit=>child.once('exit',resolveExit)),new Promise(resolveWait=>setTimeout(resolveWait,3000))]);
  if(child.exitCode===null)child.kill('SIGKILL');
}
export async function startCandidatePreview(candidate) {
  const port=await availablePort();
  const child=spawn(join(candidate.candidateRoot,'node_modules/.bin/astro'),['preview','--host','127.0.0.1','--port',String(port)],{cwd:candidate.candidateRoot,stdio:'ignore'});
  try { await waitForPreview(port,child);return {port,child}; }
  catch(error) { await stopPreview(child);throw error; }
}
function parseArgs(args) {
  const options={}; let slug;
  for(let i=0;i<args.length;i++){
    const item=args[i];
    if(item==='--image'||item==='--name'||item==='--description'||item==='--alt'){
      const value=args[++i];if(!value)throw Error(`${item} requires a value`);
      options[{ '--image':'imagePath','--name':'name','--description':'shortDescription','--alt':'alt' }[item]]=value;
    } else if(item.startsWith('-')) throw Error(`Unknown option: ${item}`);
    else if(!slug) slug=item; else throw Error(`Unexpected argument: ${item}`);
  }
  return {slug,...options};
}

export async function runAddUpdate(mode,args=process.argv.slice(2)) {
  assert(['add','update'].includes(mode),'Flavor operation must be add or update');
  const options=parseArgs(args);
  if(!options.imagePath) throw Error('Choose artwork with --image /path/to/image.png');
  if(!options.slug) throw Error('Choose an existing flavor slug or a new flavor slug');
  if(!stdin.isTTY) throw Error('Interactive preview and confirmation require a terminal');
  const prompt=createInterface({input:stdin,output:stdout});
  let candidate,preview;
  try {
    const prior=records(root).find(value=>value.slug===options.slug.toLowerCase());
    assert(mode==='add'?!prior:Boolean(prior),mode==='add'?`Flavor already exists: ${options.slug}`:`Unknown flavor: ${options.slug}`);
    for(const [key,label] of [['name','Flavor name'],['shortDescription','Short description'],['alt','Accessible alt text']]) {
      if(options[key]===undefined) {
        const defaultValue=prior?.[key]??'';
        const answer=(await prompt.question(`${label}${defaultValue?` [${defaultValue}]`:''}: `)).trim();
        options[key]=answer||defaultValue;
      }
    }
    candidate=await createCandidate({...options,mode});
    const server=await startCandidatePreview(candidate);preview=server.child;const {port}=server;
    stdout.write(`\nCandidate preview: http://127.0.0.1:${port}/flavors/ and http://127.0.0.1:${port}/flavors/${candidate.slug}/\n`);
    stdout.write(`Prepared WebP: ${candidate.width}x${candidate.height}, ${candidate.size} bytes, ${candidate.projection.media.contentId}\n`);
    const answer=(await prompt.question(`${mode==='add'?'Add':'Update'} this local flavor after review? [y/N] `)).trim().toLowerCase();
    if(answer!=='y' && answer!=='yes') { stdout.write('Cancelled; website files are unchanged.\n'); return; }
    const changed=applyCandidate(candidate);
    stdout.write(`Applied and validated ${candidate.slug}: ${changed.contentPath}, ${changed.assetPath}\n`);
  } finally {
    prompt.close();if(preview)await stopPreview(preview);
    if(candidate)cancelCandidate(candidate);
  }
}

export async function runRemove(args=process.argv.slice(2)) {
  assert(args.length===1 && !args[0].startsWith('-'),'Usage: npm run flavor:remove -- <slug>');
  const slug=args[0].toLowerCase();
  assert(stdin.isTTY,'Interactive removal requires a terminal');
  const candidate=await createRemovalCandidate({slug});
  const prompt=createInterface({input:stdin,output:stdout});let preview;
  try {
    const server=await startCandidatePreview(candidate);preview=server.child;const {port}=server;
    stdout.write(`\nSelected flavor: ${candidate.record.name} (${slug})\nArtwork: ${candidate.record.media.path}\nSHA-256: ${candidate.record.media.contentId}\n`);
    stdout.write(`Preview the current collection and detail: http://127.0.0.1:${port}/flavors/ and http://127.0.0.1:${port}/flavors/${slug}/\n`);
    const answer=(await prompt.question(`Remove ${candidate.record.name} and its ${candidate.shared?'shared artwork will be kept':'unshared artwork'}? [y/N] `)).trim().toLowerCase();
    if(answer!=='y' && answer!=='yes'){stdout.write('Cancelled; website files are unchanged.\n');return;}
    const changed=applyRemoval(candidate);
    stdout.write(`Removed and validated ${slug}: ${changed.contentPath}${changed.assetPath?`, ${changed.assetPath}`:''}\n`);
  } finally {prompt.close();if(preview)await stopPreview(preview);cancelCandidate(candidate);}
}
