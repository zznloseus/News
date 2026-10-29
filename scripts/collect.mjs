import {resolve} from 'node:path';
import {appendFile} from 'node:fs/promises';
import {SOURCES,SOURCE_MAP,ENABLED_SOURCES} from '../lib/sources.mjs';
import {collectSources,loadSnapshot,writeSnapshot} from '../lib/collector.mjs';
import {mergeCollection} from '../lib/dataset.mjs';
import {ensureKeywordFile} from '../lib/keyword-files.mjs';
import {loadArchives,writeArchives,collectArchives} from '../lib/archive-files.mjs';

const args=process.argv.slice(2);const options={data:'data/snapshot.json',sources:null,concurrency:6,timeout:45000,'archive-limit':12,'archive-data':'data/archives.json'};
for(let i=0;i<args.length;i++){const flag=args[i];if(!['--data','--sources','--concurrency','--timeout','--archive-limit','--archive-data'].includes(flag)||!args[i+1])throw new Error('用法：npm run collect -- [--data 数据路径] [--sources miit,nda] [--concurrency 6] [--timeout 45000] [--archive-limit 12] [--archive-data data/archives.json]');options[flag.slice(2)]=args[++i];}
const selected=options.sources?options.sources.split(',').map(id=>{const source=SOURCE_MAP.get(id.trim());if(!source)throw Error('未知来源：'+id);if(!source.enabled||source.access!=='public')throw Error('来源未启用自动采集：'+id);return source;}):ENABLED_SOURCES;
const archiveLimit=Number(options['archive-limit']);if(!Number.isInteger(archiveLimit)||archiveLimit<0||archiveLimit>100)throw Error('archive-limit 必须是0至100整数');
const timeoutMs=Number(options.timeout);if(!Number.isFinite(timeoutMs)||timeoutMs<1000||timeoutMs>120000)throw Error('来源时间上限必须在1000至120000毫秒之间');
const path=resolve(options.data);const previous=await loadSnapshot(path);const startedAt=new Date().toISOString();
const results=await collectSources({sources:selected,concurrency:Number(options.concurrency),timeoutMs,onResult:r=>console.log(JSON.stringify({source:r.source_id,status:r.status,count:r.count,message:r.message}))});
const note=selected.length===ENABLED_SOURCES.length?(process.env.GITHUB_ACTIONS==='true'?'GitHub Actions 每小时已启用来源采集':'本地已启用来源采集验证'):'手动指定来源采集';
const next=await mergeCollection(previous,results,{startedAt,finishedAt:new Date().toISOString(),note});await writeSnapshot(path,next);const run=next.runs[0];
await ensureKeywordFile({dataPath:path,outputPath:path===resolve('data/snapshot.json')?resolve('data/keywords.json'):path.replace(/\.json$/,'')+'.keywords.json',force:true});
const archivePath=resolve(options['archive-data']),catalog=await loadArchives(archivePath);await writeArchives(archivePath,await collectArchives(next,catalog,{limit:archiveLimit,onResult:r=>console.log(JSON.stringify({archive:r}))}));
console.log(JSON.stringify({saved:path,total:next.articles.length,...run}));
if(process.env.GITHUB_STEP_SUMMARY){await appendFile(process.env.GITHUB_STEP_SUMMARY,`## 每小时政策采集\n\n- 检查来源：${run.processed}\n- 成功解析：${run.succeeded}\n- 受限或待适配：${run.failed}\n- 新增条目：${run.new_articles}\n- 累计条目：${next.articles.length}\n\n采集失败来源的历史内容已保留。\n`);}
if(!run.succeeded)console.warn('::warning::本轮所有来源均未解析成功，已保留历史条目并写入失败记录。');
