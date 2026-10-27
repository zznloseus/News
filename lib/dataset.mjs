import { SOURCES,SOURCE_MAP,matchesSourceTypes,sourceTypeName } from './sources.mjs';
import { allowedUrl,canonicalUrl,isArticleTitle,extractDate,detectStage } from './crawler.mjs';
import {canonicalKeyword,validDay,chinaDate,contentDomainMatcher,KEYWORD_GROUPS} from './keywords.mjs';

const stages=new Set(['规划部署','政策发布','征求意见','资金申报','试点清单','政策解读','废止调整','项目采购','工作动态']);
export function emptySnapshot(){return {schema_version:1,generated_at:null,articles:[],health:{},runs:[]};}
export function validateSnapshot(snapshot){
 if(!snapshot||snapshot.schema_version!==1||!Array.isArray(snapshot.articles)||!snapshot.health||typeof snapshot.health!=='object'||!Array.isArray(snapshot.runs))throw new Error('政策数据版本或结构无效');
 const urls=new Set();const ids=new Set();
 for(const a of snapshot.articles){const source=SOURCE_MAP.get(a.source_id);if(!source||!allowedUrl(a.url,source)||typeof a.id!=='string'||!a.id||!isArticleTitle(a.title||'')||!Number.isFinite(Date.parse(a.collected_at)))throw new Error('政策条目或来源地址无效');if(urls.has(a.url)||ids.has(a.id))throw new Error('政策条目重复');urls.add(a.url);ids.add(a.id);}
 return snapshot;
}
const iso=(value,fallback)=>Number.isFinite(Date.parse(value))?new Date(value).toISOString():fallback;
export async function mergeCollection(previous,results,{startedAt=new Date().toISOString(),finishedAt=new Date().toISOString(),note='GitHub Actions 每小时全来源采集'}={}){
 validateSnapshot(previous);
 const records=new Map(previous.articles.map(a=>[canonicalUrl(a.url),{...a}]));const health={...previous.health};let newArticles=0,succeeded=0,failed=0;const checked=new Set();
 for(const result of results){
  const source=SOURCE_MAP.get(result.source_id);if(!source||checked.has(source.id))continue;checked.add(source.id);const checkedAt=iso(result.checked_at,finishedAt);let accepted=0;const seen=new Set();
  for(const incoming of (result.articles||[]).slice(0,70)){
   if(!isArticleTitle(incoming.title||'')||!allowedUrl(incoming.url,source))continue;
   const url=canonicalUrl(incoming.url);if(seen.has(url))continue;seen.add(url);accepted++;
   const old=records.get(url);let id=old?.id;
   if(!id){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(url));id=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');newArticles++;}
   let published=extractDate(incoming.published_at||'');if(published&&published>new Date(Date.parse(finishedAt)+86400000).toISOString().slice(0,10))published=null;
   records.set(url,{id,url,title:incoming.title,source_id:old?.source_id||source.id,category:old?.category||source.category,stage:stages.has(incoming.stage)?incoming.stage:detectStage(incoming.title),published_at:published||old?.published_at||null,collected_at:old?.collected_at||finishedAt,last_seen_at:checkedAt,excerpt:incoming.excerpt?String(incoming.excerpt).slice(0,180):(old?.excerpt||''),document_no:incoming.document_no||old?.document_no||null});
  }
  let status=['ok','partial','empty','error'].includes(result.status)?result.status:'error';if(!accepted&&['ok','partial'].includes(status))status='empty';
  const good=accepted>0&&['ok','partial'].includes(status);if(good)succeeded++;else failed++;
  health[source.id]={source_id:source.id,checked_at:checkedAt,status,count:accepted,message:String(result.message||(!accepted?'未解析到真实条目':'采集完成')).slice(0,500),pages:(result.pages||[]).filter(u=>allowedUrl(u,source)).slice(0,4),last_success_at:good?checkedAt:health[source.id]?.last_success_at||null};
 }
 const run={id:crypto.randomUUID(),started_at:startedAt,finished_at:finishedAt,status:succeeded?'complete':'failed',total_sources:checked.size,processed:checked.size,succeeded,failed,new_articles:newArticles,note};
 const next={schema_version:1,generated_at:finishedAt,articles:[...records.values()].sort((a,b)=>a.id.localeCompare(b.id)),health,runs:[run,...previous.runs].slice(0,365)};return validateSnapshot(next);
}
export function queryArticles(snapshot,params=new URLSearchParams(),limit=30,keywordIndex=null){
 const q=(params.get('q')||'').trim().toLocaleLowerCase();const category=params.get('category'),source=params.get('source'),stage=params.get('stage'),scope=params.get('scope'),from=params.get('from'),to=params.get('to');
 const keyword=params.get('keyword')?canonicalKeyword(keywordIndex,params.get('keyword')):null;
 const domain=params.get('domain');const deduplicate=!!(keyword||domain);const domainMatch=contentDomainMatcher(keywordIndex,domain);
 const documentDates=deduplicate?new Map((keywordIndex?.documents||[]).map(d=>[d.key,d.published_at])):null;
 const publication=a=>deduplicate?documentDates.get(keywordIndex?.article_documents[a.id]):a.published_at;
 let records=snapshot.articles.filter(a=>{
  if(!matchesSourceTypes(a.source_id,params)||!domainMatch(keywordIndex?.article_terms[a.id]||[]))return false;
  if(keyword&&!(keywordIndex?.article_terms[a.id]||[]).includes(keyword))return false;
  if(q&&![a.title,a.excerpt,a.document_no].some(t=>String(t||'').toLocaleLowerCase().includes(q)))return false;
  if(category&&a.category!==category||source&&a.source_id!==source||stage&&a.stage!==stage)return false;
  if(scope&&['central','province'].includes(scope)&&(SOURCE_MAP.get(a.source_id)?.level==='省级政府')!==(scope==='province'))return false;
  const date=publication(a);if(deduplicate&&(!validDay(date)||date>chinaDate()))return false;
  if(from&&(!date||date<from)||to&&(!date||date>to))return false;
  return !(params.get('policy')==='1'&&['工作动态','项目采购'].includes(a.stage));
 });
 const field=params.get('sort')==='collected'?'collected_at':'published_at';const sortValue=a=>field==='published_at'?publication(a):a.collected_at;records.sort((a,b)=>(sortValue(b)||'').localeCompare(sortValue(a)||'')||b.collected_at.localeCompare(a.collected_at)||a.id.localeCompare(b.id));
 if(deduplicate){const seen=new Set();records=records.filter(a=>{const key=keywordIndex?.article_documents[a.id]||a.id;if(seen.has(key))return false;seen.add(key);return true;});}
 const page=Math.max(1,Math.floor(Number(params.get('page'))||1));limit=Math.max(1,Math.min(10000,Math.floor(limit)));
 return {articles:records.slice((page-1)*limit,page*limit),total:records.length,page,limit};
}
export function sourceRows(snapshot){
 const counts=new Map();for(const a of snapshot.articles)counts.set(a.source_id,(counts.get(a.source_id)||0)+1);
 return SOURCES.map(s=>({...s,...(snapshot.health[s.id]||{status:'pending',count:0,message:'等待首次采集',checked_at:null}),total:counts.get(s.id)||0}));
}
export function snapshotStats(snapshot,now=new Date()){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);const fresh=now.getTime()-86400000;const states={};const categories=new Map();
 for(const source of Object.values(snapshot.health))if(Date.parse(source.checked_at)>=fresh)states[source.status]=(states[source.status]||0)+1;
 let latest=null;for(const a of snapshot.articles){categories.set(a.category,(categories.get(a.category)||0)+1);if(!latest||Date.parse(a.collected_at)>Date.parse(latest))latest=a.collected_at;}
 return {total:snapshot.articles.length,today:snapshot.articles.filter(a=>a.published_at===today).length,policies:snapshot.articles.filter(a=>!['工作动态','项目采购'].includes(a.stage)).length,latest,generated_at:snapshot.generated_at,date:today,sourceTotal:SOURCES.length,provinceTotal:SOURCES.filter(s=>s.level==='省级政府').length,successful:(states.ok||0)+(states.partial||0),checked:Object.values(states).reduce((n,x)=>n+x,0),states,categories:[...categories].map(([category,n])=>({category,n})).sort((a,b)=>b.n-a.n),runs:snapshot.runs,schedule:{frequency:'hourly',minute:0,timezone:'Asia/Shanghai'}};
}
export function toCsv(articles,index=null){
 const termGroups=new Map((index?.keywords||[]).map(w=>[w.term,w.group]));
 const content=a=>{const ids=new Set((index?.article_terms[a.id]||[]).map(term=>termGroups.get(term)));return KEYWORD_GROUPS.filter(g=>ids.has(g.id)).map(g=>g.name).join('／')||'未归类';};
 const cell=value=>{let s=String(value??'');if(/^\s*[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
 return '\uFEFF'+[['标题','发布来源','来源类型','内容领域','阶段','发布日期','首次收集时间','原文地址'],...articles.map(a=>[a.title,SOURCE_MAP.get(a.source_id)?.name||a.source_id,sourceTypeName(a.source_id),content(a),a.stage,a.published_at||'未标注',a.collected_at,a.url])].map(row=>row.map(cell).join(',')).join('\r\n');
}
export function snapshotUrl(base){return new URL('data/snapshot.json',base).href;}
