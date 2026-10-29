import test from 'node:test';
import assert from 'node:assert/strict';
import * as archive from '../lib/archive.mjs';
import * as library from '../lib/library.mjs';
import {buildRelations} from '../lib/relations.mjs';
import {SOURCE_MAP,ENABLED_SOURCES,isMediaSource} from '../lib/sources.mjs';
import {parseListing,robotsAllowed,robotsDelay,crawlSource,detectStage} from '../lib/crawler.mjs';
import {collectSources} from '../lib/collector.mjs';
import {openPrivateLibrary} from '../lib/private-library.mjs';

const now='2026-10-29T00:00:00.000Z';
const article=(id,source='gov',extra={})=>({id,source_id:source,url:`https://${SOURCE_MAP.get(source).hosts[0]}/art/${id}.html`,title:'关于加快智能制造产业发展的指导意见',stage:'政策发布',category:'工业与科技',published_at:'2026-10-28',collected_at:now,excerpt:'',document_no:null,...extra});
const body='为推动产业高质量发展，现制定以下措施。'.repeat(20);

test('unchanged text preserves latest completeness through private copy, backup and failed refresh',async()=>{
 const a=article('completeness');let catalog=archive.emptyArchives();
 const complete=archive.extractArchive(`<article><p>${body}</p></article>`);
 const partial=archive.extractArchive(`<article><p>${body}</p></article><div class="pagination"><a href="page2.html">下一页</a></div>`);
 assert.equal(complete.text,partial.text);assert.equal(partial.status,'partial');
 catalog=await archive.recordArchive(catalog,a,complete,{capturedAt:'2026-10-27T00:00:00Z'});
 catalog=await archive.recordArchive(catalog,a,partial,{capturedAt:'2026-10-28T00:00:00Z'});
 assert.equal(catalog.records[a.id].versions.length,1);
 assert.equal(archive.latestArchiveVersion(catalog.records[a.id]).status,'partial');
 const saved=library.saveBookmark(library.emptyLibrary(),a,catalog.records[a.id]);
 assert.equal(archive.latestArchiveVersion(library.parseLibraryBackup(library.exportLibrary(saved)).bookmarks[0]).status,'partial');
 catalog=await archive.recordArchive(catalog,a,complete,{capturedAt:'2026-10-29T00:00:00Z'});
 const updated=library.saveBookmark(saved,a,catalog.records[a.id]);
 assert.equal(archive.latestArchiveVersion(updated.bookmarks[0]).status,'text');
 catalog=await archive.recordArchive(catalog,a,{status:'unavailable',text:'',paragraphs:[],message:'HTTP 404'},{capturedAt:'2026-10-30T00:00:00Z'});
 assert.equal(archive.latestArchiveVersion(catalog.records[a.id]).status,'text');
});

test('source identities retain disabled history while excluding automatic collection',()=>{
 assert.equal(SOURCE_MAP.get('flk').enabled,false);
 assert.ok(!ENABLED_SOURCES.some(s=>s.id==='flk'));
 for(const id of ['people','gmw','thepaper','nfzm','bjnews','caixin','ifeng']){assert.ok(SOURCE_MAP.get(id).feeds.length);assert.ok(isMediaSource(id));}
 assert.equal(SOURCE_MAP.get('caixin').access,'authorization-required');
});

test('new media index paths accept policy metadata only and robots honor query/path and named groups',()=>{
 for(const [source,url] of [['nfzm','https://www.infzm.com/contents/123456'],['thepaper','https://www.thepaper.cn/newsDetail_forward_123456'],['ifeng','https://news.ifeng.com/c/abcdef123']]){
  const s=SOURCE_MAP.get(source),rows=parseListing(`<a href="${url}">国务院关于推进产业高质量发展的指导意见</a><a href="${url}2">某某演员结婚的热门娱乐消息现场</a>`,s.url,s);assert.equal(rows.length,1);assert.equal(rows[0].url,url);
 }
 assert.equal(robotsAllowed('User-agent: *\nDisallow: /content/\nAllow: /content/public/', 'https://politics.gmw.cn/content/private/a.htm'),false);
 assert.equal(robotsAllowed('User-agent: OtherBot\nDisallow: /\nUser-agent: *\nAllow: /','https://www.people.com.cn/'),true);
 assert.equal(robotsDelay('User-agent: *\nCrawl-delay: 120'),120000);
});

test('disabled sources cannot be collected even when explicitly selected',async()=>{
 let called=false;const results=await collectSources({sources:[SOURCE_MAP.get('flk'),SOURCE_MAP.get('caixin')],crawl:async()=>{called=true;}});assert.equal(called,false);assert.equal(results.length,0);
});

