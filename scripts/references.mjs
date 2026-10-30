import {resolve} from 'node:path';
import {runReferenceBackfill} from '../lib/reference-files.mjs';
const options={data:'data/snapshot.json',archives:'data/archives.json',queue:'data/references.json',keywords:'data/keywords.json',limit:4};
const args=process.argv.slice(2);
for(let i=0;i<args.length;i++){
 const flag=args[i].slice(2);if(!args[i].startsWith('--')||!Object.hasOwn(options,flag)||!args[i+1])throw Error('用法：npm run references -- [--limit 4] [--data 路径] [--archives 路径] [--queue 路径] [--keywords 路径]');
 options[flag]=args[++i];
}
const limit=Number(options.limit);if(!Number.isInteger(limit)||limit<0||limit>20)throw Error('每轮补齐预算必须为0至20');
console.log(JSON.stringify(await runReferenceBackfill({dataPath:resolve(options.data),archivePath:resolve(options.archives),queuePath:resolve(options.queue),keywordPath:resolve(options.keywords),limit,onResult:r=>console.log(JSON.stringify(r))})));
