import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectSources,loadSnapshot,writeSnapshot } from '../lib/collector.mjs';
import { emptySnapshot } from '../lib/dataset.mjs';

test('source failures do not abort other sources and concurrency stays bounded',async()=>{
 let active=0,peak=0;const sources=Array.from({length:7},(_,i)=>({id:String(i)}));
 const results=await collectSources({sources,concurrency:2,crawl:async source=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));active--;if(source.id==='2')throw Error('one source failed');return {source_id:source.id,status:'empty',articles:[],count:0};}});
 assert.equal(results.length,7);assert.equal(peak,2);assert.equal(results.find(r=>r.source_id==='2').status,'error');
});
test('atomic snapshot persistence refuses invalid data and retains the last valid file',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'policy-data-'));const path=join(directory,'snapshot.json');
 try{const snapshot=emptySnapshot();await writeSnapshot(path,snapshot);assert.equal((await loadSnapshot(path)).schema_version,1);await assert.rejects(()=>writeSnapshot(path,{articles:[]}));assert.deepEqual(JSON.parse(await readFile(path,'utf8')),snapshot);await writeFile(path,'broken');await assert.rejects(()=>loadSnapshot(path));}finally{await rm(directory,{recursive:true,force:true});}
});
