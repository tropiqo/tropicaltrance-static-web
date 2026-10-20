import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadRelease } from '../scripts/public-inputs.mjs';
import { loadSalesChannels } from '../scripts/sales-channels.mjs';
import { checkOutput } from '../scripts/check-static.mjs';

const root=process.cwd();
const configPath=join(root,'content/sales-channels.json');
function copyWebsite() {
  const base=mkdtempSync(join(tmpdir(),'tt-sales-channels-'));
  for(const path of ['src','scripts','schemas','content','public-astro','astro.config.mjs','package.json','package-lock.json']) cpSync(join(root,path),join(base,path),{recursive:true});
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
  for(const flavor of release.flavors) assert(!readFileSync(join(root,'dist/flavors',flavor.slug,'index.html'),'utf8').includes('Where to Find Us'));
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
    const lime=readFileSync(join(base,'dist/flavors/lime/index.html'),'utf8');
    const home=readFileSync(join(base,'dist/index.html'),'utf8');
    assert.match(grape,/Where to Find Us/);
    assert.match(grape,/href="https:\/\/wa\.me\/5215555555555" target="_blank" rel="noopener noreferrer" aria-label="Find Grape at WhatsApp \(opens in a new tab\)"/);
    assert.match(grape,/href="https:\/\/seller\.example\/grape"/);
    assert(!lime.includes('https://wa.me/'));
    assert.match(lime,/href="https:\/\/seller\.example\/grape"/);
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
    writeConfig(base,[{...sample('shop','Shop','website','https://seller.example/grape'),unexpected:'field'}]);
    assert.throws(()=>loadRelease({base}));
    writeFileSync(join(base,'content/sales-channels.json'),'{} trailing');
    assert.throws(()=>loadSalesChannels({base,flavors:['grape','lime']}));
  } finally {rmSync(base,{recursive:true,force:true});}
});
