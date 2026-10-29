import {DOMAINS,createWorkspace,restoreWorkspace,workspaceReducer,sharedParams} from './workspace.mjs';
export const HOME_KEY='policy-home-v4';
export const HOME_DOMAINS=DOMAINS.filter(g=>g.id!=='all');
const ids=HOME_DOMAINS.map(g=>g.id);
export function createHome(now=new Date()){return {...createWorkspace(now),domains:[...ids],mode:'timeline',wall:true,page:1,word:'',wordDomain:'',filters:{...createWorkspace(now).filters,lens:'government'}};}
/** @param {string} search @param {string|null} stored @param {Date} now */
export function restoreHome(search='',stored=null,now=new Date()){
 const p=new URLSearchParams(search),hasLegacy=['workspace','keyword','q','source','stage','scope','category','from','to','kwdays','policy','sort','source_type'].some(k=>p.has(k));let raw;try{const text=p.has('home')?p.get('home'):hasLegacy?null:stored;if(text&&text.length<20000)raw=JSON.parse(text);}catch{}
 const base=createHome(now);if(!raw){const legacy=restoreWorkspace(search,null,now);return {...base,...legacy,word:(p.get('keyword')||'').slice(0,40),wordDomain:p.get('keyword')?'other':'',filters:{...legacy.filters,lens:'government'}};}
 const v=restoreWorkspace('?workspace='+encodeURIComponent(JSON.stringify(raw)),null,now);
 return {...base,...v,domains:Array.isArray(raw.domains)?[...new Set(raw.domains.filter(x=>ids.includes(x)))]:base.domains,mode:raw.mode==='columns'?'columns':'timeline',wall:raw.wall!==false,page:Number.isInteger(raw.page)&&raw.page>0?Math.min(raw.page,100000):1,word:typeof raw.word==='string'?raw.word.slice(0,40):'',wordDomain:ids.includes(raw.wordDomain)?raw.wordDomain:'',filters:{...v.filters,lens:['government','media','all'].includes(raw.filters?.lens)?raw.filters.lens:'government'}};
}
export function homeReducer(s,a){
 if(a.type==='restore')return restoreHome('',JSON.stringify(a.value));
 if(a.type==='reset')return createHome();
 if(a.type==='mode')return {...s,mode:a.value==='columns'?'columns':'timeline'};
 if(a.type==='wall')return {...s,wall:!s.wall};
 if(a.type==='domains')return {...s,domains:a.value.filter(id=>ids.includes(id)),page:1};
 if(a.type==='domain'&&ids.includes(a.id))return {...s,domains:s.domains.includes(a.id)?s.domains.filter(id=>id!==a.id):[...s.domains,a.id],page:1};
 if(a.type==='homePage')return {...s,page:Math.max(1,Math.min(100000,a.page))};
 if(a.type==='word')return {...s,domains:s.domains.includes(a.id)?s.domains:[...s.domains,a.id],word:s.word===a.term?'':String(a.term).slice(0,40),wordDomain:a.id,page:1};
 const next=workspaceReducer(s,a);return {...next,filters:{...next.filters,lens:a.type==='filters'&&['government','media','all'].includes(a.patch.lens)?a.patch.lens:s.filters.lens},page:['filters','rollover'].includes(a.type)?1:s.page};
}
export function overviewParams(s){const p=sharedParams(s);p.delete('q');p.set('lens',s.filters.lens);return p;}
/** @param {any} s @param {string|null} id */
export function homeParams(s,id=null){const p=sharedParams(s);p.set('lens',s.filters.lens);if(id)p.set('domain',id);else if(s.domains.length===ids.length)p.set('domain','all');else if(!s.domains.length)p.set('domain','__none__');else for(const id of s.domains)p.append('domain',id);const word=id?s.terms[id]:s.word;if(word)p.set('keyword',word);p.set('page',String(id?s.pages[id]||1:s.page));return p;}
export function homeSearch(s){return new URLSearchParams({home:JSON.stringify(s)}).toString();}
