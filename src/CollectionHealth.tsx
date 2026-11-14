import {useEffect,useMemo,useState} from 'react';
import {SOURCES} from '@/lib/sources.mjs';
import {sourceHealth} from '@/lib/source-health.mjs';
import {time} from './ArchiveReader';
export default function CollectionHealth({snapshot}:{snapshot:any}){
 const report=useMemo(()=>sourceHealth(snapshot,SOURCES),[snapshot]);
 const [deployment,setDeployment]=useState<any>(null);
 useEffect(()=>{let active=true;fetch(new URL('data/deployment.json',new URL(import.meta.env.BASE_URL,document.baseURI)),{cache:'no-store'}).then(async response=>{if(response.ok){const value=await response.json();if(active)setDeployment(value);}}).catch(()=>{});return()=>{active=false;};},[snapshot?.generated_at]);
 const issues=report.rows.filter((r:any)=>r.eligible&&(r.stale||r.anomaly||r.count_drop||['error','empty'].includes(r.status)));
 return <details className="v43-health"><summary>数据状态 · 近24小时 {report.successful}/{report.eligible} 个可采集来源解析成功 · {report.stale} 个来源超过24小时无成功记录</summary><dl><div><dt>最近任务完成</dt><dd>{time(report.job_finished_at)}</dd></div><div><dt>当前快照生成</dt><dd>{time(report.snapshot_at)}</dd></div><div><dt>页面构建</dt><dd>{time(deployment?.built_at)}{deployment?.code_revision&&' · 代码 '+String(deployment.code_revision).slice(0,8)}</dd></div></dl><p>解析成功不代表全部内容完整收录。任务未启动或部署失败时，本页保留上一次发布的记录；失败次数从新版本开始累计。</p>{deployment?.run_url&&/^https:\/\/github\.com\/zznloseus\/News\/actions\/runs\/\d+$/.test(deployment.run_url)&&<a href={deployment.run_url} target="_blank" rel="noopener noreferrer">查看本次发布任务 ↗</a>}{issues.length?<ul>{issues.map((r:any)=><li key={r.id}><strong>{r.name}</strong><span>{r.anomaly?'日期异常':r.count_drop?'解析条数较上次成功下降超过70%':r.consecutive_failures>=3?`连续失败 ${r.consecutive_failures} 轮`:r.status==='error'?'最近采集失败':r.status==='empty'?'最近未解析到文章':'超过24小时无成功记录'}</span><small>最近成功：{time(r.last_success_at)} · 最近尝试：{time(r.checked_at)}</small><small>{r.message}</small></li>)}</ul>:<p>当前没有需关注的来源异常。</p>}</details>;
}
