import {SOURCE_MAP} from './sources.mjs';
import {allowedUrl,cleanText} from './crawler.mjs';
export {contentHashSync} from './hash.mjs';

export const ARCHIVE_MAX_TEXT=250000;
export function emptyArchives(){return {schema_version:1,generated_at:null,records:{}};}
const reportingTitle=/发布会|吹风会|答记者问|政策解读|图解|一图读懂|新闻|访谈|座谈会|召开.*会议|会议.*(?:传达|强调|贯彻|学习)|学习贯彻|负责人.*(?:解答|回应)|记者/;
export function eligiblePolicy(article,version=null){
 if(!SOURCE_MAP.get(article.source_id)?.archive_eligible||!['政策发布','规划部署','资金申报','试点清单','废止调整','征求意见'].includes(article.stage))return false;
 const title=String(version?.title||article.title||'').trim();
 if(reportingTitle.test(article.title)||reportingTitle.test(title))return false;
 // Stage is only a discovery hint. A graph participant must have a document-shaped title or explicit document number.
 if(!/(?:通知|意见|决定|公告|规定|办法|条例|方案|规划(?:纲要)?|纲要|措施|细则|清单|目录)(?:[（(][^）)]{0,50}[）)])?[》\s]*$/.test(title)&&!article.document_no&&!version?.document_no)return false;
 const opening=(version?.paragraphs||[]).slice(0,4).join('\n').slice(0,1000);
 return !/主持人[：:]|记者[：:]|新华社[^。]{0,30}电|本报讯|(?:昨日|昨天|会议)(?:[^。]{0,20})(?:强调|指出|召开|举行)|举行[^。]{0,30}(?:发布会|吹风会)|(?:发布会|吹风会)(?:现场|实录|上)|记者[^。]{0,30}(?:获悉|报道)/.test(opening);
}
export function latestArchiveVersion(record){
 if(!record||!Array.isArray(record.versions))return undefined;
 const version=record.latest_version_id===undefined?record.versions.at(-1):record.versions.find(v=>v.id===record.latest_version_id);
 return version&&record.latest_status?{...version,status:record.latest_status}:version;
}
const unavailable=message=>({status:'unavailable',text:'',paragraphs:[],message,issuer:null,region:null});

