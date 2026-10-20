import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadRelease } from '../scripts/public-inputs.mjs';
import { loadSalesChannels } from '../scripts/sales-channels.mjs';
import { checkOutput } from '../scripts/check-static.mjs';
import { applyChannelChange, planChannelChange } from '../scripts/sales-channel-workflow.mjs';

const root=process.cwd();
const configPath=join(root,'content/sales-channels.json');
function copyWebsite() {
  const base=mkdtempSync(join(tmpdir(),'tt-sales-channels-'));
  for(const path of ['src','scripts','schemas','content','public-astro','astro.config.mjs','package.json','package-lock.json']) cpSync(join(root,path),join(base,path),{recursive:true});
  const configPath=join(base,'astro.config.mjs');writeFileSync(configPath,readFileSync(configPath,'utf8').replace('vite: { resolve:',`vite: { cacheDir: '${join(base,'.vite-cache')}', resolve:`));
  symlinkSync(join(root,'node_modules'),join(base,'node_modules'),'dir');
  return base;
}
function writeConfig(base,channels) {
  writeFileSync(join(base,'content/sales-channels.json'),JSON.stringify({contractVersion:'1',channels},null,2)+'\n');
}
const sample=(id,name,kind,destinationUrl,extra={})=>({id,name,kind,destinationUrl,enabled:true,...extra});

test('initial sales channels are disabled and render no section, placeholder, or public config file',async()=>{
  const config=JSON.parse(readFileSync(configPath,'utf8'));
  assert.deepEqual(config.channels.map(({id,enabled,destinationUrl})=>({id,enabled,destinationUrl})),[
    {id:'whatsapp',enabled:false,destinationUrl:null},
    {id:'splift',enabled:false,destinationUrl:null},
    {id:'cannaland',enabled:false,destinationUrl:null},
  ]);
  const release=loadRelease();
  assert(release.flavors.every(flavor=>flavor.salesChannels.length===0));
  const home=readFileSync(join(root,'dist/index.html'),'utf8');
  assert(!home.includes('Where to Find Us'));
  for(const flavor of release.flavors) {
    assert(!readFileSync(join(root,'dist/flavors',flavor.slug,'index.html'),'utf8').includes('Where to Find Us'));
    assert(!readFileSync(join(root,'dist/es/flavors',flavor.slug,'index.html'),'utf8').includes('Dónde encontrarnos'));
  }
  assert(!existsSync(join(root,'dist/sales-channels.json')));
});

