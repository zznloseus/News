import {SOURCE_MAP} from '../lib/sources.mjs';
import {allowedUrl,canonicalUrl,isArticleTitle} from '../lib/crawler.mjs';
import {validateSnapshot} from '../lib/dataset.mjs';
import {writeSnapshot} from '../lib/collector.mjs';

const origin=process.argv[2];if(!origin||!/^https:\/\//.test(origin))throw Error('用法：node scripts/import-snapshot.mjs https://现有网站地址');
const base=new URL(origin).origin;
async function get(path){for(let attempt=0;attempt<3;attempt++){try{const response=await fetch(base+path,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(`读取公开数据失败：${response.status}`);return await response.json();}catch(error){if(attempt===2)throw error;await new Promise(r=>setTimeout(r,250*(attempt+1)));}}}
const [first,sourceData,stats]=await Promise.all([get('/api/feed?page=1&sort=collected'),get('/api/sources'),get('/api/stats')]);
const pages=Math.ceil(first.total/first.limit);const articles=[...first.articles];let page=2;
async function worker(){while(page<=pages){const current=page++;const response=await get('/api/feed?sort=collected&page='+current);articles.push(...response.articles);}}
await Promise.all(Array.from({length:8},worker));
const unique=new Map();for(const article of articles){const source=SOURCE_MAP.get(article.source_id);if(source&&allowedUrl(article.url,source)&&isArticleTitle(article.title)){const url=canonicalUrl(article.url);if(!unique.has(url))unique.set(url,{...article,url});}}
if(unique.size<first.total)throw Error(`导出不完整：预期${first.total}，实际${unique.size}。请重试。`);
const health={};for(const source of sourceData.sources){if(!SOURCE_MAP.has(source.id)||!source.checked_at)continue;let pages=source.pages;try{if(typeof pages==='string')pages=JSON.parse(pages);}catch{pages=[];}health[source.id]={source_id:source.id,checked_at:source.checked_at,status:source.status,count:source.count||0,message:source.message||'',pages:Array.isArray(pages)?pages:[],last_success_at:source.last_success_at||null};}
const records=[...unique.values()];const runs=(stats.runs||[]).filter(r=>r.status!=='running').map(run=>({...run,new_articles:records.filter(a=>Date.parse(a.collected_at)>=Date.parse(run.started_at)&&Date.parse(a.collected_at)<=Date.parse(run.finished_at)).length}));
const snapshot=validateSnapshot({schema_version:1,generated_at:new Date().toISOString(),articles:records.sort((a,b)=>a.id.localeCompare(b.id)),health,runs});await writeSnapshot('data/snapshot.json',snapshot);
console.log(JSON.stringify({imported:snapshot.articles.length,sources:Object.keys(health).length,runs:runs.length}));