// Balanced tokenization keeps nested divs intact. No HTML is returned or rendered.
export function extractArchive(html=''){
 if(typeof html!=='string'||html.length>3000000)return unavailable('正文页面为空或超过大小上限');
 html=html.replace(/<!--[\s\S]*?-->/g,'');
 if(/captcha|人机验证|访问验证|安全验证|access denied|请登录后|登录后阅读全文|付费阅读/i.test(html)&&html.length<25000)return unavailable('访问限制或验证页面');
 const token=/<\/?[a-zA-Z][^>]*>|[^<]+|</g,stack=[],candidates=[];let match,current=null;
 const voids=new Set(['br','hr','img','input','meta','link','source','wbr','embed','area','base','col','param']);
 const flush=()=>{if(current){const text=cleanText(current.buffer);if(text&&!/^(?:扫一扫在手机打开当前页|扫描二维码在手机打开当前页|打印本页\s*关闭窗口|打印本页|关闭窗口)$/.test(text))current.paragraphs.push(text);current.buffer='';}};
 while((match=token.exec(html))){const value=match[0];if(value.startsWith('<')){
   const tag=value.match(/^<\/?([\w-]+)/)?.[1]?.toLowerCase();if(!tag)continue;
   if(value.startsWith('</')){const index=stack.map(s=>s.tag).lastIndexOf(tag);if(index<0)continue;if(current&&['p','div','section','li','h1','h2','h3','tr'].includes(tag))flush();if(current&&index===current.depth){flush();candidates.push({...current,closed:true});current=null;}stack.splice(index);continue;}
   const blocked=stack.some(s=>s.blocked)||['script','style','nav','footer','header','aside','noscript','iframe','form'].includes(tag)||/\b(?:class|id)\s*=\s*["'][^"']*(?:share|related|pagination|attachment|toolbar|breadcrumb|copyright)[^"']*["']/i.test(value);
   const main=!blocked&&(tag==='article'||/\b(?:id|class)\s*=\s*["'][^"']*(?:TRS_Editor|UCAP-CONTENT|article-content|article_content|content-body|pages_content|viewTRS|detail-content|zwxl-article|Custom_UnionStyle)[^"']*["']/i.test(value)||/\b(?:id|class)\s*=\s*["'](?:[^"']*\s)?(?:contText|con_con)(?:\s[^"']*)?["']/i.test(value));
   if(!current&&main)current={depth:stack.length,paragraphs:[],buffer:'',closed:false,summary:/\b(?:id|class)\s*=\s*["'][^"']*(?:\bsummary\b|\babstract\b|zhaiyao)[^"']*["']/i.test(value)||stack.some(s=>s.summary)};
   if(current&&['p','div','section','li','h1','h2','h3','br','tr'].includes(tag))flush();
   if(!voids.has(tag)&&!value.endsWith('/>'))stack.push({tag,blocked,summary:/\b(?:id|class)\s*=\s*["'][^"']*(?:\bsummary\b|\babstract\b|zhaiyao)[^"']*["']/i.test(value)});
 }else if(current&&!stack.some(s=>s.blocked))current.buffer+=' '+value;}
 if(current){flush();candidates.push(current);}
 const candidate=candidates.sort((a,b)=>b.paragraphs.join('\n').length-a.paragraphs.join('\n').length)[0];
 if(!candidate||candidate.paragraphs.join('').length<80)return unavailable('未找到可靠的正文区域；仅有简介或动态页面');
 if(candidate.summary||/^(?:政策摘要|文件摘要|内容摘要|摘要|政策概要|政策要点|Abstract|Summary)[：:\s]*$/i.test(candidate.paragraphs[0]||''))return unavailable('仅找到摘要区域，不作为正文文字留存');
 let paragraphs=candidate.paragraphs,text=paragraphs.join('\n\n');const truncated=text.length>ARCHIVE_MAX_TEXT;
 if(truncated){text=text.slice(0,ARCHIVE_MAX_TEXT);paragraphs=text.split('\n\n');}
 // Read page controls before their removal from main text; prose mentioning an appendix/abstract is not a pagination signal.
 const pagination=/<a\b[^>]*href\s*=\s*["'](?!#|javascript:)[^"']+["'][^>]*>\s*(?:<[^>]+>\s*)*(?:下一页|下页|next\s*(?:page)?|[>»]+)\s*(?:<[^>]+>\s*)*<\/a>/i.test(html)||/\b(?:class|id)\s*=\s*["'][^"']*(?:pagination|page-nav|pagebar)[^"']*["'][^>]*>[\s\S]{0,1500}?(?:共\s*[2-9]\d*\s*页|href\s*=\s*["'][^"']*(?:page[_-]?[2-9]|_[2-9]\.))/i.test(html);
 const partial=truncated||!candidate.closed||pagination||text.length<200||/未完待续|下页继续|剩余全文|点击.*(?:全文|下一页)|第\s*1\s*页.*共\s*[2-9]|仅供摘要/.test(text)||/<(?:a|iframe)\b[^>]*(?:href|src)=["'][^"']*\.(?:pdf|docx?)(?:[?"'])/i.test(html)&&text.length<400;
 const issuer=text.match(/(?:发文机关|发布机关|制定机关)\s*[：:]\s*([^\n。；]{2,80})/)?.[1]?.trim()||null;
 const prefix=paragraphs.slice(0,6).join(''),title=prefix.match(/^((?:国务院(?:办公厅)?|[\u4e00-\u9fff]{2,30}(?:人民政府(?:办公厅|办公室)?|委员会|部|局))关于[^。；]{8,180}?(?:通知|意见|决定|公告|规定|办法|方案|规划|措施))(?=国|[京津沪渝川粤浙苏鲁豫陕闽湘鄂冀晋皖赣桂琼黔滇藏甘青宁新黑吉辽蒙]|〔|$)/)?.[1]||null;
 const document_no=paragraphs.slice(0,6).find(p=>/^[\u4e00-\u9fff]{1,12}[〔\[（]20\d{2}[〕\]）]\s*\d{1,5}\s*号$/.test(p))||null;
 const signature=paragraphs.slice(-5).find(p=>/^(?:国务院(?:办公厅)?|[\u4e00-\u9fff]{2,24}人民政府(?:办公厅|办公室)?)$/.test(p))||null;
 return {status:partial?'partial':'text',text,paragraphs,message:partial?'正文部分留存；可能含分页、附件或截断':'已提取正文文字；不含图片和附件',issuer:issuer||signature,region:null,title,document_no};
}
export async function contentHash(text){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');}
export function validateArchives(catalog){
 if(!catalog||catalog.schema_version!==1||!catalog.records||Array.isArray(catalog.records)||typeof catalog.records!=='object')throw Error('正文留存目录结构无效');
 for(const [id,r] of Object.entries(catalog.records)){
  const source=SOURCE_MAP.get(r?.source_id);
  if(!r||r.article_id!==id||!source||!allowedUrl(r.source_url,source)||!Array.isArray(r.versions)||r.versions.length>1000||!r.last_attempt||!['text','partial','unavailable'].includes(r.last_attempt.status)||!Number.isFinite(Date.parse(r.last_attempt.captured_at)))throw Error('正文留存记录无效');
  const seen=new Set();for(const v of r.versions){if(!v||!['text','partial'].includes(v.status)||!/^[a-f0-9]{64}$/.test(v.content_hash)||v.id!==`${id}:${v.content_hash}`||seen.has(v.id)||!Number.isFinite(Date.parse(v.captured_at))||typeof v.text!=='string'||!v.text||v.text.length>ARCHIVE_MAX_TEXT||!Array.isArray(v.paragraphs)||v.paragraphs.some(p=>typeof p!=='string')||v.paragraphs.join('\n\n')!==v.text)throw Error('正文版本无效');seen.add(v.id);}
  if(r.latest_version_id!==undefined&&(r.latest_version_id!==null&&!seen.has(r.latest_version_id)||r.latest_version_id===null&&r.versions.length)||r.latest_captured_at!==undefined&&r.latest_captured_at!==null&&!Number.isFinite(Date.parse(r.latest_captured_at)))throw Error('当前正文版本指针无效');
  if(r.latest_status!==undefined&&r.latest_status!==null&&!['text','partial'].includes(r.latest_status))throw Error('当前正文完整性状态无效');
 }
 return catalog;
}
export async function recordArchive(catalog,article,result,{capturedAt=new Date().toISOString()}={}){
 validateArchives(catalog);const source=SOURCE_MAP.get(article.source_id);if(!source||!allowedUrl(article.url,source))throw Error('正文来源地址无效');
 const old=catalog.records[article.id];if(old&&(old.source_url!==article.url||old.source_id!==article.source_id))throw Error('正文条目身份冲突');
 const versions=[...(old?.versions||[])];let latest_version_id=latestArchiveVersion(old)?.id||null,latest_captured_at=old?.latest_captured_at||latestArchiveVersion(old)?.captured_at||null,latest_status=latestArchiveVersion(old)?.status||null;
 if(['text','partial'].includes(result.status)&&result.text){const hash=await contentHash(result.text),id=`${article.id}:${hash}`;if(!versions.some(v=>v.id===id))versions.push({id,content_hash:hash,captured_at:capturedAt,status:result.status,text:result.text,paragraphs:result.paragraphs,issuer:result.issuer||null,region:result.region||null,title:result.title||null,document_no:result.document_no||null});latest_version_id=id;latest_captured_at=capturedAt;}
 if(['text','partial'].includes(result.status)&&result.text)latest_status=result.status;
 const next={...catalog,generated_at:capturedAt,records:{...catalog.records,[article.id]:{article_id:article.id,source_id:article.source_id,source_url:article.url,versions,latest_version_id,latest_captured_at,latest_status,last_attempt:{captured_at:capturedAt,status:result.status,message:String(result.message||'').slice(0,500)}}}};return validateArchives(next);
}
export function selectArchiveCandidates(snapshot,catalog,{limit=12,now=new Date(),refreshDays=30}={}){
 validateArchives(catalog);
 const budget=Math.max(0,Math.min(100,Math.floor(limit)));
 const eligible=snapshot.articles.filter(a=>eligiblePolicy(a)&&SOURCE_MAP.get(a.source_id)?.enabled!==false).filter(a=>!/[.]pdf(?:$|[?])/i.test(a.url)).filter(a=>!catalog.records[a.id]||Date.parse(catalog.records[a.id].last_attempt.captured_at)<=new Date(now).getTime()-(catalog.records[a.id].last_attempt.status==='unavailable'?Math.min(1,refreshDays):refreshDays)*86400000);
 const oldest=(a,b)=>(catalog.records[a.id]?.last_attempt.captured_at||'').localeCompare(catalog.records[b.id]?.last_attempt.captured_at||'')||a.collected_at.localeCompare(b.collected_at)||a.id.localeCompare(b.id);
 const priority=a=>/实施方案|实施细则|行动方案|落实.*措施|申报指南/.test(a.title)?2:/规划|意见|办法/.test(a.title)?1:0;
 const preferred=[...eligible].sort((a,b)=>priority(b)-priority(a)||(b.published_at||'').localeCompare(a.published_at||'')||oldest(a,b));
 // Reserve one quarter for oldest eligible work so ordinary policies are not starved.
 const fair=budget>=4?Math.max(1,Math.floor(budget/4)):0,selected=preferred.slice(0,budget-fair),seen=new Set(selected.map(a=>a.id));
 for(const a of [...eligible].sort(oldest))if(selected.length<budget&&!seen.has(a.id)){selected.push(a);seen.add(a.id);}
 return selected;
}
