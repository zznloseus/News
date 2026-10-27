import {KEYWORD_GROUPS} from './keyword-config.mjs';
import {keywordWindow,validDay} from './keywords.mjs';
import {SOURCE_MAP,SOURCE_TYPES,CATEGORIES} from './sources.mjs';

export const WORKSPACE_KEY='policy-workspace-v3';
export const PAGE_SIZE=5;
export const DOMAINS=[...KEYWORD_GROUPS.filter(g=>g.id!=='other'),{id:'all',name:'全部动态'},{id:'other',name:'其他／未归类'}];
const ids=new Set(DOMAINS.map(g=>g.id));
const types=new Set(SOURCE_TYPES.map(t=>t.id));
const stages=new Set(['规划部署','政策发布','征求意见','资金申报','试点清单','政策解读','废止调整','项目采购','工作动态']);
const text=(v,max=150)=>typeof v==='string'?v.slice(0,max):'';
export function createWorkspace(now=new Date()){
 return {opened:DOMAINS.slice(0,6).map(g=>g.id),left:'technology',right:'environment',collapsed:false,counts:false,terms:{},pages:{},expanded:{},filters:{q:'',sources:[],source:'',stage:'',scope:'',category:'',days:30,rangeMode:'rolling',...keywordWindow(30,now),policy:true,sort:'published'}};
}
function slots(state){
 if(!state.opened.includes(state.left))state.left=state.opened[0]||'';
 if(!state.opened.includes(state.right)||state.right===state.left)state.right=state.opened.find(id=>id!==state.left)||'';
 return state;
}
function cleanFilters(value,base){
 const v=value&&typeof value==='object'?value:{};
 return {...base,rangeMode:v.rangeMode==='custom'?'custom':'rolling',q:text(v.q),sources:Array.isArray(v.sources)?[...new Set(v.sources.filter(t=>types.has(t)))]:base.sources,
  source:SOURCE_MAP.has(v.source)?v.source:'',stage:stages.has(v.stage)?v.stage:'',scope:['central','province'].includes(v.scope)?v.scope:'',category:CATEGORIES.includes(v.category)?v.category:'',days:[7,30,90].includes(v.days)?v.days:base.days,
  from:v.from===''?'':validDay(v.from)||base.from,to:v.to===''?'':validDay(v.to)||base.to,policy:typeof v.policy==='boolean'?v.policy:base.policy,sort:v.sort==='collected'?'collected':'published'};
}
function sanitize(value,now){
 const s=createWorkspace(now);if(!value||typeof value!=='object')return s;
 if(Array.isArray(value.opened))s.opened=[...new Set(value.opened.filter(id=>ids.has(id)))];
 s.left=ids.has(value.left)?value.left:s.left;s.right=ids.has(value.right)?value.right:s.right;
 s.collapsed=value.collapsed===true;s.counts=value.counts===true;s.filters=cleanFilters(value.filters,s.filters);
 if(s.filters.rangeMode==='rolling')Object.assign(s.filters,keywordWindow(s.filters.days,now));
 for(const id of ids){
  if(typeof value.terms?.[id]==='string')s.terms[id]=text(value.terms[id],40);
  if(Number.isInteger(value.pages?.[id])&&value.pages[id]>=1&&value.pages[id]<=100000)s.pages[id]=value.pages[id];
  if(typeof value.expanded?.[id]==='boolean')s.expanded[id]=value.expanded[id];
 }
 return slots(s);
}
/** @param {string} search @param {string|null} stored @param {Date} now */
export function restoreWorkspace(search='',stored=null,now=new Date()){
 const p=new URLSearchParams(search);let value;
 const raw=p.get('workspace');
 if(raw){try{if(raw.length<12000)value=JSON.parse(raw);}catch{}return sanitize(value,now);}
 const oldKeys=['q','source','stage','scope','category','from','to','keyword','kwdays','policy','sort','source_type'];
 if(oldKeys.some(k=>p.has(k))){
  const s=createWorkspace(now);const days=Number(p.get('kwdays'));if([7,30,90].includes(days))s.filters={...s.filters,days,...keywordWindow(days,now)};
  for(const key of ['q','source','stage','scope','category','from','to','sort'])if(p.has(key))s.filters[key]=p.get(key);
  if(p.has('from')||p.has('to'))s.filters.rangeMode='custom';
  s.filters.policy=p.get('policy')!=='0';s.filters.sources=p.getAll('source_type');
  if(p.get('keyword')||p.get('source')||p.get('category')){s.opened.push('all');s.left='all';if(p.get('keyword'))s.terms.all=p.get('keyword');}
  return sanitize(s,now);
 }
 try{value=typeof stored==='string'&&stored.length<12000?JSON.parse(stored):null;}catch{}
 return sanitize(value,now);
}
export function workspaceReducer(state,action){
 if(action.type==='reset')return createWorkspace();
 const next={...state,opened:[...state.opened],terms:{...state.terms},pages:{...state.pages},expanded:{...state.expanded}};
 const id=action.id;
 if(action.type==='toggleNav')next.collapsed=!state.collapsed;
 else if(action.type==='counts')next.counts=!state.counts;
 else if(action.type==='filters'){const patch={...action.patch};if(('from' in patch||'to' in patch)&&!patch.rangeMode)patch.rangeMode='custom';next.filters=cleanFilters({...state.filters,...patch},state.filters);next.pages={};}
 else if(action.type==='rollover'&&state.filters.rangeMode==='rolling'){const range=keywordWindow(state.filters.days,action.now||new Date());if(range.from===state.filters.from&&range.to===state.filters.to)return state;next.filters={...state.filters,...range};next.pages={};}
 else if(ids.has(id)){
  if(action.type==='open'){if(!next.opened.includes(id))next.opened.push(id);if(!next.left)next.left=id;else if(!next.right&&next.left!==id)next.right=id;else if(![next.left,next.right].includes(id)){next.left=id;}}
  else if(action.type==='close')next.opened=next.opened.filter(d=>d!==id);
  else if(action.type==='assign'&&next.opened.includes(id)){
   if(action.side==='left'){if(next.right===id)next.right=next.left;next.left=id;}
   else if(action.side==='right'){if(next.left===id)next.left=next.right||next.opened.find(d=>d!==id)||id;next.right=id;}
  }
  else if(action.type==='term'){next.terms[id]=text(action.term,40);next.pages[id]=1;}
  else if(action.type==='page'&&Number.isInteger(action.page)&&action.page>=1&&action.page<=100000)next.pages[id]=action.page;
  else if(action.type==='expand')next.expanded[id]=!state.expanded[id];
 }
 return slots(next);
}
export function workspaceSearch(state){return new URLSearchParams({workspace:JSON.stringify(state)}).toString();}
export function sharedParams(state){
 const f=state.filters,p=new URLSearchParams();
 for(const key of ['q','source','stage','scope','category','from','to','sort'])if(f[key])p.set(key,f[key]);
 for(const type of f.sources)p.append('source_type',type);
 p.set('range_mode',f.rangeMode||'rolling');p.set('policy',f.policy?'1':'0');return p;
}
export function paneParams(state,id){const p=sharedParams(state);p.set('domain',id);if(state.terms[id])p.set('keyword',state.terms[id]);p.set('page',String(state.pages[id]||1));return p;}