test('enabled synthetic channels render only on associated Flavor details with safe links',async()=>{
  const base=copyWebsite();
  try {
    writeConfig(base,[
      sample('whatsapp','WhatsApp','whatsapp','https://wa.me/5215555555555',{flavors:['grape']}),
      sample('demo-market','Demo Market','website','https://seller.example/grape'),
    ]);
    const build=spawnSync('npm',['run','build'],{cwd:base,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
    assert.equal(build.status,0,build.stdout+'\n'+build.stderr);
    const grape=readFileSync(join(base,'dist/flavors/grape/index.html'),'utf8');
    const spanishGrape=readFileSync(join(base,'dist/es/flavors/grape/index.html'),'utf8');
    const lime=readFileSync(join(base,'dist/flavors/lime/index.html'),'utf8');
    const spanishLime=readFileSync(join(base,'dist/es/flavors/lime/index.html'),'utf8');
    const home=readFileSync(join(base,'dist/index.html'),'utf8');
    assert.match(grape,/Where to Find Us/);
    assert.match(grape,/href="https:\/\/wa\.me\/5215555555555" target="_blank" rel="noopener noreferrer" aria-label="Find Grape at WhatsApp \(opens in a new tab\)"/);
    assert.match(grape,/href="https:\/\/seller\.example\/grape"/);
    assert.match(spanishGrape,/Dónde encontrarnos/);
    assert.match(spanishGrape,/Encontrar Grape en WhatsApp \(se abre en una pestaña nueva\)/);
    assert.match(spanishGrape,/Encontrar Grape en Demo Market \(se abre en una pestaña nueva\)/);
    assert.match(spanishGrape,/href="https:\/\/wa\.me\/5215555555555" target="_blank" rel="noopener noreferrer"/);
    assert(!lime.includes('https://wa.me/'));
    assert.match(lime,/href="https:\/\/seller\.example\/grape"/);
    assert(!spanishLime.includes('https://wa.me/'));
    assert(!home.includes('seller.example'));
    assert(!existsSync(join(base,'dist/sales-channels.json')));
    await checkOutput(base);
  } finally {rmSync(base,{recursive:true,force:true});}
});

test('invalid destinations, activation without a URL, duplicate IDs and unknown flavor associations fail closed',()=>{
  const base=copyWebsite();
  try {
    const invalid=[
      [sample('shop','Shop','website','javascript:alert(1)')],
      [sample('shop','Shop','website','http://seller.example/grape')],
      [sample('shop','Shop','website','https://user:pass@seller.example/grape')],
      [sample('whatsapp','WhatsApp','whatsapp','https://wa.me/not-a-number')],
      [sample('whatsapp','WhatsApp','whatsapp','https://seller.example/send/5215555555555')],
      [{...sample('shop','Shop','website','javascript:alert(1)'),enabled:false}],
      [sample('shop','Shop','website',null)],
      [sample('shop','Shop','website','https://seller.example/grape',{flavors:['missing-flavor']})],
      [sample('shop','Shop','website','https://seller.example/a'),sample('shop','Duplicate','website','https://seller.example/b')],
    ];
    for(const channels of invalid){writeConfig(base,channels);assert.throws(()=>loadRelease({base}));}
    writeConfig(base,[{...sample('shop','Shop','website',null),enabled:false}]);
    assert.doesNotThrow(()=>loadRelease({base}));
    assert(loadRelease({base}).flavors.every(flavor=>flavor.salesChannels.length===0));
    writeConfig(base,[{...sample('shop','Shop','website','https://seller.example/grape'),unexpected:'field'}]);
    assert.throws(()=>loadRelease({base}));
    writeFileSync(join(base,'content/sales-channels.json'),'{} trailing');
    assert.throws(()=>loadSalesChannels({base,flavors:['grape','lime']}));
  } finally {rmSync(base,{recursive:true,force:true});}
});

test('channel workflow adds disabled drafts and preserves all unrelated records',()=>{
  const base=copyWebsite();
  try {
    const before=JSON.parse(readFileSync(join(base,'content/sales-channels.json'),'utf8'));
    const candidate=planChannelChange({operation:'add',id:'demo-market',options:{name:'Demo Market',kind:'website'},base});
    assert.equal(candidate.nextChannels.at(-1).destinationUrl,null);
    assert.equal(candidate.nextChannels.at(-1).enabled,false);
    assert.deepEqual(candidate.nextChannels.slice(0,-1),before.channels);
    assert.equal(applyChannelChange(candidate,{runValidation:()=>{}}),true);
    const after=JSON.parse(readFileSync(join(base,'content/sales-channels.json'),'utf8'));
    assert.equal(after.channels.at(-1).id,'demo-market');
    assert.deepEqual(after.channels.slice(0,-1),before.channels);
    assert.deepEqual(loadSalesChannels({base,flavors:['cherry','grape','lime']}).at(-1),after.channels.at(-1));
  } finally {rmSync(base,{recursive:true,force:true});}
});

test('channel updates configure safe destinations and explicit flavor associations',()=>{
  const base=copyWebsite();
  try {
    const before=JSON.parse(readFileSync(join(base,'content/sales-channels.json'),'utf8'));
    const update=planChannelChange({operation:'update',id:'splift',options:{name:'Splift Market',destinationUrl:'https://shop.example/tropical',flavors:['grape','lime']},base});
    assert.equal(update.nextChannels[1].enabled,false);
    assert.deepEqual(update.nextChannels[1].flavors,['grape','lime']);
    assert.deepEqual(update.nextChannels.filter(channel=>channel.id!=='splift'),before.channels.filter(channel=>channel.id!=='splift'));
    applyChannelChange(update,{runValidation:()=>{}});
    const cleared=planChannelChange({operation:'update',id:'splift',options:{clearDestination:true,flavors:[]},base});
    assert.equal(cleared.nextChannels[1].destinationUrl,null);
    assert.deepEqual(cleared.nextChannels[1].flavors,[]);
    const all=planChannelChange({operation:'update',id:'splift',options:{allFlavors:true},base});
    assert.equal(Object.hasOwn(all.nextChannels[1],'flavors'),false);
  } finally {rmSync(base,{recursive:true,force:true});}
});

test('channel workflow rejects malformed, duplicate, invalid, unknown and unsafe operations',()=>{
  const base=copyWebsite();
  try {
    assert.throws(()=>planChannelChange({operation:'add',id:'Bad_ID',options:{name:'Bad'},base}),/Invalid channel ID/);
    assert.throws(()=>planChannelChange({operation:'add',id:'splift',options:{name:'Duplicate'},base}),/already exists/);
    assert.throws(()=>planChannelChange({operation:'add',id:'new-market',options:{name:'New',destinationUrl:'javascript:alert(1)'},base}),/validation failed/i);
    assert.throws(()=>planChannelChange({operation:'add',id:'new-market',options:{name:'New',destinationUrl:'https://localhost'},base}),/validation failed/i);
    assert.throws(()=>planChannelChange({operation:'add',id:'new-market',options:{name:'New',flavors:['unknown']},base}),/unknown Flavor association/);
    assert.throws(()=>planChannelChange({operation:'update',id:'missing',options:{name:'Missing'},base}),/Unknown channel/);
    assert.throws(()=>planChannelChange({operation:'update',id:'splift',options:{},base}),/no changes/);
  } finally {rmSync(base,{recursive:true,force:true});}
});

test('disable and remove require safe channel state and preserve unrelated records',()=>{
  const base=copyWebsite();
  try {
    const original=JSON.parse(readFileSync(join(base,'content/sales-channels.json'),'utf8'));
    const withEnabled={...original,channels:[...original.channels,{id:'demo-market',name:'Demo Market',kind:'website',destinationUrl:'https://shop.example',enabled:true}]};
    writeConfig(base,withEnabled.channels);
    assert.throws(()=>planChannelChange({operation:'remove',id:'demo-market',options:{},base}),/Disable the channel before removing it/);
    const disabled=planChannelChange({operation:'disable',id:'demo-market',options:{},base});
    assert.equal(disabled.nextChannels.at(-1).enabled,false);
    applyChannelChange(disabled,{runValidation:()=>{}});
    const removed=planChannelChange({operation:'remove',id:'demo-market',options:{},base});
    assert.deepEqual(removed.nextChannels,original.channels);
    assert.equal(applyChannelChange(removed,{confirm:false}),false);
    assert.deepEqual(JSON.parse(readFileSync(join(base,'content/sales-channels.json'),'utf8')).channels,original.channels.concat([{id:'demo-market',name:'Demo Market',kind:'website',destinationUrl:'https://shop.example',enabled:false}]));
    applyChannelChange(removed,{runValidation:()=>{}});
    assert.deepEqual(JSON.parse(readFileSync(join(base,'content/sales-channels.json'),'utf8')).channels,original.channels);
  } finally {rmSync(base,{recursive:true,force:true});}
});

test('cancel and validation failure leave channel configuration unchanged',()=>{
  const base=copyWebsite();
  try {
    const path=join(base,'content/sales-channels.json'),original=readFileSync(path);
    const candidate=planChannelChange({operation:'update',id:'splift',options:{name:'Splift Draft'},base});
    assert.equal(applyChannelChange(candidate,{confirm:false}),false);
    assert.deepEqual(readFileSync(path),original);
    assert.throws(()=>applyChannelChange(candidate,{runValidation:()=>{throw Error('synthetic validation failure');}}),/synthetic validation failure/);
    assert.deepEqual(readFileSync(path),original);
    assert.throws(()=>planChannelChange({operation:'add',id:'new-market',options:{name:'New',flavors:['missing']},base}));
    assert.deepEqual(readFileSync(path),original);
  } finally {rmSync(base,{recursive:true,force:true});}
});

test('empty flavor association is valid and disabled channels never render public links',()=>{
  const base=copyWebsite();
  try {
    const candidate=planChannelChange({operation:'update',id:'splift',options:{destinationUrl:'https://shop.example',flavors:[]},base});
    applyChannelChange(candidate,{runValidation:()=>{}});
    const release=loadRelease({base});
    assert(release.flavors.every(flavor=>flavor.salesChannels.length===0));
  } finally {rmSync(base,{recursive:true,force:true});}
});
