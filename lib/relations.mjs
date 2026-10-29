import {SOURCE_MAP,SOURCES,isMediaSource} from './sources.mjs';
import {eligiblePolicy,validateArchives,latestArchiveVersion} from './archive.mjs';

const normalized=value=>String(value||'').normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'');
const number=value=>String(value||'').normalize('NFKC').replace(/\s/g,'').replace(/[〔【（]/g,'[').replace(/[〕】）]/g,']');
function titleCitation(paragraph,titles){
 const spans=[];let start=-1,stack=[];
 for(let i=0;i<paragraph.length;i++){const char=paragraph[i];if(char==='《'||char==='〈'){if(!stack.length)start=i;stack.push(char);}else if(char==='》'||char==='〉'){const opening=char==='》'?'《':'〈';if(stack.at(-1)!==opening)continue;stack.pop();if(!stack.length)spans.push({start,end:i+1,text:paragraph.slice(start+1,i)});}}
 for(const title of titles){const target=normalized(title);if(target.length<12)continue;
  const direct=spans.find(span=>normalized(span.text)===target);if(direct)return {reference:title,offset:direct.start};
  // Nested title mentions inside another document's name are indirect; never promote them to direct citation edges.
  if(spans.some(span=>normalized(span.text).includes(target)))continue;
  let outside=paragraph;for(const span of [...spans].reverse())outside=outside.slice(0,span.start)+' '.repeat(span.end-span.start)+outside.slice(span.end);
  if(!stack.length&&normalized(outside).includes(target)){const offset=outside.indexOf(title);if(offset>=0)return {reference:title,offset};}
 }
 return null;
}
const operativeBefore=(paragraph,offset)=>/(?:根据|依据|贯彻(?:落实)?|落实|实施|执行|衔接)[^。！？\n]{0,80}$/.test(paragraph.slice(Math.max(0,offset-100),offset));
const institutions=SOURCES.filter(s=>['central','ministry','local'].includes(s.source_type)).flatMap(s=>[s.name,s.name+'办公厅',s.name+'办公室']).sort((a,b)=>b.length-a.length);
const provinces=SOURCES.filter(s=>s.source_type==='local').map(s=>s.name.replace(/人民政府$/,'')).sort((a,b)=>b.length-a.length);
export function policyIdentity(article,version=null){
 const title=version?.title||article.title,prefix=title.split(/关于|印发|发布/)[0],titleIssuer=/^国务院(?:办公厅)?$/.test(prefix)?prefix:institutions.includes(prefix)?prefix:/^[\u4e00-\u9fff]{2,20}(?:省|自治区|市|县|区)人民政府(?:办公厅|办公室)?$/.test(prefix)?prefix:null;
 const issuer=version?.issuer||titleIssuer||null,region=issuer?.match(/^([\u4e00-\u9fff]{2,20}(?:省|自治区|市|县|区))人民政府/)?.[1]||null;
 const issuing_level=!issuer?null:/^国务院|^中华人民共和国/.test(issuer)||institutions.includes(issuer)&&!region?'central':provinces.includes(region)?'province':region?.endsWith('市')?'city':region?'county':null;
 return {issuer,region,issuing_level};
}
export function buildRelations(snapshot,keywordIndex=null,archives={schema_version:1,records:{}}){
 validateArchives(archives);const articles=snapshot.articles||[],versions=new Map(articles.map(a=>[a.id,latestArchiveVersion(archives.records[a.id])])),identities=new Map(articles.map(a=>[a.id,policyIdentity(a,versions.get(a.id))])),numbers=new Map();
 const eligible=a=>eligiblePolicy(a,versions.get(a.id));
 const documentNumber=a=>versions.get(a.id)?.document_no||a.document_no;
 for(const a of articles){if(!eligible(a))continue;const no=number(documentNumber(a));if(no){if(!numbers.has(no))numbers.set(no,[]);numbers.get(no).push(a.id);}}
 const nodes=articles.map(a=>({id:a.id,source_id:a.source_id,publisher:SOURCE_MAP.get(a.source_id)?.name||null,...identities.get(a.id),level:SOURCE_MAP.get(a.source_id)?.source_type||'unknown',title:versions.get(a.id)?.title||a.title,terms:keywordIndex?.article_terms?.[a.id]||[],archive_version_id:versions.get(a.id)?.id||null,policy_eligible:eligible(a)}));
 const roots=articles.filter(a=>eligible(a)&&(['central','ministry'].includes(SOURCE_MAP.get(a.source_id)?.source_type)||identities.get(a.id).issuer)),edges=[],related=[],reposts=[];
 const ranks={central:0,province:1,city:2,county:3};
 const reaches=(from,to,seen=new Set())=>{if(from===to)return true;if(seen.has(from))return false;seen.add(from);return edges.some(e=>e.from===from&&reaches(e.to,to,seen));};
 for(const child of articles){
  if(!eligible(child)||isMediaSource(child.source_id))continue;
  const record=archives.records[child.id],version=versions.get(child.id),childIdentity=identities.get(child.id);
  if(!version||record.source_url!==child.url||record.source_id!==child.source_id)continue;
  for(const root of roots){
   if(root.id===child.id)continue;const rootIdentity=identities.get(root.id),localRoot=SOURCE_MAP.get(root.source_id)?.source_type==='local';
   if(localRoot&&(!rootIdentity.issuer||!childIdentity.issuer||rootIdentity.issuer===childIdentity.issuer))continue;
   if(rootIdentity.issuing_level&&childIdentity.issuing_level&&ranks[rootIdentity.issuing_level]>=ranks[childIdentity.issuing_level])continue;
   if(!childIdentity.issuing_level&&SOURCE_MAP.get(child.source_id)?.source_type!=='local')continue;
   const rootTitles=[root.title,versions.get(root.id)?.title].filter(Boolean),rootTitle=normalized(rootTitles.at(-1)),childTitle=normalized(version.title||child.title);
   if(rootTitles.some(t=>normalized(t)===childTitle)||/^转发|^转载/.test(child.title)&&childTitle.includes(rootTitle)){reposts.push({from:root.id,to:child.id,type:'repost'});continue;}
   let evidence=null;
   for(const paragraph of version.paragraphs){
    if(/^\s*(?:参考文献|参考资料|相关链接|延伸阅读|附件目录|政策原文链接)/.test(paragraph))break;
    if(/^\s*来源[：:]/.test(paragraph))continue;
    const citedTitle=titleCitation(paragraph,rootTitles),no=number(documentNumber(root));
    const citedNumber=no&&numbers.get(no)?.length===1?[...paragraph.matchAll(/[\u4e00-\u9fff]{1,12}[〔\[（]20\d{2}[〕\]）]\s*\d{1,5}\s*号/g)].find(match=>number(match[0])===no):null;
    const citation=citedTitle&&operativeBefore(paragraph,citedTitle.offset)?{...citedTitle,match:'full-title'}:citedNumber&&operativeBefore(paragraph,citedNumber.index)?{reference:documentNumber(root),offset:citedNumber.index,match:'document-number'}:null;
    if(citation){
     const offset=Math.max(0,citation.offset-120);
     evidence={match:citation.match,reference:citation.reference,excerpt:paragraph.slice(offset,offset+1600),version_id:version.id,source_url:record.source_url,captured_at:record.latest_captured_at||version.captured_at,archive_status:version.status};break;
    }
   }
   if(evidence&&!reaches(child.id,root.id))edges.push({id:`${root.id}>${child.id}`,from:root.id,to:child.id,type:'explicit-citation',relation:'cites',evidence});
   else {const terms=(keywordIndex?.article_terms?.[root.id]||[]).filter(t=>(keywordIndex?.article_terms?.[child.id]||[]).includes(t));if(terms.length)related.push({from:root.id,to:child.id,type:'thematic-candidate',terms});}
  }
 }
 return {schema_version:1,snapshot_generated_at:snapshot.generated_at||null,archive_generated_at:archives.generated_at||null,nodes,edges,related,reposts,unmatched:articles.filter(a=>eligible(a)&&SOURCE_MAP.get(a.source_id)?.source_type==='local'&&!edges.some(e=>e.to===a.id)).map(a=>a.id),method:'operative-body-citation; local roots need explicit distinct issuers; publisher is not issuer'};
}
