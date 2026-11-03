import {useEffect,useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {ReactNode,RefObject} from 'react';
import {BookOpen,MessageSquare,PanelRight,SquarePen,X} from 'lucide-react';
import {SOURCE_MAP} from '@/lib/sources.mjs';
import {saveBookmark,putNote,deleteNote,restoreNote} from './private-library';
import {policyIdentity} from '@/lib/relations.mjs';
import {readerVersions,currentReaderVersion,readerDraftKey,readerDrafts} from './reader-state.mjs';
import {paragraphAnnotations,quoteRange,readSelection} from './reader-annotations.mjs';
import type {Article} from './types';
import type {PrivateLibraryState,ArchiveVersion,LibraryNote} from './private-library';
export const time=(v?:string|null)=>v?new Date(v).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'尚无记录';
export type Mutate=(fn:(s:PrivateLibraryState)=>PrivateLibraryState)=>Promise<PrivateLibraryState>;
type Draft={editing:string;versionId:string;quote:string;quoteStart?:number|null;text:string};
type SelectionQuote={versionId:string;quote:string;quoteStart:number;top:number;left:number};
const blank=(versionId=''):Draft=>({editing:'',versionId,quote:'',quoteStart:null,text:''});

// A bottom sheet must escape the reader's CSS containment, but stay inside its
// modal dialog when present so native focus handling and the top layer still work.
function NotePanel({reader,id,open,resetKey,onClose,children}:{reader:RefObject<HTMLElement|null>;id:string;open:boolean;resetKey:string;onClose:()=>void;children:ReactNode}){
 const [host,setHost]=useState<HTMLElement|null>(null);
 const panelRef=useRef<HTMLElement>(null);
 useLayoutEffect(()=>{
  const element=reader.current;if(!element)return;
  const resize=()=>setHost(element.clientWidth<=740?(element.closest<HTMLElement>('dialog')||element.closest<HTMLElement>('#policy-v4-home-refined')):null);
  resize();const observer=new ResizeObserver(resize);observer.observe(element);return()=>observer.disconnect();
 },[reader]);
 useLayoutEffect(()=>{const content=panelRef.current?.querySelector('.v4-note-panel-body');if(open&&content)content.scrollTop=0;},[open,resetKey,host]);
 useEffect(()=>{
  if(!open)return;
  const input=panelRef.current?.querySelector('textarea'),content=panelRef.current?.querySelector('.v4-note-panel-body');
  input?.focus({preventScroll:true});
  if(input&&content&&input.getBoundingClientRect().bottom>content.getBoundingClientRect().bottom)content.scrollTop+=Math.max(0,input.getBoundingClientRect().top-content.getBoundingClientRect().top-12);
 },[open,resetKey,host]);
 useEffect(()=>{
  if(!host)return;const viewport=window.visualViewport;
  const resize=()=>{panelRef.current?.style.setProperty('--note-keyboard-offset',Math.max(0,window.innerHeight-(viewport?.height||window.innerHeight)-(viewport?.offsetTop||0))+'px');panelRef.current?.style.setProperty('--note-visible-height',(viewport?.height||window.innerHeight)+'px');};
  resize();viewport?.addEventListener('resize',resize);viewport?.addEventListener('scroll',resize);
  return()=>{viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);};
 },[host]);
 const panel=<aside ref={panelRef} id={id} className="v4-note-panel" data-sheet={!!host} aria-label="阅读笔记" hidden={!open} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}}}>{children}</aside>;
 return host?createPortal(panel,host):panel;
}