test('archive extraction keeps nested main paragraphs, removes navigation and flags incomplete bodies',()=>{
 const extracted=archive.extractArchive(`<nav>首页 导航</nav><div id="UCAP-CONTENT"><p>第一段${body}</p><div><p>第二段正文</p></div><script>恶意代码</script><p>第三段正文</p></div><footer>网站地图</footer>`);
 assert.equal(extracted.status,'text');assert.equal(extracted.paragraphs.length,3);assert.match(extracted.text,/第三段正文/);assert.doesNotMatch(extracted.text,/导航|恶意代码|网站地图/);
 assert.equal(archive.extractArchive(`<div class="TRS_Editor"><p>${body}（未完待续）</p></div>`).status,'partial');
 assert.equal(archive.extractArchive(`<meta name="description" content="${body}"><div>摘要${body}</div>`).status,'unavailable');
 assert.equal(archive.extractArchive('<article>请完成安全验证 captcha</article>').status,'unavailable');
 for(const selector of ['class="contText"','id="con_con"'])assert.equal(archive.extractArchive(`<div ${selector}><p>${body}</p></div><div class="related">相关链接</div>`).text,body);
});

test('verified local issuer titles allow province to city citations without deriving issuer from publisher',async()=>{
 const root=article('province','sichuan',{title:'四川省人民政府关于加快数字经济产业发展的实施意见'}),child=article('city','sichuan',{title:'成都市人民政府关于促进数字经济产业发展的实施意见'});
 let catalog=archive.emptyArchives();catalog=await archive.recordArchive(catalog,child,archive.extractArchive(`<article><p>根据《${root.title}》，结合本市实际制定如下实施意见。${body}</p></article>`),{capturedAt:now});
 const relations=buildRelations({articles:[root,child]},null,catalog);assert.deepEqual(relations.edges.map(e=>[e.from,e.to]),[['province','city']]);assert.equal(relations.nodes.find(n=>n.id==='city').issuer,'成都市人民政府');assert.equal(relations.nodes.find(n=>n.id==='city').region,'成都市');
 assert.equal(relations.nodes.find(n=>n.id==='city').issuing_level,'city');
});

test('archive versions deduplicate, retain history on refresh errors and rotate untried candidates',async()=>{
 const a=article('one');let catalog=archive.emptyArchives();
 catalog=await archive.recordArchive(catalog,a,archive.extractArchive(`<article><p>${body}</p></article>`),{capturedAt:now});
 const version=catalog.records.one.versions[0];assert.equal(version.content_hash.length,64);
 catalog=await archive.recordArchive(catalog,a,archive.extractArchive(`<article><p>${body}</p></article>`),{capturedAt:now});assert.equal(catalog.records.one.versions.length,1);
 catalog=await archive.recordArchive(catalog,a,{status:'unavailable',message:'HTTP 403',text:'',paragraphs:[]},{capturedAt:now});assert.equal(catalog.records.one.versions[0].id,version.id);assert.equal(catalog.records.one.last_attempt.status,'unavailable');
 const candidates=archive.selectArchiveCandidates({articles:[a,article('two'),article('media','xinhua')]},catalog,{limit:1});assert.equal(candidates[0].id,'two');
 assert.throws(()=>archive.validateArchives({...catalog,records:{one:{...catalog.records.one,source_url:'javascript:alert(1)'}}}));
});

test('relations require eligible body citations and exclude reposts, media, ambiguous numbers and bibliography',async()=>{
 const root=article('root','gov',{document_no:'国发〔2026〕12号'}), child=article('child','beijing',{title:'北京市关于推进智能制造重点任务的实施意见'}),media=article('media','xinhua',{title:'贯彻中央智能制造政策重要部署情况'}),repost=article('repost','shanghai',{title:root.title}), news=article('news','tianjin',{title:'天津召开会议学习智能制造指导意见',stage:'工作动态'}),bibliography=article('bibliography','hebei',{title:'河北省产业高质量发展实施意见'});
 let catalog=archive.emptyArchives();for(const a of [child,media,repost,news,bibliography])catalog=await archive.recordArchive(catalog,a,archive.extractArchive(`<article><p>${a===bibliography?'参考文献：':'根据'}《${root.title}》（国发〔2026〕12号），结合本地实际落实如下。${body}</p></article>`),{capturedAt:now});
 const result=buildRelations({articles:[root,child,media,repost,news,bibliography]},null,catalog);
 assert.deepEqual(result.edges.map(e=>[e.from,e.to]),[['root','child']]);assert.ok(result.edges[0].evidence.excerpt.includes(root.title));assert.ok(result.edges[0].evidence.version_id);assert.equal(result.nodes.find(n=>n.id==='child').issuer,null);assert.equal(result.nodes.find(n=>n.id==='child').region,null);
 const second=article('ambiguous','miit',{title:'另一份智能制造产业发展实施通知',document_no:root.document_no});
 const numberOnly=await archive.recordArchive(archive.emptyArchives(),child,archive.extractArchive(`<article><p>根据国发〔2026〕12号，结合实际实施。${body}</p></article>`),{capturedAt:now});
 assert.equal(buildRelations({articles:[root,second,child]},null,numberOnly).edges.length,0);
});

