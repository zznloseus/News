import {useState,useEffect} from 'react';
import {ChevronDown,ChevronUp,RefreshCw} from 'lucide-react';
import {keywordWindow} from '@/lib/keywords.mjs';

export type KeywordTag={term:string;group:string;count?:number;source_count?:number;is_new?:boolean;origin?:string};
type Props={overview:any;days:number;active:string;loading:boolean;error:string;rebuilt?:boolean;onDays:(days:number)=>void;onPick:(term:string)=>void;onRetry:()=>void};
const readable=(date:string)=>new Date(date).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});

export function KeywordTags({tags,onPick,active=''}:{tags:KeywordTag[];onPick:(term:string)=>void;active?:string}){
 if(!tags.length)return null;
 return <div className="keyword-tags" aria-label="内容关键词">{tags.map(tag=><button type="button" key={tag.term} className={`keyword-tag domain-${tag.group}`} aria-pressed={active===tag.term} onClick={()=>onPick(tag.term)}>{tag.term}</button>)}</div>;
}

export default function KeywordPanel({overview,days,active,loading,error,rebuilt,onDays,onPick,onRetry}:Props){
 const [expanded,setExpanded]=useState<Set<string>>(new Set());const [counts,setCounts]=useState(false);
 useEffect(()=>setExpanded(new Set()),[overview?.from,overview?.to]);
 const standard=keywordWindow(days);const custom=overview&&(overview.from!==standard.from||overview.to!==standard.to);
 const groups=overview?.groups?.filter((g:any)=>g.id!=='other'||g.keywords.length)||[];
 const toggle=(id:string)=>setExpanded(old=>{const next=new Set(old);if(next.has(id))next.delete(id);else next.add(id);return next;});
 return <section className="keyword-panel" aria-label="分领域政策关键词" aria-busy={loading&&!overview}>
  <div className="keyword-panel-head"><div><span className="keyword-eyebrow">POLICY FOCUS</span><h2>分领域关键词</h2></div><div className="keyword-periods" role="group" aria-label="关键词观察时间">{[7,30,90].map(value=><button type="button" key={value} aria-pressed={!custom&&days===value} onClick={()=>onDays(value)}>近{value}天</button>)}</div></div>
  {error&&<div className="keyword-error" role="alert">{error}<button type="button" onClick={onRetry}><RefreshCw size={13}/>重试</button></div>}
  {!overview&&!error?<div className="keyword-skeleton" role="status">正在分析已收录的政策标题…</div>:overview&&<>
   <div className="keyword-summary"><span>{overview.from} — {overview.to}{custom?' · 自定义时间':''}</span><span>{overview.keyword_count}个高频词 · {overview.document_count}份去重文件 · 涉及{overview.source_count}个来源</span></div>
   <div className="keyword-groups">{groups.map((group:any,index:number)=>{
    const open=expanded.has(group.id);const visible=open?group.keywords:group.keywords.slice(0,8);
    return <section key={group.id} className={`keyword-group domain-${group.id}`} aria-label={group.name}>
     <div className="keyword-group-head"><span className="keyword-group-index">{String(index+1).padStart(2,'0')}</span><h3>{group.name}</h3><span className="keyword-group-rule" aria-hidden="true"/></div>
     <div className="keyword-words">{visible.map((word:KeywordTag,i:number)=><button type="button" className={'keyword-word '+(i<2?'prominent':'')} key={word.term} aria-pressed={active===word.term} onClick={()=>onPick(word.term)} title={`${word.term}：${word.count}份去重文件，涉及${word.source_count}个来源${word.origin==='discovered'?'；自动发现词组':''}`} aria-label={`${word.term}，${word.count}份文件${word.is_new?'，本站新识别':''}`}>{word.term}{counts&&<span className="keyword-frequency">{word.count}</span>}{word.is_new&&<span className="keyword-new">新出现</span>}</button>)}</div>
     {!group.keywords.length&&<p className="keyword-group-empty">此时间范围内暂无达到展示门槛的词</p>}
     {group.keywords.length>8&&<button type="button" className="keyword-expand" aria-expanded={open} onClick={()=>toggle(group.id)}>{open?'收起':`再看${group.keywords.length-8}个词`}{open?<ChevronUp size={12}/>:<ChevronDown size={12}/>}</button>}
    </section>;
   })}</div>
   {!overview.document_count&&<p className="keyword-empty">这个时间范围内没有已识别发布日期的匹配文件，可扩大时间范围或调整筛选。</p>}
   <div className="keyword-panel-foot"><label className="keyword-count-toggle"><input type="checkbox" checked={counts} onChange={e=>setCounts(e.target.checked)}/>显示文件数量</label><span>{overview.snapshot_generated_at&&<>数据更新 {readable(overview.snapshot_generated_at)} · </>}{rebuilt?'即时分析':'分析更新'} {readable(overview.generated_at)}</span></div>
   <details className="keyword-method"><summary>统计口径与信息边界</summary><p>从标题识别关键词，统一明确的同义词；同标题、同年份的重复转载合并计数。同一文件可涉及多个主题，频度反映提及情况。预置专业词至少涉及2份文件；自动发现词需在当前范围内至少涉及3份去重文件、2个发布来源。各领域为辅助归类，无法确定的新词单独展示。</p><p>当前筛选中有{overview.excluded_dates}份文件缺少有效发布日期，另有{overview.future_dates}份标注未来日期，均未纳入近期统计。统计遵循上方时间、下方来源／领域／阶段和“政策与解读”筛选；自由搜索词不缩小概览。来源收录和日期识别并不完整，结果只代表本站已收录内容。</p><p>“新出现”表示本站最近7天首次识别并达到门槛；首次初始化不标新，不代表术语或政策首次出现。新词发现采用保守分词规则，可能遗漏专业术语，可在词库中补充。</p></details>
  </>}
 </section>;
}
