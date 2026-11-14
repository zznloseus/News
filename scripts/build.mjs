import {execFileSync} from 'node:child_process';
import {build} from 'vite';
import {cp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {validateSnapshot} from '../lib/dataset.mjs';
import {ensureKeywordFile} from '../lib/keyword-files.mjs';
import {loadArchives,writeArchives} from '../lib/archive-files.mjs';
validateSnapshot(JSON.parse(await readFile('data/snapshot.json','utf8')));
await ensureKeywordFile();
await writeArchives('data/archives.json',await loadArchives('data/archives.json'));
await build();await mkdir('dist/data',{recursive:true});await cp('data/snapshot.json','dist/data/snapshot.json');await cp('data/keywords.json','dist/data/keywords.json');await writeFile('dist/.nojekyll','');
await cp('data/archives.json','dist/data/archives.json');
console.log('静态网站已生成：dist/（含公开数据，无需后台服务）');

await writeFile('dist/data/deployment.json',JSON.stringify({built_at:new Date().toISOString(),code_revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),run_url:process.env.GITHUB_RUN_ID?`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`:null,snapshot_at:JSON.parse(await readFile('data/snapshot.json','utf8')).generated_at})+'\n');