test('backup validation rejects unsafe URLs, corrupt references, and conflicting IDs without losing bookmarks',()=>{
 const a=article('one');const migrated=library.migrateLegacy([a]);assert.equal(migrated.bookmarks.length,1);
 const backup=library.exportLibrary(migrated);assert.equal(library.parseLibraryBackup(backup).bookmarks[0].article.id,a.id);
 const unsafe=JSON.parse(backup);unsafe.bookmarks[0].article.url='javascript:alert(1)';assert.throws(()=>library.parseLibraryBackup(JSON.stringify(unsafe)));
 const corrupt={...migrated,notes:[{id:'n',article_id:'missing',version_id:null,quote:'',text:'笔记',created_at:now,updated_at:now,deleted_at:null}]};assert.throws(()=>library.validateLibrary(corrupt));
 const merged=library.mergeLibraries(migrated,library.migrateLegacy([article('two')]));assert.equal(merged.bookmarks.length,2);
 const collision=structuredClone(migrated);collision.bookmarks[0].article.url+='?other';assert.throws(()=>library.mergeLibraries(migrated,collision),/冲突/);
 assert.throws(()=>library.parseLibraryBackup('{broken'));
});

test('private copies survive public disappearance and note deletion is reversible',async()=>{
 const a=article('one');const catalog=await archive.recordArchive(archive.emptyArchives(),a,archive.extractArchive(`<article><p>${body}</p></article>`),{capturedAt:now});
 let state=library.saveBookmark(library.emptyLibrary(),a,catalog.records.one,{now});
 const version=state.bookmarks[0].versions[0];state=library.putNote(state,{id:'note-one',article_id:a.id,version_id:version.id,quote:version.paragraphs[0],text:'自己的判断'},{now});
 state=library.deleteNote(state,'note-one',{now});assert.ok(state.notes[0].deleted_at);state=library.restoreNote(state,'note-one',{now});assert.equal(state.notes[0].deleted_at,null);
 assert.equal(library.parseLibraryBackup(library.exportLibrary(state)).bookmarks[0].versions[0].text,body);
 assert.throws(()=>library.putNote(state,{id:'bad',article_id:a.id,version_id:version.id,quote:'不存在的段落',text:'错误引用'},{now}));
});

test('real stage classification cannot make meeting reporting a policy graph participant',async()=>{
 const root=article('root','gov',{title:'国务院关于加快智能制造产业发展的指导意见'}),title='我市召开会议传达贯彻国务院智能制造指导意见',news=article('meeting','beijing',{title,stage:detectStage(title)});
 assert.equal(news.stage,'规划部署');let catalog=await archive.recordArchive(archive.emptyArchives(),news,archive.extractArchive(`<article><p>昨日会议强调，要贯彻落实《${root.title}》。有关部门负责人介绍了工作情况。${body}</p></article>`),{capturedAt:now});
 assert.equal(buildRelations({articles:[root,news]},null,catalog).edges.length,0);assert.equal(archive.eligiblePolicy(news),false);
 const misleading=article('transcript','beijing',{title:'关于开展智能制造产业发展的实施意见'});catalog=await archive.recordArchive(catalog,misleading,archive.extractArchive(`<article><p>主持人：今天举行新闻发布会。根据《${root.title}》实施产业政策。</p><p>记者：请问如何落实？${body}</p></article>`),{capturedAt:now});
 assert.equal(buildRelations({articles:[root,misleading]},null,catalog).edges.length,0);
});

