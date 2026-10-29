import test from 'node:test';
import assert from 'node:assert/strict';
import * as sourceModule from '../lib/sources.mjs';
const {SOURCES}=sourceModule;
import {queryArticles} from '../lib/dataset.mjs';
import {buildKeywordIndex,keywordOverview} from '../lib/keywords.mjs';
const now=new Date('2026-10-27T04:00:00Z');
const row=(id,title,source_id='miit',date='2026-10-26')=>({id,title,source_id,category:source_id==='beijing'?'地方政策':'工业与科技',stage:'政策发布',url:`https://example.test/${id}`,published_at:date,collected_at:now.toISOString(),excerpt:'',document_no:null});
const articles=[row('a','关于智能制造与绿色低碳协同转型的通知'),row('b','关于智能制造与绿色低碳协同转型的通知','xinhua','2026-10-27'),row('c','关于开展智能制造产业示范的措施','beijing'),row('d','关于促进就业与养老服务的指导意见','mca'),row('e','关于做好专项事务办理工作的通知','gov'),row('f','关于完善绿色低碳产业体系的意见','nea')];
const snapshot={schema_version:1,generated_at:now.toISOString(),articles,health:{},runs:[]};const index=buildKeywordIndex(snapshot,{now});
const params=s=>new URLSearchParams('from=2026-10-01&to=2026-10-27&'+s);
test('eight source identities cover each configured site exactly once',()=>{
 const SOURCE_TYPES=sourceModule.SOURCE_TYPES;assert.equal(SOURCE_TYPES?.length,8);assert(SOURCES.every(s=>SOURCE_TYPES.some(t=>t.id===s.source_type)));
 for(const [id,type] of [['xinhua','media'],['qstheory','media'],['gov','central'],['npc','central'],['miit','ministry'],['scio','ministry'],['beijing','local'],['std','platform'],['flk','platform'],['bjggzy','platform']])assert.equal(SOURCES.find(s=>s.id===id).source_type,type);
});
test('source types are an OR filter, separate from content domains',()=>{
 const p=params('domain=technology&source_type=media&source_type=local');const result=queryArticles(snapshot,p,30,index);assert.deepEqual(new Set(result.articles.map(a=>a.id)),new Set(['b','c']));
 assert.equal(queryArticles(snapshot,params('domain=society&source_type=ministry'),30,index).total,1);
 assert.equal(queryArticles(snapshot,params('domain=technology&source_type=local'),30,index).articles[0].category,'地方政策');
});
test('cross-domain documents use canonical dates and deduplicate within each pane',()=>{
 assert.equal(queryArticles(snapshot,params('domain=technology'),30,index).total,2);
 assert.equal(queryArticles(snapshot,params('domain=environment'),30,index).total,2);
 assert.equal(queryArticles(snapshot,new URLSearchParams('domain=technology&from=2026-10-27&to=2026-10-27'),30,index).total,0);
 const p=params('source_type=media&source_type=local');const overview=keywordOverview(index,p,{now});const w=overview.groups.find(g=>g.id==='technology').keywords.find(w=>w.term==='智能制造');assert.equal(w.count,2);
 p.set('domain','technology');p.set('keyword','智能制造');assert.equal(queryArticles(snapshot,p,30,index).total,w.count);
});
test('all and unclassified views keep documents without recognized content accessible',()=>{
 assert.equal(queryArticles(snapshot,params('domain=all'),30,index).total,5);
 assert(queryArticles(snapshot,params('domain=other'),30,index).articles.some(a=>a.id==='e'));
 assert(!queryArticles(snapshot,params('domain=technology'),30,index).articles.some(a=>a.id==='e'));
});

test('CSV exports source identity and content domains in separate columns',async()=>{
 const {toCsv}=await import('../lib/dataset.mjs');const csv=toCsv([articles[2]],index);assert.match(csv,/来源类型/);assert.match(csv,/内容领域/);assert.match(csv,/地方省级政府/);assert.match(csv,/科技与产业/);
});

test('open-ended custom windows use the same dates for words, totals and lists',()=>{
 const data={...snapshot,articles:[...articles,row('old','关于支持智能制造企业发展的办法','miit','2025-01-01')]};const keywords=buildKeywordIndex(data,{now});
 for(const bounds of ['', 'to=2026-10-27','from=2025-01-01']){
  const p=new URLSearchParams('range_mode=custom&'+bounds);const overview=keywordOverview(keywords,p,{now});assert.equal(overview.document_count,6);const w=overview.groups.find(g=>g.id==='technology').keywords.find(w=>w.term==='智能制造');assert.equal(w.count,3);p.set('domain','technology');p.set('keyword','智能制造');assert.equal(queryArticles(data,p,30,keywords).total,w.count);
 }
});
