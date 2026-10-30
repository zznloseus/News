import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {loadSnapshot,writeSnapshot} from './collector.mjs';
import {loadArchives,writeArchives} from './archive-files.mjs';
import {ensureKeywordFile} from './keyword-files.mjs';
import {fetchPermittedPage} from './crawler.mjs';
import {SOURCE_MAP} from './sources.mjs';
import {backfillReferences,emptyReferenceQueue,validateReferenceQueue,parseOfficialIndex,OFFICIAL_POLICY_INDEX} from './reference-backfill.mjs';

export async function loadReferenceQueue(path){
 try{return validateReferenceQueue(JSON.parse(await readFile(path,'utf8')));}
 catch(error){if(error.code==='ENOENT')return emptyReferenceQueue();throw error;}
}
export async function writeReferenceQueue(path,value){
 validateReferenceQueue(value);await mkdir(dirname(resolve(path)),{recursive:true});
 const tmp=path+'.'+crypto.randomUUID()+'.tmp';
 try{await writeFile(tmp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});await rename(tmp,path);}
 finally{await unlink(tmp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
export async function runReferenceBackfill({
 dataPath='data/snapshot.json',archivePath='data/archives.json',
 queuePath='data/references.json',keywordPath='data/keywords.json',limit=4,onResult=()=>{}
}={}){
 const snapshot=await loadSnapshot(dataPath),archives=await loadArchives(archivePath),queue=await loadReferenceQueue(queuePath);
 const result=await backfillReferences(snapshot,archives,queue,{
  limit,fetchPage:fetchPermittedPage,onResult,
  loadIndex:async()=>parseOfficialIndex((await fetchPermittedPage(OFFICIAL_POLICY_INDEX,SOURCE_MAP.get('gov'),{signal:AbortSignal.timeout(15000)})).html)
 });
 // Additive snapshot writes precede catalog publication: a newly archived item always has a known identity.
 if(result.added)await writeSnapshot(dataPath,result.snapshot);
 await writeArchives(archivePath,result.archives);
 await writeReferenceQueue(queuePath,result.queue);
 await ensureKeywordFile({dataPath,outputPath:keywordPath});
 return {added:result.added,processed:result.processed,requests:result.requests,references:result.pending};
}
