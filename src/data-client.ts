import { CATEGORIES } from '@/lib/sources.mjs';
import { validateSnapshot,queryArticles,sourceRows,snapshotStats,toCsv,snapshotUrl } from '@/lib/dataset.mjs';
let cached:{key:number;promise:Promise<any>}|undefined;
export function loadDataset(key=0):Promise<any>{
 if(!cached||cached.key!==key){
  const base=new URL(import.meta.env.BASE_URL,document.baseURI).href;
  const promise=fetch(snapshotUrl(base),{cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error(`政策数据暂不可用（${response.status}）`);return validateSnapshot(await response.json());});
  cached={key,promise};promise.catch(()=>{if(cached?.promise===promise)cached=undefined;});
 }
 return cached.promise;
}
export async function readFeed(params:URLSearchParams,key=0){return queryArticles(await loadDataset(key),params);}
export async function readOverview(key=0){const snapshot=await loadDataset(key);return {sources:{sources:sourceRows(snapshot),categories:CATEGORIES},stats:snapshotStats(snapshot)};}
export async function downloadCsv(params:URLSearchParams,key=0){
 const snapshot=await loadDataset(key);const filters=new URLSearchParams(params);filters.set('page','1');
 const csv=toCsv(queryArticles(snapshot,filters,10000).articles);const objectUrl=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=objectUrl;link.download='policy-observatory.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
}
