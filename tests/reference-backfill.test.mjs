import test from 'node:test';
import assert from 'node:assert/strict';
import {extractArchive,emptyArchives,recordArchive} from '../lib/archive.mjs';
import {emptySnapshot} from '../lib/dataset.mjs';
const mod=await import('../lib/reference-backfill.mjs').catch(()=>({}));
const now=new Date('2026-10-30T00:00:00Z'),parentTitle='国务院关于推进人工智能产业发展的意见';
const child={id:'child',url:'https://www.jiangsu.gov.cn/art/child.html',source_id:'jiangsu',title:'江苏省工业和信息化厅关于推进人工智能的实施方案',stage:'规划部署',category:'工业与科技',published_at:'2026-10-20',collected_at:now.toISOString(),excerpt:'',document_no:null};
const parentHtml=`<html><head><meta name="ArticleTitle" content="${parentTitle}"><meta name="PubDate" content="2025-08-21"></head><body><article><p>${parentTitle}</p><p>国发〔2025〕11号</p><p>${'为推进人工智能产业发展，制定如下政策措施。'.repeat(15)}</p></article></body></html>`;
test('extracts direct body citations and ignores bibliography and nested inner titles',()=>{
 assert.equal(typeof mod.policyReferences,'function');
 const refs=mod.policyReferences({paragraphs:[`根据《${parentTitle}》（国发〔2025〕11号），制定本方案。`,`参考文献`,`根据《其他产业工作实施方案》推进。`]});
 assert.equal(refs.length,1);assert.equal(refs[0].title,parentTitle);assert.equal(refs[0].document_no,'国发〔2025〕11号');
 const nested=mod.policyReferences({paragraphs:[`根据《江苏省关于贯彻落实〈${parentTitle}〉的实施方案》实施。`]});
 assert.equal(nested.length,1);assert(nested[0].title.startsWith('江苏省'));assert.notEqual(nested[0].title,parentTitle);
});
test('official index lookup verifies fetched title and number before adding a missing parent and persists cooldown',async()=>{
 assert.equal(typeof mod.backfillReferences,'function');
 const c=await recordArchive(emptyArchives(),child,extractArchive(`<article><p>根据《${parentTitle}》（国发〔2025〕11号），制定本方案。</p><p>${'具体实施措施。'.repeat(30)}</p></article>`));
 const snapshot={...emptySnapshot(),articles:[child]};let requests=0;
 const fetchPage=async(url)=>{requests++;return{url,html:parentHtml};};
 const index=[{title:parentTitle,url:'https://www.gov.cn/zhengce/parent.htm',published_at:'2025-08-21'}];
 const result=await mod.backfillReferences(snapshot,c,undefined,{now,limit:2,index,fetchPage});
 assert.equal(result.snapshot.articles.length,2);assert.equal(result.added,1);assert.equal(requests,1);
 const parent=result.snapshot.articles.find(a=>a.id!=='child');assert.equal(parent.title,parentTitle);assert.equal(parent.document_no,'国发〔2025〕11号');assert.equal(parent.published_at,'2025-08-21');assert(result.archives.records[parent.id].versions.length);
 const again=await mod.backfillReferences(result.snapshot,result.archives,result.queue,{now,limit:2,index,fetchPage});assert.equal(again.added,0);assert.equal(requests,1);
});
test('wrong candidate, disabled/media URL and network failure never fabricate or remove records',async()=>{
 assert.equal(typeof mod.backfillReferences,'function');
 const c=await recordArchive(emptyArchives(),child,extractArchive(`<article><p>根据《${parentTitle}》（国发〔2025〕11号），制定本方案。</p><p>${'具体实施措施。'.repeat(30)}</p></article>`));
 const snapshot={...emptySnapshot(),articles:[child]};let requests=0;
 const index=[{title:parentTitle,url:'https://evil.example/parent'},{title:parentTitle,url:'https://www.news.cn/policy.html'},{title:parentTitle,url:'https://www.gov.cn/zhengce/wrong.htm'}];
 const result=await mod.backfillReferences(snapshot,c,undefined,{now,limit:1,index,fetchPage:async url=>{requests++;return{url,html:parentHtml.replaceAll(parentTitle,'国务院关于其他事项的通知')};}});
 assert.equal(requests,1);assert.equal(result.added,0);assert.deepEqual(result.snapshot,snapshot);
 assert.equal(Object.values(result.queue.records)[0].status,'unresolved');
 await mod.backfillReferences(snapshot,c,result.queue,{now,limit:1,index,fetchPage:async()=>{throw Error('must not retry within cooldown');}});
 assert.equal(requests,1);
});
test('ambiguous same-title editions remain unresolved without guessing the first official result',async()=>{
 const catalog=await recordArchive(emptyArchives(),child,extractArchive(`<article><p>根据《${parentTitle}》，制定实施方案。</p><p>${'实施工作。'.repeat(60)}</p></article>`));
 let requests=0;
 const result=await mod.backfillReferences({...emptySnapshot(),articles:[child]},catalog,undefined,{
  now,index:[{title:parentTitle,url:'https://www.gov.cn/2024/a.htm'},{title:parentTitle,url:'https://www.gov.cn/2025/b.htm'}],
  fetchPage:async url=>{requests++;return {url,html:parentHtml};},
 });
 assert.equal(requests,0);assert.equal(result.added,0);
 assert.match(Object.values(result.queue.records)[0].message,/同名|版本|不唯一/);
});
test('existing parent without body is fetched and recoverable references prefer older checked tasks',async()=>{
 const parent={...child,id:'parent',source_id:'gov',url:'https://www.gov.cn/parent.htm',title:parentTitle,document_no:'国发〔2025〕11号'};
 const catalog=await recordArchive(emptyArchives(),child,extractArchive(`<article><p>根据《${parentTitle}》（国发〔2025〕11号），制定实施方案。</p><p>${'实施工作。'.repeat(60)}</p></article>`));
 const result=await mod.backfillReferences({...emptySnapshot(),articles:[parent,child]},catalog,undefined,{now,index:[],fetchPage:async url=>({url,html:parentHtml})});
 assert.equal(result.added,0);assert.equal(result.archives.records.parent.versions.length,1);
});
test('short verified laws insert safely and a self citation never resolves as an upstream parent',async()=>{
 const short='公平竞争审查条例';
 const catalog=await recordArchive(emptyArchives(),child,extractArchive(`<article><p>根据《${short}》，制定本方案。</p><p>${'实施工作。'.repeat(60)}</p></article>`));
 const html=`<meta name="ArticleTitle" content="${short}"><article><p>${short}</p><p>${'执行本条例规定的事项。'.repeat(30)}</p></article>`;
 const result=await mod.backfillReferences({...emptySnapshot(),articles:[child]},catalog,undefined,{now,index:[{title:short,url:'https://www.gov.cn/law.htm'}],fetchPage:async url=>({url,html})});
 assert.equal(result.added,1);
 const selfCatalog=await recordArchive(emptyArchives(),child,extractArchive(`<article><p>根据《${child.title}》，实施相关要求。</p><p>${'实施工作。'.repeat(60)}</p></article>`));
 const self=await mod.backfillReferences({...emptySnapshot(),articles:[child]},selfCatalog,undefined,{now,index:[],fetchPage:async url=>({url,html:`<meta name="ArticleTitle" content="${child.title}"><article><p>${child.title}</p><p>${'实施工作。'.repeat(60)}</p></article>`})});
 assert.equal(Object.values(self.queue.records)[0].status,'unresolved');
});
test('an explicit official link takes precedence over an already archived same-title edition',async()=>{
 const old={...child,id:'old',source_id:'gov',title:parentTitle,url:'https://www.gov.cn/2024/old.htm',document_no:'国发〔2024〕11号'};
 let catalog=await recordArchive(emptyArchives(),child,extractArchive(`<article><p>根据《${parentTitle}》，制定本方案。</p><p>${'实施工作。'.repeat(60)}</p></article>`));
 catalog=await recordArchive(catalog,old,extractArchive(parentHtml.replaceAll('2025','2024')));
 catalog.records.child.reference_links=[{title:parentTitle,url:'https://www.gov.cn/2025/new.htm'}];
 let requests=0;
 const result=await mod.backfillReferences({...emptySnapshot(),articles:[old,child]},catalog,undefined,{now,index:[],fetchPage:async url=>{requests++;return {url,html:parentHtml};}});
 assert.equal(requests,1);assert.equal(result.added,1);
 assert.notEqual(Object.values(result.queue.records)[0].resolved_id,'old');
 const stale=structuredClone(result.queue);const key=Object.keys(stale.records)[0];stale.records[key].resolved_id='old';
 const retried=await mod.backfillReferences({...emptySnapshot(),articles:[old,child]},catalog,stale,{now,index:[],fetchPage:async url=>{requests++;return {url,html:parentHtml};}});
 assert.equal(requests,2);assert.notEqual(retried.queue.records[key].resolved_id,'old');
});
