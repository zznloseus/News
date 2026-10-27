import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {validateSnapshot} from './dataset.mjs';
import {buildKeywordIndex,isKeywordIndexFor,KEYWORD_ENGINE_VERSION} from './keywords.mjs';
import {KEYWORD_GROUPS} from './keyword-config.mjs';

export async function ensureKeywordFile({dataPath='data/snapshot.json',outputPath='data/keywords.json',force=false,now=new Date()}={}){
 const snapshot=validateSnapshot(JSON.parse(await readFile(dataPath,'utf8')));let previousIndex=null;
 try{const previous=JSON.parse(await readFile(outputPath,'utf8'));
  if(previous?.engine_version===KEYWORD_ENGINE_VERSION&&Array.isArray(previous.keywords)&&previous.keywords.every(w=>w&&typeof w.term==='string'&&w.term.length<=40&&KEYWORD_GROUPS.some(g=>g.id===w.group)&&['curated','discovered'].includes(w.origin)&&Array.isArray(w.aliases)&&w.aliases.every(a=>typeof a==='string')))previousIndex=previous;
 }catch(error){if(error.code!=='ENOENT')console.warn('关键词索引不可读，将从公开快照重新生成。');}
 if(!force&&isKeywordIndexFor(previousIndex,snapshot))return previousIndex;
 const index=buildKeywordIndex(snapshot,{now,previousIndex});if(!isKeywordIndexFor(index,snapshot))throw Error('关键词索引与原始快照不一致');
 await mkdir(dirname(resolve(outputPath)),{recursive:true});const temp=resolve(outputPath)+'.tmp-'+crypto.randomUUID();
 try{await writeFile(temp,JSON.stringify(index)+'\n','utf8');await rename(temp,resolve(outputPath));}finally{await rm(temp,{force:true});}
 return index;
}
