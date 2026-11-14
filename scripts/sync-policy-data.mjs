import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,copyFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const files=['snapshot.json','keywords.json','archives.json','references.json'];
const remote=process.env.POLICY_DATA_REMOTE||'origin',branch='policy-data';
const git=(args,cwd=process.cwd())=>execFileSync('git',args,{cwd,encoding:'utf8',maxBuffer:100_000_000});
const readMode=process.argv[2]==='read';
const exists=git(['ls-remote','--heads',remote,'refs/heads/'+branch]).trim();
if(readMode){
 if(!exists){console.log('首次迁移：使用代码分支附带的数据');process.exit(0);}
 git(['fetch','--no-tags','--depth=1',remote,'refs/heads/'+branch]);
 const revision=git(['rev-parse','FETCH_HEAD']).trim();
 // Stage every file before replacing any local input.
 const values=files.map(f=>[f,git(['show',`${revision}:data/${f}`])]);
 for(const [f,value] of values)JSON.parse(value);
 for(const [f,value] of values)await writeFile('data/'+f,value);
 console.log('数据输入版本：'+revision);
}else if(process.argv[2]==='write'){
 const directory=await mkdtemp(join(tmpdir(),'policy-data-'));
 try{
  git(['init','-b',branch,directory]);
  const url=git(['remote','get-url',remote]).trim();git(['remote','add','origin',url],directory);
  // The checkout's scoped HTTPS credentials are used only in this temporary repo,
  // which is removed in finally. They are never committed or logged.
  let auth=[];try{auth=git(['config','--get-regexp','http\\..*\\.extraheader']).trim().split('\n').filter(Boolean);}catch(error){if(error.status!==1)throw error;}
  for(const entry of auth){const space=entry.indexOf(' ');git(['config',entry.slice(0,space),entry.slice(space+1)],directory);}
  if(exists){git(['fetch','--depth=1','origin',branch],directory);git(['reset','--hard','FETCH_HEAD'],directory);}
  await mkdir(join(directory,'data'),{recursive:true});
  for(const f of files)await copyFile(resolve('data',f),join(directory,'data',f));
  git(['add',...files.map(f=>'data/'+f)],directory);
  if(!git(['status','--porcelain'],directory).trim()){console.log('数据未变化');process.exitCode=0;}
  else{git(['-c','user.name=policy-observatory-bot','-c','user.email=policy-observatory-bot@users.noreply.github.com','commit','-m','data: update public policy snapshot'],directory);git(['push','origin','HEAD:refs/heads/'+branch],directory);}
 }finally{await rm(directory,{recursive:true,force:true});}
}else throw Error('Usage: node scripts/sync-policy-data.mjs read|write');
