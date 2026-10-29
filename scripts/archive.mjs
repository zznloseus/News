import {resolve} from 'node:path';
import {loadSnapshot} from '../lib/collector.mjs';
import {loadArchives,writeArchives,collectArchives} from '../lib/archive-files.mjs';
const args=process.argv.slice(2),options={data:'data/snapshot.json',output:'data/archives.json',limit:12,'refresh-days':30,sources:'',ids:''};
for(let i=0;i<args.length;i++){const flag=args[i].slice(2);if(!args[i].startsWith('--')||!Object.hasOwn(options,flag)||!args[i+1])throw Error('用法：npm run archive -- [--data data/snapshot.json] [--output data/archives.json] [--limit 12] [--refresh-days 30] [--sources gov,miit]');options[flag]=args[++i];}
const limit=Number(options.limit),refreshDays=Number(options['refresh-days']);if(!Number.isInteger(limit)||limit<0||limit>100||!Number.isFinite(refreshDays)||refreshDays<0)throw Error('limit 必须是0至100整数，refresh-days 必须非负');
const snapshot=await loadSnapshot(resolve(options.data)),output=resolve(options.output),catalog=await loadArchives(output),sources=String(options.sources).split(',').filter(Boolean),ids=String(options.ids).split(',').filter(Boolean);
const next=await collectArchives({...snapshot,articles:snapshot.articles.filter(a=>(!sources.length||sources.includes(a.source_id))&&(!ids.length||ids.includes(a.id)))},catalog,{limit,refreshDays,onResult:r=>console.log(JSON.stringify(r))});await writeArchives(output,next);
console.log(JSON.stringify({saved:output,records:Object.keys(next.records).length,versions:Object.values(next.records).reduce((n,r)=>n+r.versions.length,0)}));
