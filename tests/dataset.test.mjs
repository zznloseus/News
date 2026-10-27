import test from 'node:test';
import assert from 'node:assert/strict';
import { emptySnapshot,mergeCollection,queryArticles,sourceRows,snapshotStats,toCsv,snapshotUrl,validateSnapshot } from '../lib/dataset.mjs';
import { SOURCES } from '../lib/sources.mjs';

const when='2026-10-27T00:00:00.000Z';
const record={id:'existing',url:'https://www.miit.gov.cn/art/2026/policy.html',title:'关于开展智能制造试点工作的通知',source_id:'miit',category:'工业与科技',stage:'试点清单',published_at:'2026-10-26',collected_at:'2026-10-26T00:00:00.000Z',last_seen_at:'2026-10-26T00:00:00.000Z',excerpt:'原简介',document_no:null};
const success={source_id:'miit',checked_at:when,status:'ok',count:1,message:'正常',pages:['https://www.miit.gov.cn/'],articles:[{...record,url:record.url+'#top',title:'关于开展智能制造试点工作的通知（更新）',published_at:null,excerpt:''}]};

test('URL merge preserves history, original collection time, known date and useful excerpts',async()=>{
 const old={...emptySnapshot(),articles:[record]};const next=await mergeCollection(old,[success],{startedAt:when,finishedAt:when});
 assert.equal(next.articles.length,1);assert.equal(next.articles[0].collected_at,record.collected_at);assert.equal(next.articles[0].published_at,'2026-10-26');assert.equal(next.articles[0].excerpt,'原简介');assert.match(next.articles[0].title,/更新/);assert.equal(next.runs[0].new_articles,0);assert.equal(old.articles[0].title,record.title);
});
test('failed sources retain existing records and last successful check',async()=>{
 const old={...emptySnapshot(),articles:[record],health:{miit:{...success,last_success_at:'2026-10-26T00:00:00.000Z'}}};const next=await mergeCollection(old,[{...success,status:'error',message:'HTTP 403',articles:[]}],{startedAt:when,finishedAt:when});
 assert.equal(next.articles.length,1);assert.equal(next.health.miit.status,'error');assert.equal(next.health.miit.last_success_at,old.health.miit.last_success_at);assert.equal(next.runs[0].failed,1);assert.equal(next.runs[0].status,'failed');
});
test('new records have stable IDs, no fabricated date, and reject foreign URLs or template titles',async()=>{
 const r={...success,articles:[{...record,id:undefined,collected_at:undefined,published_at:null},{...record,url:'https://evil.example/x.html'},{...record,url:'https://www.miit.gov.cn/x.html',title:'{{ x.docSubtitle | trimHtml }}'}]};
 const next=await mergeCollection(emptySnapshot(),[r],{startedAt:when,finishedAt:when});assert.equal(next.articles.length,1);assert.equal(next.articles[0].published_at,null);assert.equal(next.articles[0].id.length,64);assert.equal(next.runs[0].new_articles,1);
});
test('search supports category, source, stage, scope, dates, policy-only and pagination',()=>{
 const extra={...record,id:'local',source_id:'beijing',category:'地方政策',stage:'征求意见',title:'北京市智能制造规划征求意见',published_at:'2026-10-27'};const unknown={...record,id:'unknown',published_at:null,stage:'工作动态'};
 const snapshot={...emptySnapshot(),articles:[record,extra,unknown]};
 assert.equal(queryArticles(snapshot,new URLSearchParams('q=智能制造&policy=1')).total,2);
 assert.deepEqual(queryArticles(snapshot,new URLSearchParams('scope=province&from=2026-10-27')).articles.map(x=>x.id),['local']);
 assert.equal(queryArticles(snapshot,new URLSearchParams('category='+encodeURIComponent('工业与科技')+'&source=miit&stage='+encodeURIComponent('试点清单'))).total,1);
 assert.equal(queryArticles(snapshot,new URLSearchParams('from=2026-10-26')).total,2);
 assert.equal(queryArticles(snapshot,new URLSearchParams('page=2'),1).articles[0].id,'existing');
});
test('coverage counts actual recent parse success rather than all configured sources',()=>{
 const s={...emptySnapshot(),articles:[record],health:{miit:{...success},gov:{...success,source_id:'gov',status:'error'}}};
 const stats=snapshotStats(s,new Date(when));assert.equal(stats.sourceTotal,83);assert.equal(stats.successful,1);assert.equal(stats.total,1);assert.equal(sourceRows(s).length,SOURCES.length);
 assert.equal(snapshotStats(s,new Date('2026-11-01')).successful,0);
});
test('CSV correctly quotes fields and neutralizes spreadsheet formulas',()=>{
 const csv=toCsv([{...record,title:'=HYPERLINK("x")\n中文'}]);assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=HYPERLINK(""x"")\n中文"'));
});
test('data URLs resolve under a repository subpath and custom domain',()=>{
 assert.equal(snapshotUrl('https://alice.github.io/policy-observatory/'),'https://alice.github.io/policy-observatory/data/snapshot.json');
 assert.equal(snapshotUrl('https://policy.example/'),'https://policy.example/data/snapshot.json');
});
test('invalid or missing data is rejected rather than silently showing empty success',()=>{
 assert.throws(()=>validateSnapshot({articles:[]}),/数据|版本/);assert.throws(()=>validateSnapshot({...emptySnapshot(),articles:[{...record,url:'javascript:alert(1)'}]}),/地址|条目/);
 assert.equal(validateSnapshot(emptySnapshot()).schema_version,1);
});
