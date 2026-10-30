import {SOURCES,SOURCE_MAP} from './sources.mjs';
import {allowedUrl,canonicalUrl,cleanText,extractDate} from './crawler.mjs';
import {eligiblePolicy,extractArchive,recordArchive,latestArchiveVersion,contentHash} from './archive.mjs';
import {validateSnapshot} from './dataset.mjs';
import {policyIdentity,higherPolicyLevel} from './policy-identity.mjs';

export const OFFICIAL_POLICY_INDEX='https://www.gov.cn/zhengce/zuixin/ZUIXINZHENGCE.json';
const norm=v=>String(v||'').normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'');
const titleNorm=v=>norm(String(v||'').replace(/^国办(?=关于|印发)/,'国务院办公厅').replace(/^中办国办/,'中共中央办公厅国务院办公厅'));
const noPattern=/[\u4e00-\u9fff]{1,16}[〔\[（]20\d{2}[〕\]）]\s*\d{1,5}\s*号/;
const sameTitle=(a,b)=>titleNorm(a)===titleNorm(b);
export function officialSource(url){
 return SOURCES.filter(s=>s.enabled&&s.access==='public'&&s.archive_eligible&&allowedUrl(url,s))
  .sort((a,b)=>Math.max(...b.hosts.map(h=>h.length))-Math.max(...a.hosts.map(h=>h.length)))[0];
}
export function emptyReferenceQueue(){return {schema_version:1,generated_at:null,records:{}};}
export function validateReferenceQueue(queue){
 if(!queue||queue.schema_version!==1||!queue.records||Array.isArray(queue.records)||typeof queue.records!=='object')throw Error('引用补齐队列结构无效');
 for(const [key,r] of Object.entries(queue.records)){
  if(!/^[a-f0-9]{64}$/.test(key)||!r||typeof r.title!=='string'||r.title.length>300||!['resolved','unresolved','error'].includes(r.status)||!Number.isFinite(Date.parse(r.checked_at))||!Array.isArray(r.citations))throw Error('引用补齐队列记录无效');
 }
 return queue;
}
export function policyReferences(version){
 const refs=[];
 for(const paragraph of version?.paragraphs||[]){
  if(/^\s*(参考文献|参考资料|相关链接|延伸阅读|附件目录)/.test(paragraph))break;
  const stack=[];let start=-1;
  for(let i=0;i<paragraph.length;i++){
   const ch=paragraph[i];
   if(ch==='《'||ch==='〈'){if(!stack.length)start=i;stack.push(ch);}
   else if(ch==='》'||ch==='〉'){
    if(stack.at(-1)!==(ch==='》'?'《':'〈'))continue;
    stack.pop();if(stack.length)continue;
    if(!/(根据|依据|贯彻(?:落实)?|落实|按照|实施|执行|衔接)[^。！？\n]{0,100}$/.test(paragraph.slice(Math.max(0,start-110),start)))continue;
    const title=paragraph.slice(start+1,i).trim();
    if(title.length<8||title.length>280||!/通知|意见|决定|公告|规定|办法|条例|方案|规划|纲要|措施|细则/.test(title))continue;
    // Number must immediately follow THIS outer title; never borrow a different reference's number.
    const tail=paragraph.slice(i+1,i+70),match=tail.match(new RegExp('^[\\s（(]*('+noPattern.source+')'));
    refs.push({title,document_no:match?.[1]||null,excerpt:paragraph.slice(Math.max(0,start-110),i+150)});
   }
  }
 }
 return [...new Map(refs.map(r=>[titleNorm(r.title)+'|'+norm(r.document_no),r])).values()];
}
export function citationLinks(html,base,refs){
 const links=[];
 for(const m of html.matchAll(/<a\b([^>]+)>([\s\S]*?)<\/a>/gi)){
  const href=m[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];if(!href)continue;
  const label=cleanText(m[1].match(/\btitle\s*=\s*["']([^"']+)["']/i)?.[1]||m[2]);
  const ref=refs.find(r=>sameTitle(label,r.title));if(!ref)continue;
  try{const url=canonicalUrl(new URL(href.replace(/&amp;/g,'&'),base).href);if(officialSource(url))links.push({title:ref.title,url});}catch{}
 }
 return [...new Map(links.map(l=>[l.url,l])).values()].slice(0,30);
}
export function parseOfficialIndex(text){
 const json=JSON.parse(text);if(!Array.isArray(json))throw Error('官方政策索引格式变更');
 return json.slice(0,10000).filter(r=>typeof r.TITLE==='string'&&typeof r.URL==='string')
  .map(r=>({title:cleanText(r.TITLE),url:r.URL,published_at:extractDate(r.DOCRELPUBTIME||'')}));
}
function metadata(html,name){
 for(const m of html.matchAll(/<meta\b[^>]*>/gi)){
  const n=m[0].match(/\bname\s*=\s*["']([^"']+)["']/i)?.[1],v=m[0].match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1];
  if(n?.toLowerCase()===name.toLowerCase())return cleanText(v||'');
 }
 return '';
}
function candidateMatches(ref,html,body){
 const titles=[metadata(html,'ArticleTitle'),body.title,cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').split(/_|--/)[0],body.paragraphs.slice(0,3).join('')];
 if(!titles.some(t=>sameTitle(t,ref.title)))return false;
 const number=body.document_no||body.paragraphs.slice(0,8).join('\n').match(noPattern)?.[0];
 return !ref.document_no||!!number&&norm(number)===norm(ref.document_no);
}
export async function backfillReferences(snapshot,archives,queue=emptyReferenceQueue(),{
 now=new Date(),limit=4,index=null,fetchPage,loadIndex=null,deadlineMs=90000,onResult=()=>{}
}={}){
 validateSnapshot(snapshot);validateReferenceQueue(queue);
 if(!fetchPage)throw Error('需要受限制的官方网页读取器');
 const budget=Math.max(0,Math.min(20,Math.floor(limit))),start=Date.now(),records={...queue.records};
 let current=snapshot,catalog=archives,added=0,processed=0,requests=0,indexError='';
 const references=new Map();
 for(const article of snapshot.articles){
  const record=archives.records[article.id],version=latestArchiveVersion(record);
  if(!version||!eligiblePolicy(article,version))continue;
  for(const ref of policyReferences(version)){
   const key=await contentHash(titleNorm(ref.title)+'|'+norm(ref.document_no));
   if(!references.has(key))references.set(key,{...ref,citations:[],links:[]});
   const row=references.get(key);row.citations.push({article_id:article.id,version_id:version.id,source_url:article.url,excerpt:ref.excerpt});
   row.links.push(...(record.reference_links||[]).filter(l=>sameTitle(l.title,ref.title)));
  }
 }
 const work=[...references.entries()].sort(([a],[b])=>(records[a]?.checked_at||'').localeCompare(records[b]?.checked_at||'')||a.localeCompare(b));
 for(const [key,ref] of work){
  if(processed>=budget||Date.now()-start>=deadlineMs)break;
  const previous=records[key];
  const resolvedArticle=previous?.resolved_id&&current.articles.find(a=>a.id===previous.resolved_id);
  const stillParent=resolvedArticle&&ref.citations.some(c=>{
   const child=current.articles.find(a=>a.id===c.article_id);
   return child&&child.id!==resolvedArticle.id&&higherPolicyLevel(policyIdentity(resolvedArticle,latestArchiveVersion(catalog.records[resolvedArticle.id])),policyIdentity(child,latestArchiveVersion(catalog.records[child.id])))!==false;
  });
  const linksAgree=!ref.links.length||resolvedArticle&&ref.links.every(l=>canonicalUrl(l.url)===canonicalUrl(resolvedArticle.url));
  const canReuse=previous?.status!=='resolved'||stillParent&&linksAgree&&latestArchiveVersion(catalog.records[resolvedArticle.id]);
  if(previous&&canReuse&&Date.parse(previous.checked_at)>now.getTime()-86400000*(previous.status==='resolved'?30:1))continue;
  processed++;
  let status='unresolved',message='未找到可验证的官方上位文件',resolved_id=null;
  const possibleParent=(article,version)=>ref.citations.some(c=>{
   const child=current.articles.find(a=>a.id===c.article_id);
   return child&&child.id!==article.id&&higherPolicyLevel(policyIdentity(article,version),policyIdentity(child,latestArchiveVersion(catalog.records[child.id])))!==false;
  });
  // Exact local title/number identity avoids request duplication. Number ambiguity never chooses arbitrarily.
  const existing=current.articles.filter(a=>{
   const v=latestArchiveVersion(catalog.records[a.id]);return officialSource(a.url)&&eligiblePolicy(a,v)&&
    (sameTitle(a.title,ref.title)||sameTitle(v?.title,ref.title))&&
    (!ref.document_no||norm(v?.document_no||a.document_no)===norm(ref.document_no));
  });
  const directLinks=[...new Map(ref.links.filter(l=>officialSource(l.url)).map(l=>[canonicalUrl(l.url),l])).values()];
  const agreesWithLink=existing.length===1&&(!directLinks.length||directLinks.length===1&&canonicalUrl(directLinks[0].url)===canonicalUrl(existing[0].url));
  if(agreesWithLink&&latestArchiveVersion(catalog.records[existing[0].id])&&possibleParent(existing[0],latestArchiveVersion(catalog.records[existing[0].id]))){
   status='resolved';message='上位文件已收录并已留存';resolved_id=existing[0].id;
  }else{
   const candidates=[...existing.map(a=>({title:a.title,url:a.url,published_at:a.published_at})),...ref.links];
   if(index===null&&loadIndex){try{index=await loadIndex();}catch(error){index=[];indexError=String(error.message||error);}}
   if(Array.isArray(index))candidates.push(...index.filter(c=>sameTitle(c.title,ref.title)));
   const uniqueCandidates=[...new Map((directLinks.length===1?directLinks:candidates).filter(l=>officialSource(l.url)).map(l=>[canonicalUrl(l.url),l])).values()];
   // A missing document number or an ambiguous edition is never resolved by result order.
   // A uniquely cited official hyperlink is a valid identity discriminator, still verified from its body below.
   let failure=uniqueCandidates.length>1?'同名官方候选不唯一，版本待核实':'';
   const urls=new Set();
   for(const candidate of uniqueCandidates.length>1?[]:uniqueCandidates){
    if(urls.size>=3||Date.now()-start>=deadlineMs)break;
    const source=officialSource(candidate.url);if(!source)continue;
    const url=canonicalUrl(candidate.url);if(urls.has(url))continue;urls.add(url);requests++;
    try{
     const page=await fetchPage(url,source,{timeout:10000,signal:AbortSignal.timeout(Math.max(1,Math.min(12000,deadlineMs-(Date.now()-start))))});
     if(!officialSource(page.url)||!allowedUrl(page.url,source))throw Error('候选跳转到非允许的官方来源');
     const body=extractArchive(page.html);
     if(!body.text||!candidateMatches(ref,page.html,body)){failure='候选正文标题或文号未通过核验';continue;}
     const finalUrl=canonicalUrl(page.url),old=current.articles.find(a=>canonicalUrl(a.url)===finalUrl);
     const id=old?.id||await contentHash(finalUrl);
     const date=extractDate(metadata(page.html,'PubDate')||metadata(page.html,'publishdate'))||candidate.published_at||null;
     const article=old||{id,url:finalUrl,title:ref.title,source_id:source.id,category:source.category,stage:/方案|规划|意见/.test(ref.title)?'规划部署':'政策发布',published_at:date&&date<=now.toISOString().slice(0,10)?date:null,collected_at:now.toISOString(),last_seen_at:now.toISOString(),excerpt:'',document_no:body.document_no||ref.document_no};
     if(!eligiblePolicy(article,body))throw Error('候选页面不是可用政策文件');
     if(!possibleParent(article,body))throw Error('候选不是引用文件的上位层级');
     // Validate a candidate before changing any accumulated snapshot or catalog.
     if(!old)validateSnapshot({...current,articles:[...current.articles,article]});
     catalog=await recordArchive(catalog,article,body,{capturedAt:now.toISOString()});
     catalog.records[id].reference_links=citationLinks(page.html,finalUrl,policyReferences(body));
     if(!old){current={...current,articles:[...current.articles,article].sort((a,b)=>a.id.localeCompare(b.id))};added++;}
     status='resolved';resolved_id=id;message='官方正文标题及引用文号已核验';break;
    }catch(error){failure=String(error.message||error);}
   }
   if(!resolved_id){message=failure||indexError||message;if(indexError&&!candidates.length)status='error';}
  }
  records[key]={title:ref.title,document_no:ref.document_no,citations:ref.citations.slice(0,20),status,message:message.slice(0,500),resolved_id,checked_at:now.toISOString()};
  onResult({title:ref.title,status,message:records[key].message});
 }
 return {snapshot:validateSnapshot(current),archives:catalog,queue:{schema_version:1,generated_at:now.toISOString(),records},added,processed,requests,pending:references.size};
}
