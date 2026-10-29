import {isMediaSource} from './sources.mjs';

export function cleanText(s=''){
 return s.replace(/<!--[\s\S]*?-->/g,' ').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&#(\d+);/g,(_,n)=>{const c=Number(n);return c>0&&c<1114112?String.fromCodePoint(c):'';}).replace(/&(?:nbsp|ensp|emsp);/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&ldquo;/g,'“').replace(/&rdquo;/g,'”').replace(/&lsquo;/g,'‘').replace(/&rsquo;/g,'’').replace(/&hellip;/g,'…').replace(/&mdash;/g,'—').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
}
export function extractDocumentNo(html){return cleanText(html).match(/(?:发文字号|文号)\s*[：:]?\s*([\u4e00-\u9fff]{1,12}(?:〔|\[|（)20\d{2}(?:〕|\]|）)\s*\d{1,5}\s*号)/)?.[1]||null;}
export function extractDate(s=''){
 const m=s.match(/(20\d{2})\s*[-年/.]\s*(\d{1,2})\s*[-月/.]\s*(\d{1,2})/)||s.match(/\/n1\/(20\d{2})\/(\d{2})(\d{2})\//)||s.match(/(?:^|[\/_-])(20\d{2})(\d{2})(\d{2})(?:[\/_\-.]|$)/);if(!m)return null;
 const y=+m[1],mo=+m[2],d=+m[3];const date=new Date(Date.UTC(y,mo-1,d));
 if(date.getUTCFullYear()!==y||date.getUTCMonth()!==mo-1||date.getUTCDate()!==d)return null;
 return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
export function detectStage(title){
 if(/征求意见|征集意见|草案/.test(title))return '征求意见';
 if(/招标|中标|成交|拍卖|招租|挂牌|采购项目|采购公告/.test(title))return '项目采购';
 if(/招聘|拟聘|任免|任职资格|人事任命/.test(title))return '工作动态';
 if(/废止|失效|停止执行/.test(title))return '废止调整';
 if(/解读|答记者问|吹风会/.test(title))return '政策解读';
 if(/申报|申请|征集|资金|预算|拨付/.test(title))return '资金申报';
 if(/试点|示范|名单|目录|清单/.test(title))return '试点清单';
 if(/规划|行动方案|实施方案|指导意见|工作要点/.test(title))return '规划部署';
 if(/办法|规定|条例|标准|通知|公告|决定|意见|印发/.test(title))return '政策发布';
 return '工作动态';
}
export function allowedUrl(value,source){
 try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&(!u.port||['80','443'].includes(u.port))&&source.hosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h));}catch{return false;}
}
export function canonicalUrl(value){const u=new URL(value);u.hash='';for(const k of [...u.searchParams.keys()])if(/^(utm_|from$|sourceChannelId|spm)/i.test(k))u.searchParams.delete(k);return u.href;}
export function isArticleTitle(title){return title.length>=10&&title.length<=240&&/[\u4e00-\u9fff]/.test(title)&&!/\{\{|\}\}|^(?:ISO|IEC)标准化|(?:组织机构|对口单位查询)$|^(首页|更多|返回|联系我们|网站地图|无障碍|点击进入|网站声明|网站标识)/.test(title);}
export function parseListing(html,base,source){
 if(source.id==='nfra'&&html.trim().startsWith('{')){try{const data=JSON.parse(html);return (Array.isArray(data.data)?data.data:[]).filter(d=>isArticleTitle(cleanText(d.docTitle||d.docSubtitle||''))&&d.docId&&d.itemId).map(d=>{const title=cleanText(d.docTitle||d.docSubtitle);return {url:`https://www.nfra.gov.cn/cn/view/pages/ItemDetail.html?docId=${encodeURIComponent(d.docId)}&itemId=${encodeURIComponent(d.itemId)}`,title,published_at:extractDate(d.publishDate||''),stage:detectStage(title),source_id:source.id,category:source.category,excerpt:cleanText(d.docSummary||'').slice(0,180),document_no:null};}).slice(0,70);}catch{return [];}}
 const rows=new Map();const regex=/<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;let match;
 while((match=regex.exec(html))){
  const attrs=match[1],hm=attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i);if(!hm)continue;
  let url;try{url=canonicalUrl(new URL(hm[1].replace(/&amp;/g,'&'),base).href);}catch{continue;}
  if(!allowedUrl(url,source)||/\.(jpg|png|gif|svg|zip|mp4|css|js)(\?|$)/i.test(url))continue;
  const tm=attrs.match(/\btitle\s*=\s*["']([^"']+)["']/i),heading=match[2].match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1];const title=cleanText(tm?.[1]||heading||match[2]);
  if(!isArticleTitle(title))continue;
  const path=new URL(url).pathname;
  if(!/\.s?html?$|\.pdf$|\/art\/|\/contents?\/|\/detail|\/newsDetail_forward_\d+|\/c\/\w+|\/t\d{6}|\/c_\d|\/20\d{2}\//i.test(path)&&!new URL(url).search)continue;
  if(isMediaSource(source.id)&&!/(?:政策|国务院|政府|部委|财政|央行|税务|监管|发改|工信|商务部|规划|条例|办法|通知|意见|改革|民生|产业|经济|金融|科技|能源|消费|就业|教育|医疗|养老|环保|农业|投资)/.test(title))continue;
  if(isMediaSource(source.id)&&/特朗普|美国|俄罗斯|以色列|乌克兰|伊朗|日本|韩国/.test(title)&&!/中国|我国|国务院|国内|全国|北京|上海|粤港澳|两岸/.test(title))continue;
  const tail=html.slice(regex.lastIndex,regex.lastIndex+140).split(/<a\b/i)[0];
  const date=extractDate(cleanText(tail))||extractDate(url)||null;
  if(date&&date>new Date(Date.now()+86400000).toISOString().slice(0,10))continue;
  if(!rows.has(url))rows.set(url,{url,title,published_at:date,stage:source.category==='项目与采购'?'项目采购':detectStage(title),source_id:source.id,category:source.category,excerpt:'',document_no:null});
 }
 return [...rows.values()].slice(0,70);
}
export async function fetchPage(url,source,timeout=11000,outerSignal,beforeRequest){
 if(!allowedUrl(url,source))throw new Error('来源域名不在允许范围');
 let current=url;
 for(let redirects=0;redirects<4;redirects++){
  if(beforeRequest)await beforeRequest(current);
  const signal=outerSignal?AbortSignal.any([outerSignal,AbortSignal.timeout(timeout)]):AbortSignal.timeout(timeout);
  const r=await fetch(current,{redirect:'manual',headers:{'User-Agent':'PolicyObservatory/1.0 (public-policy-index; respectful hourly collection)','Accept':'text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.2'},signal});
  if(r.status>=300&&r.status<400){const location=r.headers.get('location');if(!location)throw new Error('无效跳转');current=new URL(location,current).href;if(!allowedUrl(current,source))throw new Error('跨域跳转未获允许');continue;}
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  const type=r.headers.get('content-type')||'';if(!/text|json|xml|html/i.test(type)&&type)throw new Error('非网页响应');
  if(Number(r.headers.get('content-length')||0)>3000000)throw new Error('页面超过采集大小上限');
  const reader=r.body?.getReader();const chunks=[];let size=0;
  if(reader){while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>3000000){await reader.cancel();throw new Error('页面超过采集大小上限');}chunks.push(value);}}
  const bytes=new Uint8Array(size);let p=0;for(const c of chunks){bytes.set(c,p);p+=c.length;}
  const first=new TextDecoder().decode(bytes.slice(0,2000));const charset=(type+' '+first).match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]||'utf-8';let html;try{html=new TextDecoder(/gb2312|gbk|gb18030/i.test(charset)?'gb18030':charset).decode(bytes);}catch{html=new TextDecoder().decode(bytes);}
  if(html.length<3000&&!current.endsWith('/robots.txt')){
   const target=html.match(/http-equiv\s*=\s*["']refresh["'][^>]*content\s*=\s*["'][^"']*?url=([^"'>;]+)/i)?.[1]||html.match(/(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/i)?.[1];
   if(target){const next=new URL(target.trim(),current).href;if(next!==current&&allowedUrl(next,source)){current=next;continue;}}
  }
  if((/captcha|访问验证|人机验证|访问过于频繁|访问被拒绝|access denied|安全验证/i.test(html)&&html.length<25000)||(html.length<100&&!current.endsWith('/robots.txt')))throw new Error('访问限制或验证页面');
  return {html,url:current};
 }
 throw new Error('页面跳转次数过多');
}
function robotsRules(text){
 const groups=[];let group={agents:[],rules:[]},hasRules=false;
 for(const line of text.split(/\r?\n/)){const [key,...rest]=line.split(':'),name=key.trim().toLowerCase(),val=rest.join(':').split('#')[0].trim();if(name==='user-agent'){if(hasRules){groups.push(group);group={agents:[],rules:[]};hasRules=false;}group.agents.push(val.toLowerCase());}else if(group.agents.length&&['allow','disallow','crawl-delay'].includes(name)){hasRules=true;group.rules.push([name,val]);}}
 groups.push(group);const specific=groups.filter(g=>g.agents.some(a=>a!=='*'&&'policyobservatory'.includes(a)));return (specific.length?specific:groups.filter(g=>g.agents.includes('*'))).flatMap(g=>g.rules);
}
export function robotsAllowed(text,url){
 const parsed=new URL(url),path=parsed.pathname+parsed.search,matching=[];
 for(const [kind,value] of robotsRules(text)){if(!value||!['allow','disallow'].includes(kind))continue;const end=value.endsWith('$'),pattern=(end?value.slice(0,-1):value).replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*');try{if(new RegExp('^'+pattern+(end?'$':'')).test(path))matching.push({kind,length:value.replace(/\*/g,'').length});}catch{}}
 matching.sort((a,b)=>b.length-a.length||(a.kind==='allow'?-1:1));return !matching.length||matching[0].kind==='allow';
}
export function robotsDelay(text){return Math.max(0,...robotsRules(text).filter(([kind])=>kind==='crawl-delay').map(([,n])=>Number.isFinite(+n)?Math.min(3600000,+n*1000):0));}
const robotCache=new Map(),nextRequest=new Map();
export async function fetchPermittedPage(url,source,{timeout=11000,signal,maxDelayMs=10000}={}){
 return fetchPage(url,source,timeout,signal,async current=>{
  const origin=new URL(current).origin;
  if(!robotCache.has(origin))robotCache.set(origin,(async()=>{try{return (await fetchPage(origin+'/robots.txt',source,5000,signal)).html;}catch(e){if(/HTTP 404|HTTP 410/.test(e.message))return '';throw Error('无法确认 robots.txt：'+e.message);}})());
  const robots=await robotCache.get(origin);if(!robotsAllowed(robots,current))throw Error('robots.txt 禁止采集该路径');
  const wait=Math.max(0,(nextRequest.get(origin)||0)-Date.now());if(wait>maxDelayMs)throw Error(`遵守 crawl-delay，${Math.ceil(wait/1000)}秒后才能再次访问；本轮暂缓`);
  nextRequest.set(origin,Date.now()+wait+robotsDelay(robots));
  if(wait)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},wait),abort=()=>{clearTimeout(timer);reject(Error('采集已取消'));};if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});});
 });
}
export async function crawlSource(source,{details=true,signal}={}){
 const checked_at=new Date().toISOString();const errors=[];const pages=[];const rows=new Map();
 if(source.enabled===false||source.access==='authorization-required')return {source_id:source.id,checked_at,status:'empty',count:0,message:'此来源未启用自动采集',pages,articles:[]};
 for(const url of source.feeds.slice(0,2)){
  if(signal?.aborted){errors.push('来源采集达到时间上限');break;}
  try{const page=await fetchPermittedPage(url,source,{timeout:11000,signal});pages.push(page.url);for(const row of parseListing(page.html,page.url,source))if(!rows.has(row.url))rows.set(row.url,row);}catch(e){errors.push(String(e.message).slice(0,160));}
 }
 const articles=[...rows.values()].sort((a,b)=>(b.published_at||'').localeCompare(a.published_at||'')).slice(0,70);
 if(details&&!isMediaSource(source.id)){for(const article of articles.filter(x=>x.stage!=='工作动态'&&!/\.pdf($|\?)/i.test(x.url)).slice(0,2)){
  if(signal?.aborted)break;
  try{const {html}=await fetchPermittedPage(article.url,source,{timeout:7000,signal});const meta=html.match(/<meta\s+[^>]*name=["'](?:description|ArticleDescription)["'][^>]*content=["']([^"']*)["']/i)?.[1];const body=html.match(/<(?:div|article)[^>]*(?:id|class)=["'][^"']*(?:TRS_Editor|article-content|article_content|content-body|pages_content|viewTRS|detail-content)[^"']*["'][^>]*>([\s\S]*?)(?:<\/article>|<\/div>)/i)?.[1];
   const text=cleanText(meta||body||'');article.excerpt=text.length>30?text.slice(0,180):'';
   const pub=html.match(/<meta\s+[^>]*name=["'](?:PubDate|publishdate|firstpublishedtime|published_date)["'][^>]*content=["']([^"']*)["']/i)?.[1];if(pub)article.published_at=extractDate(pub)||article.published_at;
   article.document_no=extractDocumentNo(html);
  }catch{}
 }}
 return {source_id:source.id,checked_at,status:articles.length?(errors.length?'partial':'ok'):(pages.length?'empty':'error'),count:articles.length,message:articles.length?(errors.join('；')||`已解析 ${articles.length} 条公开索引`):(errors.join('；')||'网页可访问，但未解析到文章；可能需要动态接口适配'),pages,articles};
}
