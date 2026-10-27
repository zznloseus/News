import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKeywordIndex,keywordOverview,getArticleKeywords,isKeywordIndexFor } from '../lib/keywords.mjs';
import { queryArticles } from '../lib/dataset.mjs';

const now=new Date('2026-10-27T04:00:00Z');
const article=(id,title,source='miit',date='2026-10-26')=>({id,title,source_id:source,url:`https://www.${source}.gov.cn/art/${id}.html`,category:'工业与科技',stage:'政策发布',published_at:date,collected_at:'2026-10-26T02:00:00Z',excerpt:'',document_no:null});
const snapshot=articles=>({schema_version:1,generated_at:'2026-10-27T04:00:00Z',articles,health:{},runs:[]});
const find=(index,term,params=new URLSearchParams(),days=30,at=now)=>keywordOverview(index,params,{days,now:at}).groups.flatMap(g=>g.keywords).find(w=>w.term===term);

test('aliases, repeated mentions and republications count once per distinct document',()=>{
 const data=snapshot([article('a','关于促进人工智能（AI）应用的通知'),article('b','关于促进人工智能（AI）应用的通知','gov'),article('c','关于人工智能应用试点的实施意见','most')]);
 const index=buildKeywordIndex(data,{now});
 assert.equal(find(index,'人工智能').count,2);
 assert.equal(find(index,'AI'),undefined);
 assert.equal(getArticleKeywords(index,'a',20).filter(w=>w.term==='人工智能').length,1);
 assert.equal(keywordOverview(index,new URLSearchParams(),{days:30,now}).document_count,2);
});

test('recent windows use China publication dates, excluding missing invalid future and old dates',()=>{
 const data=snapshot([article('a','人工智能产业应用实施方案','miit','2026-10-21'),article('b','人工智能产业应用试点清单','gov','2026-10-27'),article('c','人工智能产业应用支持措施','most','2026-10-20'),article('d','人工智能产业规划实施办法','miit',null),article('e','人工智能产业试点申报指南','gov','2026-10-28'),article('f','人工智能公共服务指导意见','most','2026-02-30')]);
 const index=buildKeywordIndex(data,{now:new Date('2026-10-26T16:01:00Z')});
 const overview=keywordOverview(index,new URLSearchParams(),{days:7,now:new Date('2026-10-26T16:01:00Z')});
 assert.equal(overview.from,'2026-10-21');assert.equal(overview.to,'2026-10-27');assert.equal(overview.document_count,2);assert.equal(overview.excluded_dates,2);
 assert.equal(overview.groups.flatMap(g=>g.keywords).find(w=>w.term==='人工智能').count,2);
});

test('new phrases outside the seed vocabulary are promoted after three documents and two sources',()=>{
 const one=article('a','关于推进光子计算技术研发的若干措施');
 const initial=buildKeywordIndex(snapshot([one]),{now});
 assert.equal(find(initial,'光子计算'),undefined);
 const data=snapshot([one,article('b','关于开展光子计算成果转化的通知','gov'),article('c','关于支持光子计算试点应用的意见','most')]);
 const promoted=buildKeywordIndex(data,{now:new Date('2026-10-28T04:00:00Z'),previousIndex:initial});
 const term=find(promoted,'光子计算',new URLSearchParams(),30,new Date('2026-10-28T04:00:00Z'));assert.ok(term);assert.equal(term.count,3);assert.equal(term.origin,'discovered');assert.equal(term.group,'other');assert.equal(term.is_new,true);
 const refreshed=buildKeywordIndex(data,{now:new Date('2026-10-29T04:00:00Z'),previousIndex:promoted});
 assert.equal(refreshed.keywords.find(w=>w.term==='光子计算').first_seen_at,promoted.keywords.find(w=>w.term==='光子计算').first_seen_at);
 assert.equal(refreshed.keywords.find(w=>w.term==='光子计算').promoted_at,promoted.keywords.find(w=>w.term==='光子计算').promoted_at);
});

test('one publisher and repeated copies cannot manufacture new-term support',()=>{
 const index=buildKeywordIndex(snapshot([article('a','关于推进光子计算技术研发的措施'),article('b','关于开展光子计算成果转化的通知'),article('c','关于支持光子计算试点应用的意见')]),{now});
 assert.equal(find(index,'光子计算'),undefined);
 const copies=buildKeywordIndex(snapshot([article('a','关于推进光子计算技术研发的措施'),article('b','关于推进光子计算技术研发的措施','gov'),article('c','关于推进光子计算技术研发的措施','most')]),{now});
 assert.equal(find(copies,'光子计算'),undefined);
});

test('boilerplate and Latin substring matches do not become news tags',()=>{
 const data=snapshot([article('a','关于进一步加强有关工作的通知'),article('b','TAIWAN产业发展实施办法'),article('c','C‑V2X技术应用试点方案')]);
 const index=buildKeywordIndex(data,{now});
 assert.equal(getArticleKeywords(index,'a').length,0);assert.ok(!getArticleKeywords(index,'b',20).some(w=>w.term==='人工智能'));
 assert.ok(getArticleKeywords(index,'c',20).some(w=>w.term==='C-V2X'));
});

test('initial historical import never labels its existing vocabulary as newly discovered',()=>{
 const index=buildKeywordIndex(snapshot([article('a','关于推进光子计算技术研发的措施'),article('b','关于开展光子计算成果转化的通知','gov'),article('c','关于支持光子计算试点应用的意见','most')]),{now});
 assert.equal(find(index,'光子计算').is_new,false);
});

