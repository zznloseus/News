export function sourceHealth(snapshot,sources,now=new Date()){
 const timestamp=now.getTime(),valid=value=>Number.isFinite(Date.parse(value))&&Date.parse(value)<=timestamp;
 const rows=sources.map(source=>{
  const health=snapshot?.health?.[source.id]||{};
  const eligible=source.enabled!==false&&source.access==='public';
  const anomaly=!!(health.checked_at&&!valid(health.checked_at)||health.last_success_at&&!valid(health.last_success_at));
  const stale=eligible&&(!valid(health.last_success_at)||timestamp-Date.parse(health.last_success_at)>86400000);
  return {...source,...health,eligible,anomaly,stale,consecutive_failures:health.consecutive_failures??null,successful:eligible&&!anomaly&&valid(health.checked_at)&&timestamp-Date.parse(health.checked_at)<=86400000&&['ok','partial'].includes(health.status)};
 });
 const runs=[...(snapshot?.runs||[])].sort((a,b)=>(b.started_at||'').localeCompare(a.started_at||''));
 return {rows,eligible:rows.filter(r=>r.eligible).length,successful:rows.filter(r=>r.successful).length,stale:rows.filter(r=>r.stale).length,failed:rows.filter(r=>r.eligible&&['error','empty'].includes(r.status)).length,anomalies:rows.filter(r=>r.anomaly||r.count_drop||r.consecutive_failures>=3).length,job_started_at:runs[0]?.started_at||null,job_finished_at:runs[0]?.finished_at||null,snapshot_at:snapshot?.generated_at||null};
}
