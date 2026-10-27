import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ensureKeywordFile} from '../lib/keyword-files.mjs';
import {isKeywordIndexFor,getArticleKeywords} from '../lib/keywords.mjs';

const initial={schema_version:1,generated_at:'2026-10-27T00:00:00Z',health:{},runs:[],articles:[{id:'one',title:'关于人工智能应用试点的通知',url:'https://www.miit.gov.cn/art/policy.html',source_id:'miit',category:'工业与科技',stage:'政策发布',published_at:'2026-10-26',collected_at:'2026-10-26T00:00:00Z'}]};
async function setup(t){const dir=await mkdtemp(join(tmpdir(),'policy-keywords-'));t.after(()=>rm(dir,{recursive:true,force:true}));const dataPath=join(dir,'snapshot.json'),outputPath=join(dir,'keywords.json');await writeFile(dataPath,JSON.stringify(initial));return {dataPath,outputPath};}

test('an unreadable or malformed derived index is rebuilt from the real snapshot',async t=>{
 const paths=await setup(t);const first=await ensureKeywordFile(paths);
 await writeFile(paths.outputPath,JSON.stringify({...first,keywords:[...first.keywords,{term:'错误词组',aliases:{},group:'technology',origin:'discovered'}]}));
 const repaired=await ensureKeywordFile(paths);assert.equal(isKeywordIndexFor(repaired,initial),true);assert.ok(!repaired.keywords.some(w=>w.term==='错误词组'));
 await writeFile(paths.outputPath,'broken JSON');assert.equal(isKeywordIndexFor(await ensureKeywordFile(paths),initial),true);
});
test('refusing an invalid input snapshot preserves the last complete keyword file',async t=>{
 const paths=await setup(t);await ensureKeywordFile(paths);const before=await readFile(paths.outputPath,'utf8');
 await writeFile(paths.dataPath,JSON.stringify({...initial,articles:[{...initial.articles[0],url:'https://untrusted.example/policy'}]}));
 await assert.rejects(ensureKeywordFile(paths),/条目|地址/);assert.equal(await readFile(paths.outputPath,'utf8'),before);
});
test('same-sized changed snapshots regenerate both article tags and index binding',async t=>{
 const paths=await setup(t);await ensureKeywordFile(paths);
 const changed={...initial,articles:[{...initial.articles[0],title:'关于完善养老服务体系的实施意见'}]};await writeFile(paths.dataPath,JSON.stringify(changed));
 const updated=await ensureKeywordFile(paths);assert.equal(isKeywordIndexFor(updated,changed),true);assert.equal(isKeywordIndexFor(updated,initial),false);assert.equal(getArticleKeywords(updated,'one')[0].term,'养老服务');
});