test('pagination outside a body is partial and explicit summaries are never complete archives',()=>{
 assert.equal(archive.extractArchive(`<article><p>${body}</p></article><div class="pagination"><a href="page2.html">下一页</a></div>`).status,'partial');
 for(const main of [`<article class="summary"><h2>政策摘要</h2><p>${body}</p></article>`,`<article><h2>政策摘要</h2><p>${body}</p></article>`])assert.equal(archive.extractArchive(main).status,'unavailable');
 assert.equal(archive.extractArchive(`<article><p>为落实政策，附件包括实施清单；本文件要求各单位提交内容摘要。${body}</p></article>`).status,'text');
 const clean=archive.extractArchive(`<article><p>${body}</p><p>扫一扫在手机打开当前页</p><p>打印本页 关闭窗口</p></article>`);assert.equal(clean.text,body);
});

test('A to B to A refresh selects the reverted version and failure retains that current identity',async()=>{
 const a=article('rollback');let catalog=archive.emptyArchives();
 for(const [text,time] of [[body,now],[body+'新增条款','2026-10-30T00:00:00Z'],[body,'2026-10-31T00:00:00Z']])catalog=await archive.recordArchive(catalog,a,archive.extractArchive(`<article><p>${text}</p></article>`),{capturedAt:time});
 assert.equal(catalog.records.rollback.versions.length,2);assert.equal(catalog.records.rollback.latest_version_id,catalog.records.rollback.versions[0].id);assert.equal(catalog.records.rollback.latest_captured_at,'2026-10-31T00:00:00Z');
 catalog=await archive.recordArchive(catalog,a,{status:'unavailable',message:'HTTP403',text:'',paragraphs:[]},{capturedAt:'2026-11-01T00:00:00Z'});assert.equal(archive.latestArchiveVersion(catalog.records.rollback).text,body);
 const state=library.saveBookmark(library.emptyLibrary(),a,catalog.records.rollback,{now});assert.equal(archive.latestArchiveVersion(state.bookmarks[0]).text,body);
});

test('nested quoted policy titles do not create a direct citation to an absent intermediate document',async()=>{
 const root=article('outline','gov',{title:'教育强国建设规划纲要（2024—2035年）'}),child=article('education','beijing',{title:'北京市关于加强教育服务保障的实施意见'});
 const catalog=await archive.recordArchive(archive.emptyArchives(),child,archive.extractArchive(`<article><p>根据《内蒙古自治区关于贯彻落实〈${root.title}〉的实施意见》，做好有关工作。${body}</p></article>`),{capturedAt:now});
 assert.equal(buildRelations({articles:[root,child]},null,catalog).edges.length,0);
});

// Minimal event-driven read fixture: state is returned as IndexedDB would return a structured clone.
function storedDatabaseFixture(state){
 let stored=structuredClone(state);const db={close(){},transaction(){let aborted=false;const tx={error:null,abort(){aborted=true;queueMicrotask(()=>tx.onabort?.());},objectStore(){return {get(){const request={};queueMicrotask(()=>{request.result=structuredClone(stored);request.onsuccess?.();queueMicrotask(()=>{if(!aborted)tx.oncomplete?.();});});return request;},put(value){stored=structuredClone(value);}};}};return tx;}};
 return {open(){const request={result:db};queueMicrotask(()=>request.onsuccess?.());return request;}};
}
test('private read and export reject structurally valid hash corruption while raw recovery remains possible',async()=>{
 const a=article('integrity'),catalog=await archive.recordArchive(archive.emptyArchives(),a,archive.extractArchive(`<article><p>${body}</p></article>`),{capturedAt:now});
 const original=library.saveBookmark(library.emptyLibrary(),a,catalog.records.integrity,{now}),corrupt=structuredClone(original);corrupt.legacy_migrated=true;corrupt.bookmarks[0].versions[0].text+='被篡改';corrupt.bookmarks[0].versions[0].paragraphs[0]+='被篡改';
 const store=await openPrivateLibrary({indexedDB:storedDatabaseFixture(corrupt),legacyStorage:{getItem(){return null;}}});
 await assert.rejects(store.read(),/哈希/);await assert.rejects(store.exportBackup(),/哈希/);assert.deepEqual((await store.recoverRaw()).indexeddb,corrupt);store.close();
 assert.throws(()=>library.validateLibrary(corrupt),/哈希/);assert.throws(()=>library.saveBookmark(original,a,{...catalog.records.integrity,versions:corrupt.bookmarks[0].versions}),/哈希/);
});

test('synchronous integrity digest matches WebCrypto across UTF8 and block boundaries',async()=>{
 for(const value of ['', 'abc', '中华人民共和国🌍', 'a'.repeat(55),'b'.repeat(56),'c'.repeat(64),'正文'.repeat(3000)])assert.equal(archive.contentHashSync(value),await archive.contentHash(value));
});
