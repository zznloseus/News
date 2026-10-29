import { CATEGORIES } from '@/lib/sources.mjs';
import { validateSnapshot,queryArticles,sourceRows,snapshotStats,toCsv,snapshotUrl } from '@/lib/dataset.mjs';
import {buildKeywordIndex,isKeywordIndexFor} from '@/lib/keywords.mjs';
import {validateArchives,contentHash} from '@/lib/archive.mjs';
let archiveCache:{key:number;promise:Promise<any>}|undefined;
export function loadArchives(key=0):Promise<any>{
 if(!archiveCache||archiveCache.key!==key){
  const promise=fetch(new URL('data/archives.json',new URL(import.meta.env.BASE_URL,document.baseURI)),{cache:'no-store'}).then(async response=>{
   if(!response.ok)throw new Error(`正文目录不可用（${response.status}）`);
   const catalog=validateArchives(await response.json());
   for(const record of Object.values(catalog.records) as any[])for(const version of record.versions)if(await contentHash(version.text)!==version.content_hash)throw new Error('正文目录校验失败');
   return catalog;
  });archiveCache={key,promise};promise.catch(()=>{if(archiveCache?.promise===promise)archiveCache=undefined;});
 }return archiveCache.promise;
}
let cached:{key:number;promise:Promise<any>}|undefined;
let keywordCache:{key:number;promise:Promise<any>}|undefined;
export function loadDataset(key=0):Promise<any>{
 if(!cached||cached.key!==key){
  const base=new URL(import.meta.env.BASE_URL,document.baseURI).href;
  const promise=fetch(snapshotUrl(base),{cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error(`政策数据暂不可用（${response.status}）`);return validateSnapshot(await response.json());});
  cached={key,promise};promise.catch(()=>{if(cached?.promise===promise)cached=undefined;});
 }
 return cached.promise;
}
export function loadKeywordIndex(key=0):Promise<any>{
 if(!keywordCache||keywordCache.key!==key){
  const promise=loadDataset(key).then(async snapshot=>{
   try{const url=new URL('data/keywords.json',new URL(import.meta.env.BASE_URL,document.baseURI));const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw Error('关键词分析尚未发布');const index=await response.json();if(!isKeywordIndexFor(index,snapshot))throw Error('关键词分析与快照不一致');return index;}
   catch{return {...buildKeywordIndex(snapshot),rebuilt_locally:true};}
  });keywordCache={key,promise};promise.catch(()=>{if(keywordCache?.promise===promise)keywordCache=undefined;});
 }
 return keywordCache.promise;
}
export async function readFeed(params:URLSearchParams,key=0){const [snapshot,index]=await Promise.all([loadDataset(key),loadKeywordIndex(key)]);return queryArticles(snapshot,params,30,index);}
export async function readOverview(key=0){const [snapshot,index]=await Promise.all([loadDataset(key),loadKeywordIndex(key)]);return {sources:{sources:sourceRows(snapshot),categories:CATEGORIES},stats:snapshotStats(snapshot),keywords:index};}
export async function downloadCsv(params:URLSearchParams,key=0){
 const snapshot=await loadDataset(key);const filters=new URLSearchParams(params);filters.set('page','1');
 const index=await loadKeywordIndex(key);const csv=toCsv(queryArticles(snapshot,filters,10000,index).articles,index);const objectUrl=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=objectUrl;link.download='policy-observatory.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
}
