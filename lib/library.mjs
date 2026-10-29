import {SOURCE_MAP} from './sources.mjs';
import {allowedUrl} from './crawler.mjs';
import {ARCHIVE_MAX_TEXT,latestArchiveVersion,contentHashSync} from './archive.mjs';

export const LIBRARY_MAX_BYTES=30000000;
const validTime=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const string=(value,max)=>typeof value==='string'&&value.length<=max;
const identity=value=>string(value,180)&&value.length>0&&!['__proto__','constructor','prototype'].includes(value);
export function emptyLibrary(){return {schema_version:1,bookmarks:[],notes:[],legacy_migrated:false};}
function safeArticle(a){
 const source=SOURCE_MAP.get(a?.source_id);if(!a||!identity(a.id)||!source||!allowedUrl(a.url,source)||!string(a.title,500)||!a.title||!validTime(a.collected_at))throw Error('收藏条目或原文地址无效');
 return {id:a.id,source_id:a.source_id,url:a.url,title:a.title,category:string(a.category,100)?a.category:'',stage:string(a.stage,100)?a.stage:'',published_at:typeof a.published_at==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(a.published_at)?a.published_at:null,collected_at:a.collected_at,excerpt:string(a.excerpt,1000)?a.excerpt:'',document_no:string(a.document_no,200)?a.document_no:null};
}
function safeVersion(v,articleId){
 if(!v||!string(v.content_hash,64)||!/^[a-f0-9]{64}$/.test(v.content_hash)||v.id!==`${articleId}:${v.content_hash}`||!validTime(v.captured_at)||!['text','partial'].includes(v.status)||!string(v.text,ARCHIVE_MAX_TEXT)||!v.text||!Array.isArray(v.paragraphs)||v.paragraphs.length>20000||v.paragraphs.some(p=>!string(p,ARCHIVE_MAX_TEXT))||v.paragraphs.join('\n\n')!==v.text)throw Error('本机正文版本无效');
 if(contentHashSync(v.text)!==v.content_hash)throw Error('本机正文哈希不匹配；原有资料已保留，请下载原始备份恢复');
 return {id:v.id,content_hash:v.content_hash,captured_at:v.captured_at,status:v.status,text:v.text,paragraphs:[...v.paragraphs],issuer:string(v.issuer,200)?v.issuer:null,region:string(v.region,100)?v.region:null,title:string(v.title,500)?v.title:null,document_no:string(v.document_no,200)?v.document_no:null};
}
export function validateLibrary(input){
 if(!input||input.schema_version!==1||!Array.isArray(input.bookmarks)||!Array.isArray(input.notes)||input.bookmarks.length>10000||input.notes.length>50000)throw Error('资料库结构或容量无效');
 if(JSON.stringify(input).length>LIBRARY_MAX_BYTES)throw Error('资料库超过30MB导入上限');
 const ids=new Set(),versions=new Map(),bookmarks=input.bookmarks.map(b=>{
  const article=safeArticle(b?.article);if(ids.has(article.id)||!validTime(b.saved_at)||!Array.isArray(b.versions)||b.versions.length>1000)throw Error('收藏重复或结构无效');ids.add(article.id);
  const seen=new Set(),copied=b.versions.map(v=>{const safe=safeVersion(v,article.id);if(seen.has(safe.id))throw Error('正文版本重复');seen.add(safe.id);versions.set(safe.id,safe);return safe;});
  const current=latestArchiveVersion(b),latest_version_id=current?.id||null,latest_captured_at=b.latest_captured_at??current?.captured_at??null;
  if(b.latest_version_id!==undefined&&b.latest_version_id!==null&&!seen.has(b.latest_version_id)||b.latest_version_id===null&&copied.length||latest_captured_at!==null&&!validTime(latest_captured_at))throw Error('本机当前正文指针无效');
  if(b.latest_status!==undefined&&b.latest_status!==null&&!['text','partial'].includes(b.latest_status))throw Error('本机正文完整性状态无效');
  return {article,saved_at:b.saved_at,versions:copied,latest_version_id,latest_captured_at,latest_status:current?.status||null};
 });
 const notesSeen=new Set(),notes=input.notes.map(n=>{
  if(!n||!identity(n.id)||notesSeen.has(n.id)||!ids.has(n.article_id)||!validTime(n.created_at)||!validTime(n.updated_at)||n.deleted_at!==null&&!validTime(n.deleted_at)||!string(n.text,20000)||!string(n.quote,ARCHIVE_MAX_TEXT)||n.version_id!==null&&(!versions.has(n.version_id)||!n.version_id.startsWith(n.article_id+':')))throw Error('笔记结构或关联版本无效');
  if(n.version_id&&n.quote&&!versions.get(n.version_id).paragraphs.includes(n.quote))throw Error('笔记引用的段落不在留存版本中');
  notesSeen.add(n.id);return {id:n.id,article_id:n.article_id,version_id:n.version_id,quote:n.quote,text:n.text,created_at:n.created_at,updated_at:n.updated_at,deleted_at:n.deleted_at};
 });
 return {schema_version:1,bookmarks,notes,legacy_migrated:input.legacy_migrated===true};
}
export function parseLibraryBackup(text){if(typeof text!=='string'||text.length>LIBRARY_MAX_BYTES)throw Error('备份超过30MB上限');let data;try{data=JSON.parse(text);}catch{throw Error('备份不是有效JSON；原有资料未改变');}return validateLibrary(data);}
export function exportLibrary(state){return JSON.stringify(validateLibrary(state),null,2);}
export function mergeLibraries(current,incoming){
 const a=validateLibrary(current),b=validateLibrary(incoming),bookmarks=new Map(a.bookmarks.map(v=>[v.article.id,v]));
 for(const item of b.bookmarks){const old=bookmarks.get(item.article.id);if(!old){bookmarks.set(item.article.id,item);continue;}if(old.article.url!==item.article.url||old.article.source_id!==item.article.source_id)throw Error('收藏ID冲突；导入已取消');
  const versions=new Map(old.versions.map(v=>[v.id,v]));for(const v of item.versions){const previous=versions.get(v.id);if(previous&&(previous.text!==v.text||previous.status!==v.status))throw Error('正文版本ID冲突；导入已取消');if(!previous)versions.set(v.id,v);}
  if(old.latest_captured_at&&old.latest_captured_at===item.latest_captured_at&&(old.latest_version_id!==item.latest_version_id||old.latest_status!==item.latest_status))throw Error('当前正文版本观察时间冲突；导入已取消');
  const current=!old.latest_captured_at||item.latest_captured_at&&Date.parse(item.latest_captured_at)>Date.parse(old.latest_captured_at)?item:old;
  bookmarks.set(item.article.id,{...old,saved_at:old.saved_at<item.saved_at?old.saved_at:item.saved_at,versions:[...versions.values()],latest_version_id:current.latest_version_id,latest_captured_at:current.latest_captured_at,latest_status:current.latest_status});}
 const notes=new Map(a.notes.map(n=>[n.id,n]));for(const n of b.notes){const old=notes.get(n.id);if(old&&(old.article_id!==n.article_id||old.version_id!==n.version_id||old.quote!==n.quote||old.created_at!==n.created_at))throw Error('笔记ID冲突；导入已取消');if(old&&old.updated_at===n.updated_at&&JSON.stringify(old)!==JSON.stringify(n))throw Error('笔记内容冲突；导入已取消');if(!old||old.updated_at<n.updated_at)notes.set(n.id,n);}
 return validateLibrary({schema_version:1,bookmarks:[...bookmarks.values()],notes:[...notes.values()],legacy_migrated:a.legacy_migrated||b.legacy_migrated});
}
export function migrateLegacy(articles,{now=new Date().toISOString()}={}){if(!Array.isArray(articles))throw Error('旧收藏结构无效；已保留原始数据');return validateLibrary({schema_version:1,bookmarks:[...new Map(articles.map(a=>[a.id,{article:safeArticle(a),saved_at:now,versions:[]}])).values()],notes:[],legacy_migrated:true});}
export function saveBookmark(state,article,record=null,{now=new Date().toISOString()}={}){
 const a=safeArticle(article);if(record&&(record.article_id!==a.id||record.source_url!==a.url||record.source_id!==a.source_id))throw Error('正文与收藏来源不匹配');
 const current=latestArchiveVersion(record),incoming={schema_version:1,bookmarks:[{article:a,saved_at:now,versions:(record?.versions||[]).map(v=>safeVersion(v,a.id)),latest_version_id:current?.id||null,latest_captured_at:record?.latest_captured_at||current?.captured_at||null,latest_status:current?.status||null}],notes:[],legacy_migrated:false};return mergeLibraries(state,incoming);
}
export function removeBookmark(state,id){const safe=validateLibrary(state);return {...safe,bookmarks:safe.bookmarks.filter(b=>b.article.id!==id),notes:safe.notes.filter(n=>n.article_id!==id)};}
export function putNote(state,note,{now=new Date().toISOString()}={}){const safe=validateLibrary(state),old=safe.notes.find(n=>n.id===note.id);if(old&&(old.article_id!==note.article_id||old.version_id!==note.version_id||old.quote!==note.quote))throw Error('笔记关联不可改变');const value={id:note.id||crypto.randomUUID(),article_id:note.article_id,version_id:note.version_id??null,quote:note.quote||'',text:note.text||'',created_at:old?.created_at||now,updated_at:now,deleted_at:null};return validateLibrary({...safe,notes:[...safe.notes.filter(n=>n.id!==value.id),value]});}
export function deleteNote(state,id,{now=new Date().toISOString()}={}){return validateLibrary({...state,notes:state.notes.map(n=>n.id===id?{...n,deleted_at:now,updated_at:now}:n)});}
export function restoreNote(state,id,{now=new Date().toISOString()}={}){return validateLibrary({...state,notes:state.notes.map(n=>n.id===id?{...n,deleted_at:null,updated_at:now}:n)});}
