import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {mkdtemp,writeFile,mkdir,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
test('first and later collection writes never move main, and read restores all files',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'policy-git-test-')),script=resolve('scripts/sync-policy-data.mjs');
 const git=(args,cwd)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{
  const remote=join(temp,'remote.git'),repo=join(temp,'repo');git(['init','--bare',remote]);await mkdir(repo);git(['init','-b','main'],repo);git(['config','user.name','Test'],repo);git(['config','user.email','test@example.com'],repo);git(['remote','add','origin',remote],repo);await writeFile(join(repo,'code.txt'),'code');git(['add','.'],repo);git(['commit','-m','code'],repo);git(['push','origin','main'],repo);const sha=git(['rev-parse','HEAD'],repo);
  await mkdir(join(repo,'data'));for(const name of ['snapshot','keywords','archives','references'])await writeFile(join(repo,'data',name+'.json'),JSON.stringify({name,value:1}));
  const run=mode=>execFileSync(process.execPath,[script,mode],{cwd:repo,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  run('read');run('write');assert.equal(git(['ls-remote','origin','refs/heads/main'],repo).split(/\s/)[0],sha);
  await writeFile(join(repo,'data/snapshot.json'),JSON.stringify({value:2}));run('write');await writeFile(join(repo,'data/snapshot.json'),'{}');run('read');assert.equal(JSON.parse(await readFile(join(repo,'data/snapshot.json'))).value,2);assert.equal(git(['rev-parse','HEAD'],repo),sha);
 }finally{await rm(temp,{recursive:true,force:true});}
});