test('repeated press templates and institution fragments stay out of discovered topics',()=>{
 const titles=['住房城乡建设部负责人就修订后有关规定答记者问','省政府办公厅负责人就工作通知答记者问','国家发展改革委负责人就有关方案答记者问'];
 const data=snapshot(titles.flatMap((title,i)=>[article('a'+i,title,'miit'),article('b'+i,title+'（解读）','gov'),article('c'+i,title+'（问答）','most')]));
 const index=buildKeywordIndex(data,{now});
 for(const bad of ['记者问','省政府','改革委','住房城乡','修订后','负责人就'])assert.ok(!index.keywords.some(w=>w.term===bad),bad+' must not be a topic');
});

test('keyword filtering uses canonical membership and remains combined with source and date filters',()=>{
 const data=snapshot([article('a','关于促进人工智能（AI）应用的通知'),article('b','关于促进人工智能（AI）应用的通知','gov'),article('c','关于AI赋能制造业的实施意见','most'),article('d','关于完善养老服务体系的措施','gov')]);
 const index=buildKeywordIndex(data,{now});
 assert.equal(queryArticles(data,new URLSearchParams('keyword=人工智能'),30,index).total,2);
 assert.equal(queryArticles(data,new URLSearchParams('keyword=人工智能&source=gov&from=2026-10-26'),30,index).total,1);
 assert.equal(queryArticles(data,new URLSearchParams('keyword=养老服务'),30,index).articles[0].id,'d');
});

test('index binding detects title and publication-date changes, not only article count',()=>{
 const data=snapshot([article('a','关于促进人工智能应用的通知')]);const index=buildKeywordIndex(data,{now});
 assert.equal(isKeywordIndexFor(index,data),true);
 assert.equal(isKeywordIndexFor(index,{...data,articles:[{...data.articles[0],title:'关于完善养老服务体系的通知'}]}),false);
 assert.equal(isKeywordIndexFor(index,{...data,articles:[{...data.articles[0],published_at:'2026-10-20'}]}),false);
});

test('overview respects policy-only and scope filters without assigning topics from a source category',()=>{
 const data=snapshot([article('a','关于人工智能应用试点的意见','gov'),{...article('b','关于人工智能应用调研的消息','miit'),stage:'工作动态'},article('c','关于人工智能应用支持的措施','beijing')]);
 const index=buildKeywordIndex(data,{now});
 assert.equal(keywordOverview(index,new URLSearchParams('policy=1'),{days:30,now}).document_count,2);
 assert.equal(keywordOverview(index,new URLSearchParams('policy=1&scope=province'),{days:30,now}).document_count,1);
 assert.equal(getArticleKeywords(index,'c')[0].group,'technology');
});

test('linked recent results use the same earliest document date as the keyword overview',()=>{
 const data=snapshot([article('old','关于促进人工智能应用的通知','miit','2026-10-01'),article('copy','关于促进人工智能应用的通知','gov','2026-10-26'),article('new1','关于人工智能创新平台建设的意见','most'),article('new2','关于人工智能服务应用的措施','miit')]);
 const index=buildKeywordIndex(data,{now});const params=new URLSearchParams('keyword=人工智能&from=2026-10-21&to=2026-10-27');
 const count=keywordOverview(index,params,{days:7,now}).groups.flatMap(g=>g.keywords).find(w=>w.term==='人工智能').count;
 assert.equal(count,2);assert.equal(queryArticles(data,params,30,index).total,2);
});

test('malformed aliases and incomplete document maps invalidate an otherwise matching index',()=>{
 const data=snapshot([article('a','关于人工智能应用示范的通知')]);const index=buildKeywordIndex(data,{now});
 assert.equal(isKeywordIndexFor({...index,documents:[]},data),false);
 assert.equal(isKeywordIndexFor({...index,keywords:index.keywords.map(w=>({...w,aliases:{}}))},data),false);
 assert.equal(isKeywordIndexFor({...index,documents:[null]},data),false);
 assert.equal(isKeywordIndexFor({...index,keywords:[null]},data),false);
});

test('discovery and source evidence are independent of article order',()=>{
 const titles=['关于推进光子计算技术研发的措施','关于开展光子计算成果转化的通知','关于支持光子计算试点应用的意见'];
 const records=titles.flatMap((title,i)=>[article('m'+i,title,'miit'),article('g'+i,title,'gov')]);
 const first=buildKeywordIndex(snapshot(records),{now});const second=buildKeywordIndex(snapshot([...records].reverse()),{now});
 for(const index of [first,second]){const word=find(index,'光子计算');assert.ok(word);assert.equal(word.count,3);assert.equal(word.source_count,2);}
});

test('issuer names in a title prefix do not become content keywords',()=>{
 const data=snapshot([article('a','国家知识产权局关于完善养老服务体系的通知','cnipa'),article('b','住房城乡建设部办公厅关于加强数据安全保障的通知','mohurd')]);
 const index=buildKeywordIndex(data,{now});
 assert.ok(getArticleKeywords(index,'a').some(w=>w.term==='养老服务'));
 assert.ok(!getArticleKeywords(index,'a',20).some(w=>w.term==='知识产权'));
 assert.ok(getArticleKeywords(index,'b').some(w=>w.term==='数据安全'));
 assert.ok(!getArticleKeywords(index,'b',20).some(w=>w.term==='城乡建设'));
});
