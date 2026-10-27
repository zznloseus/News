import test from 'node:test';
import assert from 'node:assert/strict';
import { parseListing, allowedUrl, detectStage, extractDate, fetchPage,crawlSource,extractDocumentNo } from '../lib/crawler.mjs';

const source={id:'miit',name:'工业和信息化部',url:'https://www.miit.gov.cn/',hosts:['miit.gov.cn'],category:'工业与科技'};
test('does not confuse a referenced law number with the document number',()=>{assert.equal(extractDocumentNo('<p>根据《办法》（国知办发保字〔2021〕4号），开展工作。</p>'),null);assert.equal(extractDocumentNo('<div>发文字号：工信部联规〔2026〕12号</div>'),'工信部联规〔2026〕12号');});
test('extracts unique dated article links and title attributes, omitting navigation',()=>{
 const html='<a href="/zwgk/">政务公开</a><li><a title="关于开展智能制造试点工作的通知" href="/zwgk/art/2026/a.html">关于开展智能…</a><span>2026-10-26</span></li><li><a href="/zwgk/art/2026/a.html">关于开展智能制造试点工作的通知</a>2026-10-26</li>';
 const rows=parseListing(html,'https://www.miit.gov.cn/',source);
 assert.equal(rows.length,1);assert.equal(rows[0].title,'关于开展智能制造试点工作的通知');assert.equal(rows[0].published_at,'2026-10-26');
});
test('does not turn collection time into a fabricated publication date',()=>{
 const rows=parseListing('<a href="/art/a.html">关于推动产业发展有关工作的通知</a>','https://www.miit.gov.cn/',source);
 assert.equal(rows[0].published_at,null);
});
test('restricts collection to configured public hosts, rejects private URLs',()=>{
 assert.equal(allowedUrl('https://wap.miit.gov.cn/a.html',source),true);
 for(const u of ['http://127.0.0.1/a','https://miit.gov.cn.evil.com/a','https://evil.com/a','file:///etc/passwd','https://user:pass@miit.gov.cn/a'])assert.equal(allowedUrl(u,source),false);
});
test('recognizes draft status before generic notice status',()=>{assert.equal(detectStage('关于征求产业发展规划（征求意见稿）意见的通知'),'征求意见');});
test('validates calendar dates and permits missing dates',()=>{assert.equal(extractDate('2026年10月7日'),'2026-10-07');assert.equal(extractDate('2026-02-31'),null);assert.equal(extractDate('无日期'),null);});
test('recognizes compact dates in official article URLs',()=>{assert.equal(extractDate('https://www.news.cn/20261027/a.html'),'2026-10-27');});
test('separates project procurement from policy announcements',()=>{assert.equal(detectStage('某学校设备采购招标公告'),'项目采购');});
test('does not index unresolved dynamic templates or navigation as articles',()=>{
 const html='<a href="/view/pages/detail.html?docId={{x.id}}">{{ x.docSubtitle | trimHtml }}</a><a href="/gb/search/organization.html">ISO标准化组织国内对口单位查询</a>';
 assert.equal(parseListing(html,source.url,source).length,0);
});
test('parses regulator public JSON records with their real original URLs',()=>{
 const data=JSON.stringify({rptCode:200,data:[{docId:123,itemId:861,docTitle:'关于促进保险业高质量发展的指导意见',publishDate:'2026-10-26 12:00:00'}]});
 const s={...source,id:'nfra',url:'https://www.nfra.gov.cn/',hosts:['nfra.gov.cn']};const rows=parseListing(data,s.url,s);assert.equal(rows[0]?.title,'关于促进保险业高质量发展的指导意见');assert.equal(rows[0]?.published_at,'2026-10-26');assert.match(rows[0]?.url,/docId=123&itemId=861/);
});
test('respects even a short robots file disallowing collection',async()=>{
 const previous=globalThis.fetch;let pages=0;globalThis.fetch=async(url)=>{if(String(url).endsWith('robots.txt'))return new Response('User-agent: *\nDisallow: /',{headers:{'content-type':'text/plain'}});pages++;return new Response('x'.repeat(200),{headers:{'content-type':'text/html'}});};
 try{const result=await crawlSource({...source,feeds:[source.url]},{details:false});assert.equal(pages,0);assert.equal(result.status,'error');assert.match(result.message,/robots/);}finally{globalThis.fetch=previous;}
});
test('rejects anti-bot documents even with an HTTP 200 response',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=async()=>new Response('<html>访问验证 captcha</html>',{status:200,headers:{'content-type':'text/html'}});
 try{await assert.rejects(()=>fetchPage('https://www.miit.gov.cn/',source),/验证|限制/);}finally{globalThis.fetch=previous;}
});
test('follows safe HTML redirects used by official homepages',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=async(url)=>new Response(String(url).endsWith('/index.html')?'<html>'+('文章内容'.repeat(40))+'</html>':'<meta http-equiv="refresh" content="0;url=./index.html">',{headers:{'content-type':'text/html'}});
 try{const result=await fetchPage(source.url,source);assert.equal(result.url,'https://www.miit.gov.cn/index.html');}finally{globalThis.fetch=previous;}
});
test('a collection deadline aborts outstanding network requests',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=async(_url,{signal})=>new Promise((resolve,reject)=>{if(signal.aborted)return reject(signal.reason);const timer=setTimeout(()=>resolve(new Response('网页内容'.repeat(80),{headers:{'content-type':'text/html'}})),100);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason);},{once:true});});
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(new Error('collection deadline')),20);
 try{await assert.rejects(()=>fetchPage(source.url,source,1000,controller.signal),/collection deadline/);}finally{clearTimeout(timer);globalThis.fetch=previous;}
});
