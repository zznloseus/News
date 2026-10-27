import {build} from 'vite';
import {cp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {validateSnapshot} from '../lib/dataset.mjs';
import {ensureKeywordFile} from '../lib/keyword-files.mjs';
validateSnapshot(JSON.parse(await readFile('data/snapshot.json','utf8')));
await ensureKeywordFile();
await build();await mkdir('dist/data',{recursive:true});await cp('data/snapshot.json','dist/data/snapshot.json');await cp('data/keywords.json','dist/data/keywords.json');await writeFile('dist/.nojekyll','');
console.log('静态网站已生成：dist/（含公开数据，无需后台服务）');
