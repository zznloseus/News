import test from 'node:test';
import assert from 'node:assert/strict';
import {policyIdentity,buildRelations} from '../lib/relations.mjs';
import {emptyArchives,recordArchive,extractArchive,selectArchiveCandidates} from '../lib/archive.mjs';
const date='2026-10-30T00:00:00Z';
const article=(id,title,source='gov')=>({id,title,source_id:source,url:`https://${source==='gov'?'www.gov.cn':source==='miit'?'www.miit.gov.cn':'www.jiangsu.gov.cn'}/art/${id}.html`,category:'综合政策',stage:'规划部署',published_at:'2026-10-20',collected_at:date,excerpt:'',document_no:null});

test('issuer levels distinguish council, ministries, provincial and municipal departments on repost sites',()=>{
 for(const [title,level,region] of [
  ['国务院关于推进数字经济发展的意见','central',null],
  ['国务院办公厅关于推进数字经济发展的意见','central',null],
  ['工业和信息化部关于推进数字经济发展的意见','ministry',null],
  ['国家发展改革委 国家数据局关于推进数字经济发展的意见','ministry',null],
  ['江苏省人民政府关于推进数字经济发展的意见','province','江苏省'],
  ['江苏省工业和信息化厅关于推进数字经济发展的实施方案','province-department','江苏省'],
  ['南京市工业和信息化局关于推进数字经济发展的实施细则','city-department','南京市'],
  ['北京市经济和信息化局关于推进数字经济发展的实施细则','province-department','北京市'],
  ['人力资源和社会保障部关于推进数字经济发展的意见','ministry',null],
  ['中华人民共和国国家发展和改革委员会关于推进数字经济发展的意见','ministry',null],
 ]){const value=policyIdentity(article('x',title,'jiangsu'));assert.equal(value.issuing_level,level,title);assert.equal(value.region,region);}
 assert.equal(policyIdentity(article('x','我市组织学习江苏省数字经济发展实施方案','jiangsu')).issuer,null);
});
test('same city spelling with and without province prefix preserves direct department citations',async()=>{
 const parent=article('city','南京市人民政府关于推进数字经济的实施意见','jiangsu');
 const child=article('department','江苏省南京市工业和信息化局关于推进数字经济的实施细则','jiangsu');
 const catalog=await recordArchive(emptyArchives(),child,extractArchive(`<article><p>根据《${parent.title}》，制定本细则。</p><p>${'执行具体事项。'.repeat(40)}</p></article>`));
 assert.equal(buildRelations({articles:[parent,child]},null,catalog).edges.length,1);
});
test('council to ministry to local department citations connect, unrelated regions and reverse levels do not',async()=>{
 const rows=[
  article('a','国务院关于推进数字经济发展的意见'),
  article('b','工业和信息化部关于推进数字经济发展的实施方案','miit'),
  article('c','江苏省工业和信息化厅关于推进数字经济发展的实施细则','jiangsu'),
  article('d','南京市工业和信息化局关于推进数字经济发展的实施细则','jiangsu'),
  article('e','浙江省工业和信息化厅关于推进数字经济发展的实施细则','jiangsu'),
 ];
 let archives=emptyArchives();
 for(let i=1;i<rows.length;i++)archives=await recordArchive(archives,rows[i],extractArchive(`<article><p>根据《${rows[i-1].title}》，制定本实施方案。</p><p>${'组织落实有关工作。'.repeat(30)}</p></article>`),{capturedAt:date});
 assert.deepEqual(buildRelations({articles:rows},null,archives).edges.map(e=>[e.from,e.to]),[['a','b'],['b','c'],['c','d']]);
});
test('implementation files get most budget while oldest eligible work retains a fair slot and retries cool down',()=>{
 const ordinary=article('000','关于公布年度检查目录的通知');
 const high=Array.from({length:4},(_,i)=>article('impl'+i,`江苏省关于推进第${i}项数字经济工作的实施细则`,'jiangsu'));
 const selection=selectArchiveCandidates({articles:[ordinary,...high]},emptyArchives(),{limit:4,now:new Date(date)});
 assert.equal(selection[0].id,'impl0');assert(selection.some(a=>a.id==='000'));
});
