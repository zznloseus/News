import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';
import {dirname} from 'node:path';
import {emptyArchives,validateArchives,contentHash,selectArchiveCandidates,extractArchive,recordArchive} from './archive.mjs';
import {SOURCE_MAP} from './sources.mjs';
import {fetchPermittedPage} from './crawler.mjs';
import {policyReferences,citationLinks} from './reference-backfill.mjs';

export async function loadArchives(path){try{const catalog=validateArchives(JSON.parse(await readFile(path,'utf8')));for(const r of Object.values(catalog.records))for(const v of r.versions)if(await contentHash(v.text)!==v.content_hash)throw Error('正文留存哈希不匹配：'+r.article_id);return catalog;}catch(error){if(error.code==='ENOENT')return emptyArchives();throw error;}}
export async function writeArchives(path,catalog){validateArchives(catalog);await mkdir(dirname(path),{recursive:true});const temporary=path+'.'+process.pid+'.'+crypto.randomUUID()+'.tmp';try{await writeFile(temporary,JSON.stringify(catalog,null,2)+'\n',{flag:'wx'});await rename(temporary,path);}finally{await unlink(temporary).catch(e=>{if(e.code!=='ENOENT')throw e;});}}
export async function collectArchives(snapshot,catalog,{limit=12,refreshDays=30,timeoutMs=15000,fetchPage=fetchPermittedPage,onResult=()=>{}}={}){
 let next=validateArchives(catalog);const candidates=selectArchiveCandidates(snapshot,catalog,{limit,refreshDays});
 for(const article of candidates){let result,links;try{const page=await fetchPage(article.url,SOURCE_MAP.get(article.source_id),{timeout:timeoutMs,signal:AbortSignal.timeout(timeoutMs)});result=extractArchive(page.html);links=citationLinks(page.html,page.url,policyReferences(result));}catch(error){result={status:'unavailable',message:String(error.message||error),text:'',paragraphs:[]};}
  next=await recordArchive(next,article,result);
  next.records[article.id].reference_links=links??catalog.records[article.id]?.reference_links??[];
  onResult({article_id:article.id,source_id:article.source_id,status:result.status,message:result.message});
 }
 return next;
}
