import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';
import {dirname} from 'node:path';
import {ENABLED_SOURCES} from './sources.mjs';
import {crawlSource} from './crawler.mjs';
import {emptySnapshot,validateSnapshot} from './dataset.mjs';

export async function collectSources({sources=ENABLED_SOURCES,concurrency=6,timeoutMs=45000,details=true,crawl=crawlSource,onResult=()=>{}}={}){
 sources=sources.filter(s=>s.enabled!==false&&s.access!=='authorization-required');
 let cursor=0;const results=new Array(sources.length);const count=Math.max(1,Math.min(8,Math.floor(concurrency)||6));
 async function worker(){while(cursor<sources.length){const index=cursor++;const source=sources[index];let result;try{result=await crawl(source,{details,signal:AbortSignal.timeout(timeoutMs)});}catch(error){result={source_id:source.id,checked_at:new Date().toISOString(),status:'error',count:0,message:String(error.message||error).slice(0,500),pages:[],articles:[]};}results[index]=result;onResult(result);}}
 await Promise.all(Array.from({length:Math.min(count,sources.length)},worker));return results;
}
export async function loadSnapshot(path){try{return validateSnapshot(JSON.parse(await readFile(path,'utf8')));}catch(error){if(error.code==='ENOENT')return emptySnapshot();throw error;}}
export async function writeSnapshot(path,snapshot){
 validateSnapshot(snapshot);await mkdir(dirname(path),{recursive:true});const temporary=path+'.'+process.pid+'.'+crypto.randomUUID()+'.tmp';
 try{await writeFile(temporary,JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'});await rename(temporary,path);}finally{await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
}
