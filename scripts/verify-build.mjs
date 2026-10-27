import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {validateSnapshot,queryArticles} from '../lib/dataset.mjs';
import {isKeywordIndexFor,keywordOverview} from '../lib/keywords.mjs';

const root=resolve('dist');const index=await readFile(resolve(root,'index.html'),'utf8');
assert.ok(!/(?:src|href)=["']\/(?!\/)/.test(index),'资源路径必须兼容仓库子目录');
const assets=[...index.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m=>m[1]).filter(url=>/\.(?:js|css|svg)$/.test(url));assert.ok(assets.some(a=>a.endsWith('.js')),'缺少应用脚本');
const server=createServer(async(request,response)=>{try{
 let path=decodeURIComponent(new URL(request.url,'http://localhost').pathname);if(path.startsWith('/repository/'))path=path.slice('/repository'.length);if(path==='/')path='/index.html';
 const file=resolve(root,'.'+path);if(!file.startsWith(root+sep)){response.writeHead(403).end();return;}await stat(file);const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};response.setHeader('content-type',types[extname(file)]||'application/octet-stream');response.end(await readFile(file));
}catch{response.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
try{for(const prefix of ['/','/repository/']){
 const page=await fetch(origin+prefix);assert.equal(page.status,200);
 for(const asset of assets){const url=new URL(asset,origin+prefix);const response=await fetch(url);assert.equal(response.status,200,'资源无法读取：'+url);const text=await response.text();if(asset.endsWith('.js'))assert.ok(!/["'`]\/api\//.test(text),'静态页面不应依赖旧后台接口');}
 const response=await fetch(origin+prefix+'data/snapshot.json');assert.equal(response.status,200);const data=validateSnapshot(await response.json());assert.ok(data.articles.length>0,'首次部署必须有真实数据');assert.equal((await fetch(origin+prefix+'api/feed')).status,404,'验证服务必须仅提供静态文件');
 const keywordResponse=await fetch(origin+prefix+'data/keywords.json');assert.equal(keywordResponse.status,200,'关键词分析未随静态页面发布');const keywords=await keywordResponse.json();assert.ok(isKeywordIndexFor(keywords,data),'关键词分析必须绑定同一份数据');const overview=keywordOverview(keywords,new URLSearchParams('policy=1'));assert.ok(Array.isArray(overview.groups),'关键词分组无法读取');
 const filtered=queryArticles(data,new URLSearchParams('q='+encodeURIComponent('十五五')+'&policy=1'));assert.ok(filtered.total>0,'真实数据搜索未返回结果');console.log(JSON.stringify({path:prefix,assets:assets.length,articles:data.articles.length,searchMatches:filtered.total}));
 }}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
console.log('根路径与仓库子路径静态部署验证通过。');
