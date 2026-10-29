import {SOURCE_MAP,matchesSourceTypes} from './sources.mjs';
import {KEYWORD_GROUPS,SEED_KEYWORDS,DISCOVERY_STOPS,DISCOVERY_NOUN_ENDINGS} from './keyword-config.mjs';

export {KEYWORD_GROUPS};
export const KEYWORD_ENGINE_VERSION=4;
const groupIds=new Set(KEYWORD_GROUPS.map(g=>g.id));
const ignoredStages=new Set(['工作动态','项目采购']);
const normalize=value=>String(value||'').normalize('NFKC').replace(/[‐‑‒–—−]/g,'-').toLowerCase();
const safeTime=value=>Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const DAY=86400000;
export function chinaDate(now=new Date()){return new Date(new Date(now).getTime()+8*3600000).toISOString().slice(0,10);}
export function validDay(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?value:null;
}
export function keywordWindow(days=30,now=new Date()){
 const to=chinaDate(now);return {from:new Date(Date.parse(to+'T00:00:00Z')-(days-1)*DAY).toISOString().slice(0,10),to};
}
export function snapshotFingerprint(snapshot){
 let first=2166136261,second=5381;
 const rows=snapshot.articles.map(a=>[a.id,a.title,a.url,a.published_at,a.source_id,a.stage,a.category,a.collected_at]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
 const text=JSON.stringify([KEYWORD_ENGINE_VERSION,SEED_KEYWORDS,[...DISCOVERY_STOPS],DISCOVERY_NOUN_ENDINGS.source,rows]);
 for(let i=0;i<text.length;i++){const n=text.charCodeAt(i);first=Math.imul(first^n,16777619);second=Math.imul(second,33)^n;}
 return (first>>>0).toString(16).padStart(8,'0')+(second>>>0).toString(16).padStart(8,'0');
}
function containsAlias(title,alias){
 const needle=normalize(alias);let start=0,index;
 while((index=title.indexOf(needle,start))!==-1){
  const before=title[index-1]||'',after=title[index+needle.length]||'';
  if(!/^[a-z0-9]/.test(needle)||!/[a-z0-9]/.test(before)){
   if(!/[a-z0-9]$/.test(needle)||!/[a-z0-9]/.test(after))return true;
  }
  start=index+needle.length;
 }
 return false;
}
function matchTerms(title,vocabulary){
 const text=normalize(contentTitle(title));
 const matches=vocabulary.filter(w=>[w.term,...(w.aliases||[])].some(alias=>containsAlias(text,alias)));
 return matches.filter(w=>!matches.some(other=>other.term!==w.term&&other.term.length>w.term.length&&normalize(other.term).includes(normalize(w.term))));
}
function documentKey(a){
 const title=normalize(a.title).replace(/^(?:转载|转发)[:：]?/,'').replace(/[\s\p{P}\p{S}]/gu,'');
 const year=validDay(a.published_at)?.slice(0,4)||'';
 return title.length>=10?title+'|'+year:String(a.url||a.id);
}
function groupDocuments(snapshot){
 const grouped=new Map();
 for(const a of snapshot.articles){
  const key=documentKey(a);let d=grouped.get(key);
  if(!d){d={key,title:a.title,published_at:null,first_seen_at:safeTime(a.collected_at),source_ids:[],variants:[],terms:[]};grouped.set(key,d);}
  const date=validDay(a.published_at);if(date&&(!d.published_at||date<d.published_at))d.published_at=date;
  const seen=safeTime(a.collected_at);if(seen&&(!d.first_seen_at||seen<d.first_seen_at))d.first_seen_at=seen;
  if(!d.source_ids.includes(a.source_id))d.source_ids.push(a.source_id);
  d.variants.push({id:a.id,source_id:a.source_id,category:a.category,stage:a.stage});
 }
 return [...grouped.values()];
}
const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('zh-CN',{granularity:'word'}):null;
const institutionNames=[...SOURCE_MAP.values()].map(s=>s.name);
function contentTitle(value){
 const title=String(value||'').normalize('NFKC').trim(),pivot=title.indexOf('关于');
 if(pivot>0&&pivot<100){const prefix=title.slice(0,pivot).replace(/和/g,'');
  if(institutionNames.some(name=>prefix.includes(name.replace(/和/g,'')))||prefix.includes('国务院'))return title.slice(pivot);
 }
 return title;
}
function goodCandidate(term){
 if(DISCOVERY_STOPS.has(term)||term.length<3||term.length>10)return false;
 if(term==='高标准')return false;
 if(/[0-9]/.test(term)&&!/[a-z]/i.test(term))return false;
 if(/^[的及和与等各对在为从把将以向由到于]|[的及和与等]$/.test(term))return false;
 if(/^(?:人员|特色|更高|现代化|个|一项|一批)/.test(term))return false;
 if(/人民政府|委员会|办公厅|办公室|管理局|有限公司|中华人民共和国|新闻发布|记者问|若干措施|实施意见|工作方案|省政府|改革委|自治|负责人|副局长/.test(term))return false;
 if(institutionNames.some(name=>name.includes(term)))return false;
 if(/(?:省|市|县|自治区|大学|研究院|总局|厅|部)$/.test(term))return false;
 if(/^[\p{Script=Han}]+$/u.test(term))return DISCOVERY_NOUN_ENDINGS.test(term);
 return /^[A-Z][A-Z0-9+-]{2,17}$/.test(term);
}
function candidatePhrases(title){
 const result=new Set();let run=[];
 const flush=()=>{
  for(let i=0;i<run.length;i++)for(let n=1;n<=3&&i+n<=run.length;n++){
   if(run[i].length===1&&!['核','云','脑','网','光','新','数','高'].includes(run[i]))continue;
   const term=run.slice(i,i+n).join('');if(goodCandidate(term))result.add(term);
  }
  run=[];
 };
 const text=contentTitle(title);
 const segments=segmenter?segmenter.segment(text):[...text.matchAll(/[\p{Script=Han}]+|[A-Za-z][A-Za-z0-9+-]*/gu)].map(m=>({segment:m[0],isWordLike:true}));
 for(const part of segments){
  if(!part.isWordLike||DISCOVERY_STOPS.has(part.segment)){flush();continue;}
  run.push(part.segment);
 }
 flush();return result;
}
function discover(documents,previousIndex){
 const candidates=new Map();
 for(const [i,d] of documents.entries()){
  if(d.variants.every(a=>ignoredStages.has(a.stage)))continue;
  for(const term of candidatePhrases(d.title)){
   // Keep known terms canonical and avoid promoting incidental extensions of them.
   if(SEED_KEYWORDS.some(w=>[w.term,...w.aliases].some(alias=>normalize(term).includes(normalize(alias))||normalize(alias).includes(normalize(term)))))continue;
   let candidate=candidates.get(term);if(!candidate){candidate={term,docs:new Set(),sources:new Set(),first_seen_at:d.first_seen_at,votes:new Map()};candidates.set(term,candidate);}
   candidate.docs.add(i);for(const source of d.source_ids)candidate.sources.add(source);
   if(d.first_seen_at&&(!candidate.first_seen_at||d.first_seen_at<candidate.first_seen_at))candidate.first_seen_at=d.first_seen_at;
   for(const group of new Set(d.known_terms.map(w=>w.group)))candidate.votes.set(group,(candidate.votes.get(group)||0)+1);
  }
 }
 const supported=[...candidates.values()].filter(c=>c.docs.size>=3&&c.sources.size>=2);
 // If a longer complete phrase always occurs in exactly the same documents, use it.
 const complete=supported.filter(c=>!supported.some(other=>other.term.length>c.term.length&&other.term.includes(c.term)&&other.docs.size===c.docs.size&&[...c.docs].every(i=>other.docs.has(i))));
 const previous=new Map((previousIndex?.keywords||[]).map(w=>[w.term,w]));
 return complete.sort((a,b)=>b.docs.size-a.docs.size||b.term.length-a.term.length||a.term.localeCompare(b.term,'zh-CN')).slice(0,400).map(c=>{
  const votes=[...c.votes].sort((a,b)=>b[1]-a[1]);const sum=votes.reduce((n,v)=>n+v[1],0);
  const hint=/电视|视听|护理|卫生|教育|文化/.test(c.term)?'society':/名城|农田|农村/.test(c.term)?'regional':null;
  const group=hint||(votes[0]&&votes[0][1]>=2&&votes[0][1]/sum>=.6?votes[0][0]:'other');
  return {term:c.term,aliases:[],group,origin:'discovered',first_seen_at:previous.get(c.term)?.first_seen_at||c.first_seen_at,promoted_at:previous.get(c.term)?.promoted_at||null};
 });
}
export function buildKeywordIndex(snapshot,{now=new Date(),previousIndex=null}={}){
 const generated_at=new Date(now).toISOString();const documents=groupDocuments(snapshot);
 for(const d of documents)d.known_terms=matchTerms(d.title,SEED_KEYWORDS);
 const previous=new Map((previousIndex?.engine_version===KEYWORD_ENGINE_VERSION?previousIndex.keywords:[]).map(w=>[w.term,w]));
 const discovered=discover(documents,previousIndex);
 const vocabulary=[...SEED_KEYWORDS.map(w=>({...w,first_seen_at:previous.get(w.term)?.first_seen_at||null,promoted_at:null})),...discovered];
 const used=new Map();const article_terms=Object.create(null),article_documents=Object.create(null);
 for(const d of documents){
  const terms=matchTerms(d.title,vocabulary).sort((a,b)=>(b.term.length-a.term.length)||a.term.localeCompare(b.term,'zh-CN'));
  d.terms=terms.map(w=>w.term);delete d.known_terms;
  for(const term of terms){const old=used.get(term.term);if(!old)used.set(term.term,{...term});const row=used.get(term.term);if(d.first_seen_at&&(!row.first_seen_at||d.first_seen_at<row.first_seen_at))row.first_seen_at=d.first_seen_at;}
  for(const a of d.variants){article_terms[a.id]=d.terms;article_documents[a.id]=d.key;}
 }
 for(const term of used.values()){
  const old=previous.get(term.term);
  if(old){term.first_seen_at=old.first_seen_at||term.first_seen_at;term.promoted_at=old.promoted_at||null;}
  else if(previousIndex&&term.origin==='discovered')term.promoted_at=generated_at;
 }
 // Retain observation history even when a phrase falls out of the current index.
 for(const old of previous.values())if(!used.has(old.term))used.set(old.term,{...old,inactive:true});
 return {schema_version:1,engine_version:KEYWORD_ENGINE_VERSION,generated_at,snapshot_generated_at:snapshot.generated_at,snapshot_fingerprint:snapshotFingerprint(snapshot),article_count:snapshot.articles.length,method:'title-document-frequency',keywords:[...used.values()],documents,article_terms,article_documents};
}
export function isKeywordIndexFor(index,snapshot){
 if(!index||index.schema_version!==1||index.engine_version!==KEYWORD_ENGINE_VERSION||!safeTime(index.generated_at)||!Array.isArray(index.keywords)||!Array.isArray(index.documents)||!index.article_terms||!index.article_documents||index.article_count!==snapshot.articles.length)return false;
 const known=new Set(),articles=new Map(snapshot.articles.map(a=>[a.id,a])),seen=new Set(),documents=new Set();
 for(const w of index.keywords){if(!w||typeof w.term!=='string'||!w.term||w.term.length>40||known.has(w.term)||!groupIds.has(w.group)||!['curated','discovered'].includes(w.origin)||!Array.isArray(w.aliases)||!w.aliases.every(a=>typeof a==='string'&&a.length<=40))return false;known.add(w.term);}
 for(const d of index.documents){
  if(!d||typeof d.key!=='string'||!d.key||documents.has(d.key)||typeof d.title!=='string'||!Array.isArray(d.variants)||!d.variants.length||!Array.isArray(d.terms)||!Array.isArray(d.source_ids)||!d.terms.every(t=>known.has(t))||new Set(d.terms).size!==d.terms.length)return false;
  documents.add(d.key);const dates=[],sources=new Set();
  for(const variant of d.variants){
   if(!variant||typeof variant.id!=='string'||seen.has(variant.id))return false;const a=articles.get(variant.id);
   if(!a||a.source_id!==variant.source_id||a.stage!==variant.stage||a.category!==variant.category||index.article_documents[a.id]!==d.key)return false;
   const terms=index.article_terms[a.id];if(!Array.isArray(terms)||terms.length!==d.terms.length||!terms.every(t=>d.terms.includes(t)))return false;
   seen.add(a.id);sources.add(a.source_id);const date=validDay(a.published_at);if(date)dates.push(date);
  }
  if(d.published_at!==(dates.sort()[0]||null)||d.source_ids.length!==sources.size||!d.source_ids.every(s=>sources.has(s)))return false;
 }
 if(seen.size!==articles.size||Object.keys(index.article_terms).length!==articles.size||Object.keys(index.article_documents).length!==articles.size)return false;
 return index.snapshot_fingerprint===snapshotFingerprint(snapshot);
}
export function getArticleKeywords(index,id,limit=3){
 if(!index)return [];
 const byTerm=new Map(index.keywords.map(w=>[w.term,w]));
 return (index.article_terms[id]||[]).map(term=>byTerm.get(term)).filter(Boolean).slice(0,limit).map(w=>({term:w.term,group:w.group,origin:w.origin}));
}
export function canonicalKeyword(index,term){
 const normalized=normalize(term);return index?.keywords.find(w=>[w.term,...(w.aliases||[])].some(alias=>normalize(alias)===normalized))?.term||term;
}
export function contentDomainMatcher(index,domain){
 if(!domain||domain==='all')return ()=>true;
 const terms=new Set((index?.keywords||[]).filter(w=>w.group===domain).map(w=>w.term));
 return values=>domain==='other'&&values.length===0||values.some(term=>terms.has(term));
}
function matchingVariants(d,params){
 return d.variants.filter(a=>{
  const source=params.get('source'),category=params.get('category'),stage=params.get('stage'),scope=params.get('scope');
  if(!matchesSourceTypes(a.source_id,params))return false;
  if(source&&a.source_id!==source||category&&a.category!==category||stage&&a.stage!==stage)return false;
  if(params.get('policy')==='1'&&ignoredStages.has(a.stage))return false;
  if(['central','province'].includes(scope)&&(SOURCE_MAP.get(a.source_id)?.level==='省级政府')!==(scope==='province'))return false;
  return true;
 });
}
export function keywordOverview(index,params=new URLSearchParams(),{days=30,now=new Date()}={}){
 const range=keywordWindow(days,now),custom=params.get('range_mode')==='custom';const from=validDay(params.get('from'))||(custom?'':range.from),to=validDay(params.get('to'))||(custom?'':range.to),today=chinaDate(now);
 const domains=params.getAll('domain'),domainMatch=terms=>!domains.length||domains.some(domain=>contentDomainMatcher(index,domain)(terms));
 const counts=new Map();let excluded_dates=0,future_dates=0,document_count=0;const sources=new Set();
 for(const d of index.documents){
  if(!domainMatch(d.terms))continue;
  const variants=matchingVariants(d,params);if(!variants.length)continue;
  if(!validDay(d.published_at)){excluded_dates++;continue;}
  if(d.published_at>today){future_dates++;continue;}
  if(from&&d.published_at<from||to&&d.published_at>to)continue;
  document_count++;for(const a of variants)sources.add(a.source_id);
  for(const term of d.terms){let row=counts.get(term);if(!row){row={count:0,sources:new Set()};counts.set(term,row);}row.count++;for(const a of variants)row.sources.add(a.source_id);}
 }
 const rows=[];
 for(const w of index.keywords){const row=counts.get(w.term);if(!row||row.count<(w.origin==='discovered'?3:2)||w.origin==='discovered'&&row.sources.size<2)continue;
  const promoted=Date.parse(w.promoted_at);rows.push({...w,count:row.count,source_count:row.sources.size,is_new:Number.isFinite(promoted)&&promoted<=new Date(now).getTime()&&promoted>=new Date(now).getTime()-7*DAY});
 }
 rows.sort((a,b)=>b.count-a.count||a.term.localeCompare(b.term,'zh-CN'));
 return {from,to,days,document_count,source_count:sources.size,excluded_dates,future_dates,keyword_count:rows.length,generated_at:index.generated_at,snapshot_generated_at:index.snapshot_generated_at,groups:KEYWORD_GROUPS.map(g=>({...g,keywords:rows.filter(w=>w.group===g.id)}))};
}