export default function ArchiveReader({article:a,archives,library,mutate,onRemove,onTrace,initialNote}:{article:Article;archives:any;library:PrivateLibraryState|null;mutate:Mutate;onRemove?:(a:Article)=>void;onTrace?:(id:string)=>void;initialNote?:string}){
 const [tab,setTab]=useState('text'),[versionId,setVersion]=useState('');
 const [open,setOpen]=useState(false),[composing,setComposing]=useState(false),[active,setActive]=useState('');
 const [draft,setDraft]=useState<Draft>(blank()),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[undo,setUndo]=useState('');
 const [selection,setSelection]=useState<SelectionQuote|null>(null),[,refresh]=useState(0);
 const root=useRef<HTMLElement>(null),body=useRef<HTMLDivElement>(null),editor=useRef<HTMLTextAreaElement>(null),toggle=useRef<HTMLButtonElement>(null);
 const panelId=useId(),drafts=useRef<Map<string,Draft>>(readerDrafts.get(a.id)||new Map()),currentDraft=useRef<Draft|null>(null),live=useRef(true);
 const position=useRef<{node:HTMLElement;top:number}|null>(null),pendingLocate=useRef<LibraryNote|null>(null),handledInitial=useRef('');
 readerDrafts.set(a.id,drafts.current);
 const bookmark=library?.bookmarks.find(b=>b.article.id===a.id),record=archives?.records[a.id];
 const versions:ArchiveVersion[]=useMemo(()=>readerVersions(record,bookmark),[record,bookmark]);
 const currentVersion:ArchiveVersion|undefined=currentReaderVersion(record,bookmark),version=versions.find(v=>v.id===versionId)||currentVersion;
 const identity=(policyIdentity as any)(a,version);
 const notes=useMemo(()=>library?.notes.filter(n=>n.article_id===a.id&&!n.deleted_at)||[],[library,a.id]);
 const activeNote=notes.find(n=>n.id===active)||notes[0];
 const paragraphs=useMemo(()=>paragraphAnnotations(version,notes),[version,notes]);
 const original=notes.find(n=>n.id===draft.editing);
 const dirty=draft.editing?!!original&&draft.text!==original.text:!!draft.text.trim();
 currentDraft.current=dirty?draft:null;
 useEffect(()=>{
  live.current=true;
  const warn=(e:BeforeUnloadEvent)=>{if(currentDraft.current||drafts.current.size){e.preventDefault();e.returnValue='';}};
  window.addEventListener('beforeunload',warn);
  return()=>{live.current=false;if(currentDraft.current)drafts.current.set(readerDraftKey(currentDraft.current),currentDraft.current);window.removeEventListener('beforeunload',warn);};
 },[]);
 function stash(){if(currentDraft.current)drafts.current.set(readerDraftKey(currentDraft.current),currentDraft.current);}
 function updateDraft(text:string){
  const next={...draft,text},changed=next.editing?text!==original?.text:!!text.trim();
  if(changed)drafts.current.set(readerDraftKey(next),next);else drafts.current.delete(readerDraftKey(next));
  setDraft(next);
 }
 function rememberPosition(){
  const top=Math.max(0,root.current?.closest('dialog')?.getBoundingClientRect().top||0)+65;
  const node=[...(body.current?.querySelectorAll<HTMLElement>('[data-reader-paragraph]')||[])].find(p=>p.getBoundingClientRect().bottom>top);
  if(node)position.current={node,top:node.getBoundingClientRect().top};
 }
 function sidebar(value:boolean){rememberPosition();setOpen(value);setSelection(null);if(!value){stash();toggle.current?.focus({preventScroll:true});}}
 function adjustScroll(node:HTMLElement,delta:number){
  let parent=node.parentElement;
  while(parent){if(/auto|scroll/.test(getComputedStyle(parent).overflowY)&&parent.scrollHeight>parent.clientHeight){parent.scrollTop+=delta;return;}parent=parent.parentElement;}
  window.scrollBy({top:delta,behavior:'instant'});
 }
 useLayoutEffect(()=>{
  const saved=position.current;position.current=null;
  if(saved?.node.isConnected)adjustScroll(saved.node,saved.node.getBoundingClientRect().top-saved.top);
 },[open]);
 function startDraft(next:Draft){stash();setDraft(drafts.current.get(readerDraftKey(next))||next);setComposing(true);sidebar(true);setNotice('');refresh(n=>n+1);}
 function newNote(){if(dirty&&draft.versionId===(version?.id||'')){setComposing(true);sidebar(true);return;}startDraft(blank(version?.id));}
 function selectNote(note:LibraryNote){stash();setActive(note.id);setComposing(false);sidebar(true);}
 function editNote(note:LibraryNote){startDraft({editing:note.id,versionId:note.version_id||'',quote:note.quote,quoteStart:note.quote_start??null,text:note.text});}
 useEffect(()=>{
  if(!initialNote||handledInitial.current===initialNote)return;
  const note=notes.find(n=>n.id===initialNote);if(!note)return;
  handledInitial.current=initialNote;selectNote(note);
 },[initialNote,notes]);
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>;
  const read=()=>{
   const selected=window.getSelection(),value=readSelection(body.current,version,selected);
   if(!value||busy||!library){setSelection(null);return;}
   const range=selected!.getRangeAt(0),area=body.current!.getBoundingClientRect();
   const dialog=root.current?.closest('dialog')?.getBoundingClientRect(),toolbar=root.current?.querySelector('.v4-reading-bar')?.getBoundingClientRect();
   const visibleTop=Math.max(0,dialog?.top||0,toolbar?.bottom||0)+6,visibleBottom=Math.min(window.innerHeight,dialog?.bottom||window.innerHeight)-8;
   const rect=[...range.getClientRects()].filter(r=>r.bottom>visibleTop&&r.top<visibleBottom).at(-1)||range.getBoundingClientRect();
   const top=Math.max(visibleTop,Math.min(rect.top-46,visibleBottom-42));
   setSelection({...value,top:Math.max(0,top-area.top),left:Math.max(0,Math.min(rect.left-area.left,area.width-152))});
  };
  const change=()=>{clearTimeout(timer);timer=setTimeout(read,120);};
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&selection){e.preventDefault();e.stopPropagation();setSelection(null);window.getSelection()?.removeAllRanges();}};
  document.addEventListener('selectionchange',change);document.addEventListener('scroll',change,true);window.addEventListener('resize',change);root.current?.addEventListener('keyup',change);root.current?.addEventListener('keydown',escape);
  const el=root.current;
  return()=>{clearTimeout(timer);document.removeEventListener('selectionchange',change);document.removeEventListener('scroll',change,true);window.removeEventListener('resize',change);el?.removeEventListener('keyup',change);el?.removeEventListener('keydown',escape);};
 },[version,busy,library,selection!==null]);
 function annotate(){if(!selection)return;const {versionId,quote,quoteStart}=selection;startDraft({editing:'',versionId,quote,quoteStart,text:''});window.getSelection()?.removeAllRanges();}
 async function perform(fn:(s:PrivateLibraryState)=>PrivateLibraryState,done:()=>void){
  setBusy(true);setNotice('');
  try{await mutate(fn);done();}catch(e){if(live.current)setNotice(e instanceof Error?e.message:'写入失败；原有资料保留');}finally{if(live.current)setBusy(false);}
 }
 function saveNote(){
  if(!draft.text.trim())return;
  const id=draft.editing||crypto.randomUUID(),key=readerDraftKey(draft);
  const note={id,article_id:a.id,version_id:draft.versionId||null,quote:draft.quote,...(draft.quoteStart!=null?{quote_start:draft.quoteStart}:{}),text:draft.text};
  void perform(s=>putNote(saveBookmark(s,a,record||null),note),()=>{drafts.current.delete(key);currentDraft.current=null;setDraft(blank(version?.id));setActive(id);setComposing(false);setNotice('笔记已保存于本机');});
 }
 function removeNote(note:LibraryNote){
  void perform(s=>deleteNote(s,note.id),()=>{
   for(const [key,value] of drafts.current)if(value.editing===note.id)drafts.current.delete(key);
   if(draft.editing===note.id){currentDraft.current=null;setDraft(blank(version?.id));}
   setUndo(note.id);setActive('');setNotice('笔记已删除，可撤销');
  });
 }
 function locate(note:LibraryNote){
  const target=versions.find(v=>v.id===note.version_id),range=quoteRange(target,note);
  if(!range){setNotice(note.quote?'这条旧批注无法唯一定位，引用原文仍保留在笔记中。':'这是一条整篇笔记，没有指定引用位置。');return;}
  pendingLocate.current=note;setVersion(target!.id);setTab('text');setActive(note.id);
  if(root.current&&root.current.clientWidth<740)sidebar(false);
  refresh(n=>n+1);
 }
 useLayoutEffect(()=>{
  const note=pendingLocate.current;if(!note||tab!=='text')return;pendingLocate.current=null;
  const range=quoteRange(version,note);if(!range)return;
  const index=paragraphs.findIndex((p:any,i:number)=>range.start>=p.start&&range.start<p.start+version!.paragraphs[i].length);
  const node=body.current?.querySelector<HTMLElement>(`[data-reader-paragraph="${index}"]`);
  if(node){const top=Math.max(0,root.current?.closest('dialog')?.getBoundingClientRect().top||0)+90;adjustScroll(node,node.getBoundingClientRect().top-top);node.focus({preventScroll:true});}
 });
 function changeVersion(id:string){stash();setVersion(id);setSelection(null);setTab('text');setComposing(false);setActive('');}
 const draftRows=[...drafts.current.entries()];
 const feedback=<>{notice&&<p className="v4-status" role="status">{notice}</p>}{undo&&<button type="button" className="p4-button" disabled={busy} onClick={()=>void perform(s=>restoreNote(s,undo),()=>{setActive(undo);setUndo('');setNotice('笔记已恢复');})}>撤销删除笔记</button>}</>;
 return <article ref={root} className="v4-reader" data-notes-open={open}>
  <header className="r-dochead"><div className="p4-meta"><span>{a.stage}</span><span className={'p4-badge '+(version?.status==='partial'?'p4-pending':'')}>{version?.status==='text'?'正文文字已留存':version?.status==='partial'?'正文部分留存':'正文未留存'}</span></div><h2>{a.title}</h2><p>{a.published_at||'发布日期未识别'}{a.document_no&&` · ${a.document_no}`}</p></header>
  <div className="v4-reader-meta"><span>发布网站：{SOURCE_MAP.get(a.source_id)?.name}</span><span>实际发文机关：{identity.issuer||'未明确识别'}</span><span>地区：{identity.region||'未明确识别'}</span></div>
  <div className="f-reader-buttons"><a className="p4-button" href={a.url} target="_blank" rel="noopener noreferrer">打开来源原文 ↗</a><button type="button" className="p4-button" disabled={busy||!library} onClick={()=>void perform(s=>saveBookmark(s,a,record||null),()=>setNotice('收藏及可用文字版本已保存于本机'))}>{bookmark?'更新本机留存':'收藏并留存'}</button>{bookmark&&onRemove&&<button type="button" disabled={busy} className="p4-button" onClick={()=>onRemove(a)}>移除收藏…</button>}{onTrace&&<button type="button" className="p4-button" onClick={()=>onTrace(a.id)}>查看引用脉络 ↗</button>}</div>
  <div className="v4-reading-bar">
   <div className="v4-reading-tabs" role="group" aria-label="文件阅读内容"><button type="button" aria-pressed={tab==='text'} onClick={()=>setTab('text')}>留存文字</button><button type="button" aria-pressed={tab==='info'} onClick={()=>setTab('info')}>当前信息</button></div>
   <div className="v4-reading-actions"><button ref={toggle} type="button" className="p4-button" aria-expanded={open} aria-controls={panelId} disabled={busy} onClick={()=>sidebar(!open)}><PanelRight size={15}/>笔记 · {notes.length}{dirty||draftRows.length?' / 草稿':''}</button><button type="button" className="p4-button" disabled={!library||busy} onClick={newNote}><SquarePen size={15}/>写笔记</button>{open&&<button type="button" className="v4-focus-reading" disabled={busy} onClick={()=>sidebar(false)}><BookOpen size={15}/>专注阅读</button>}</div>
  </div>
  <div className="v4-reading-layout">
   <div className="v4-reading-document">
    {tab==='info'?<div className="v4-info"><p>首次收录：{time(a.collected_at)}</p><p>最近正文尝试：{time(record?.last_attempt?.captured_at)}</p><p>{record?.last_attempt?.message||'此条目尚未取得可留存的正文文字。媒体来源仅收录公开索引与链接。'}</p>{a.excerpt&&<blockquote>{a.excerpt}<small>来源页面公开简介摘录，不是完整正文。</small></blockquote>}</div>:<>
     <div className="f-version"><label>文字版本 <select aria-label="文字留存版本" value={version?.id||''} disabled={!versions.length||busy} onChange={e=>changeVersion(e.target.value)}>{!versions.length&&<option value="">无可用版本</option>}{versions.map(v=><option key={v.id} value={v.id}>{time(v.captured_at)} · {v.content_hash.slice(0,8)}{v.id===currentVersion?.id?' · 当前来源版本':''}{bookmark?.versions.some(x=>x.id===v.id)?' · 本机副本':''}</option>)}</select></label></div>
     <p className="v4-scope">{version?.id===currentVersion?.id&&(record?.latest_captured_at||bookmark?.latest_captured_at)&&<>最近确认：{time(record?.versions?.length?record.latest_captured_at:bookmark?.latest_captured_at)} · </>}正文文字留存 · 不含图片、附件；请核对来源原文。{version?.status==='partial'?'此版本可能存在分页或截断，请勿视为完整正文。':''}</p>
     {record?.last_attempt?.status==='unavailable'&&version&&<p className="v4-error">最近刷新失败，仍显示此前留存版本。{record.last_attempt.message}</p>}
     {version?<><p className="v4-selection-hint">选中文字后写批注 · 页边数字对应已有笔记</p><div ref={body} className="v4-reading-copy">
      {paragraphs.map((p:any,i:number)=><section className="v4-reading-paragraph" key={version.id+':'+i}>
       <p data-reader-paragraph={i} tabIndex={-1}>{p.parts.map((part:any,j:number)=>part.ids.length?<mark key={j} data-active={part.ids.includes(active)}>{part.text}</mark>:<span key={j}>{part.text}</span>)}</p>
       {!!p.matches.length&&<div className="v4-margin-marks" aria-label={`第${i+1}段批注`}>{p.matches.map((m:any)=><button type="button" key={m.note.id} aria-label={`查看第${m.number}条批注`} aria-pressed={open&&activeNote?.id===m.note.id} disabled={busy} onClick={()=>selectNote(m.note)}>{m.number}</button>)}</div>}
      </section>)}
      {selection&&<div className="v4-selection-menu" role="group" aria-label="选文操作" style={{top:selection.top,left:selection.left}} onMouseDown={e=>e.preventDefault()}><button type="button" onClick={annotate}><SquarePen size={15}/>写批注</button><button type="button" aria-label="取消选择" onClick={()=>{setSelection(null);window.getSelection()?.removeAllRanges();}}><X size={14}/></button></div>}
     </div></>:<div className="p4-empty"><p>{archives?'尚无可靠正文文字可供留存。':'正文目录暂不可用；公开索引和本机副本仍可阅读。'}</p><p>{record?.last_attempt?.message||'请通过来源原文核对文件。'}</p></div>}
    </>}
   </div>
   <NotePanel reader={root} id={panelId} open={open} resetKey={`${composing}:${activeNote?.id}:${draft.editing}:${draft.quoteStart}:${draft.quote}`} onClose={()=>{if(!busy)sidebar(false);}}>
    <header><h3><MessageSquare size={16}/>{composing?'写笔记':'阅读笔记'} <small>{notes.length}</small></h3><button type="button" aria-label="收起笔记" disabled={busy} onClick={()=>sidebar(false)}><X size={18}/></button></header>
    <div className="v4-note-panel-body">
     {!!draftRows.length&&<label className="v4-draft-picker">未保存草稿（本次访问）<select aria-label="恢复未保存草稿" value="" disabled={busy} onChange={e=>{const saved=drafts.current.get(e.target.value);if(saved)startDraft(saved);}}><option value="">继续草稿 · {draftRows.length}条</option>{draftRows.map(([key,value])=><option key={key} value={key}>{value.editing?'编辑':'新笔记'} · {value.text.slice(0,30)||'空白修改'}</option>)}</select></label>}
     {composing?<section className="v4-note-composer"><h4>{draft.editing?'编辑批注':draft.quote?'引用批注':'整篇笔记'}</h4><p className="v4-note-version">{draft.versionId?`关联版本 ${draft.versionId.split(':').at(-1)?.slice(0,8)}`:'关联条目信息'}</p>{draft.quote&&<blockquote>{draft.quote}</blockquote>}<label htmlFor={panelId+'-editor'} className="v4-note-label">你的观察</label><textarea id={panelId+'-editor'} ref={editor} aria-label="阅读笔记" placeholder="记录你的观察与待核对事项" maxLength={20000} value={draft.text} onChange={e=>updateDraft(e.target.value)} disabled={!library||busy}/><div className="v4-actions"><button type="button" className="p4-button p4-primary" disabled={!library||busy||!draft.text.trim()} onClick={saveNote}>{busy?'正在保存…':'保存笔记'}</button><button type="button" disabled={busy} onClick={()=>{sidebar(false);setNotice(dirty?'草稿已保留，可在本次访问中继续。':'');}}>收起</button></div></section>:activeNote?<section className="v4-note-detail"><div className="v4-note-detail-title"><span>{String(notes.indexOf(activeNote)+1).padStart(2,'0')} · {activeNote.quote?'引用批注':'整篇笔记'}</span><small>{time(activeNote.updated_at)}</small></div>{activeNote.quote&&<blockquote>{activeNote.quote}</blockquote>}<p className="v4-note-text">{activeNote.text}</p><p className="v4-note-version">{activeNote.version_id?`关联版本 ${activeNote.version_id.split(':').at(-1)?.slice(0,8)}`:'关联条目信息'}{activeNote.version_id&&activeNote.version_id!==version?.id?' · 与正在阅读的版本不同':''}</p><div className="v4-actions">{activeNote.quote&&<button type="button" disabled={busy} onClick={()=>locate(activeNote)}>定位原文 ↗</button>}<button type="button" disabled={busy||!library} onClick={()=>editNote(activeNote)}>编辑</button><button type="button" disabled={busy} onClick={()=>removeNote(activeNote)}>删除</button></div></section>:<div className="v4-note-empty"><p>还没有阅读笔记</p><span>选中正文中的一句话写批注，或点击「写笔记」记录整篇观察。</span></div>}
     <div className="v4-note-summaries">{notes.filter(n=>composing||n.id!==activeNote?.id).map(n=><button type="button" key={n.id} disabled={busy} onClick={()=>selectNote(n)}><span>{String(notes.indexOf(n)+1).padStart(2,'0')} · {n.quote?'引用批注':'整篇笔记'}</span><strong>{n.text}</strong></button>)}</div>
     <p className="v4-note-privacy">笔记仅保存于当前浏览器。未保存草稿仅在本次访问中保留。</p>
     {open&&feedback}
    </div>
   </NotePanel>
  </div>
  {!open&&feedback}
 </article>;
}
