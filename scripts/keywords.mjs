import {ensureKeywordFile} from '../lib/keyword-files.mjs';
const options={};const args=process.argv.slice(2);
for(let i=0;i<args.length;i++){if(!['--data','--output'].includes(args[i])||!args[i+1])throw Error('用法：npm run keywords -- [--data 快照路径] [--output 索引路径]');options[args[i]==='--data'?'dataPath':'outputPath']=args[++i];}
const index=await ensureKeywordFile(options);
console.log(JSON.stringify({keywords:index.keywords.filter(w=>!w.inactive).length,discovered:index.keywords.filter(w=>w.origin==='discovered'&&!w.inactive).length,documents:index.documents.length,generated_at:index.generated_at}));
