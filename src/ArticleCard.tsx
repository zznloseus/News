import {ArrowUpRight,Bookmark} from 'lucide-react';
import {SOURCE_MAP,sourceTypeName} from '@/lib/sources.mjs';
import {getArticleKeywords} from '@/lib/keywords.mjs';
import {KeywordTags} from './KeywordPanel';
import type {Article} from './types';

type Props={article:Article;index:any;date?:string|null;active?:string;saved:boolean;onSave:(a:Article)=>void;onOpen:(a:Article)=>void;onKeyword:(term:string)=>void};
export default function ArticleCard({article:a,index,date,active,saved,onSave,onOpen,onKeyword}:Props){
 const day=date===undefined?a.published_at:date;
 return <article className="policy-card" data-article-id={a.id}>
  <div className="policy-card-meta"><span title={day||'日期未标注'}>{day?day.slice(5).replace('-','.'):'日期未标注'}</span><span aria-hidden="true">·</span><span>{sourceTypeName(a.source_id)}</span><span className={'stage '+(a.stage==='征求意见'?'stage-draft':'')}>{a.stage}</span></div>
  <button className="policy-card-title" onClick={()=>onOpen(a)}>{a.title}</button>
  <KeywordTags tags={getArticleKeywords(index,a.id)} active={active} onPick={onKeyword}/>
  <div className="policy-card-foot"><span>{SOURCE_MAP.get(a.source_id)?.name||a.source_id}</span><div><button type="button" onClick={()=>onSave(a)} aria-label={saved?'取消收藏':'收藏政策'} aria-pressed={saved} title={saved?'取消收藏':'收藏政策'}><Bookmark size={15} fill={saved?'currentColor':'none'}/></button><a href={a.url} target="_blank" rel="noopener noreferrer" aria-label="打开官方原文" title="打开官方原文"><ArrowUpRight size={16}/></a></div></div>
 </article>;
}
