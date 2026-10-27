import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../lib/workspace.mjs';
const at=new Date('2026-10-27T04:00:00Z');
const make=()=>model.createWorkspace(at);
const act=(s,a)=>model.workspaceReducer(s,a);
test('assignment swaps opposite panes and retains independent reading state',()=>{
 let s=make();s=act(s,{type:'term',id:'technology',term:'人工智能'});s=act(s,{type:'page',id:'technology',page:3});s=act(s,{type:'assign',id:'environment',side:'left'});
 assert.equal(s.left,'environment');assert.equal(s.right,'technology');assert.equal(s.terms.technology,'人工智能');assert.equal(s.pages.technology,3);
 s=act(s,{type:'toggleNav'});assert.equal(s.collapsed,true);assert.equal(s.pages.technology,3);
});
test('closing and reopening all domains preserves terms and produces distinct valid slots',()=>{
 let s=make();s=act(s,{type:'term',id:'technology',term:'人工智能'});for(const id of [...s.opened])s=act(s,{type:'close',id});assert.deepEqual(s.opened,[]);assert.equal(s.left,'');assert.equal(s.right,'');
 s=act(s,{type:'open',id:'technology'});assert.equal(s.left,'technology');assert.equal(s.right,'');assert.equal(s.terms.technology,'人工智能');s=act(s,{type:'open',id:'all'});assert.equal(new Set([s.left,s.right]).size,2);
});
test('shared filters reset pagination without clearing per-domain keywords',()=>{
 let s=act(make(),{type:'page',id:'environment',page:4});s=act(s,{type:'term',id:'technology',term:'人工智能'});s=act(s,{type:'filters',patch:{sources:['media','local'],q:'试点'}});assert.deepEqual(s.pages,{});assert.equal(s.terms.technology,'人工智能');assert.deepEqual(s.filters.sources,['media','local']);
});
test('share roundtrip preserves slots, terms, pages, time and collapsed state',()=>{
 let s=act(make(),{type:'assign',id:'society',side:'right'});s=act(s,{type:'toggleNav'});s=act(s,{type:'term',id:'society',term:'养老服务'});s=act(s,{type:'page',id:'society',page:2});assert.deepEqual(model.restoreWorkspace(model.workspaceSearch(s),null,at),s);
});
test('untrusted storage and URL fields are bounded, normalized and cannot inject domains',()=>{
 const s=model.restoreWorkspace('',JSON.stringify({opened:['technology','technology','bad'],left:'bad',right:'technology',collapsed:'yes',terms:{technology:'人工智能',bad:'x'},pages:{technology:-9},filters:{sources:['media','invalid','media'],source:'evil',days:500,q:42}}),at);
 assert.deepEqual(s.opened,['technology']);assert.equal(s.left,'technology');assert.equal(s.right,'');assert.equal(s.collapsed,false);assert.equal(s.pages.technology,undefined);assert.deepEqual(s.filters.sources,['media']);assert.equal(s.filters.source,'');assert.equal(s.filters.days,30);
 assert.doesNotThrow(()=>model.restoreWorkspace('?workspace=%7Bbroken','{broken',at));assert.deepEqual(model.restoreWorkspace('?workspace='+encodeURIComponent('{"opened":[]}'),null,at).opened,[]);
});
test('URL takes precedence over storage and old keyword/source links remain usable',()=>{
 const stored=JSON.stringify(act(make(),{type:'term',id:'technology',term:'人工智能'}));const s=model.restoreWorkspace('?q=储能&keyword=新型储能&kwdays=7&source=nea&policy=0',stored,at);assert.equal(s.filters.q,'储能');assert.equal(s.filters.source,'nea');assert.equal(s.filters.days,7);assert.equal(s.filters.from,'2026-10-21');assert.equal(s.filters.policy,false);assert.equal(s.left,'all');assert.equal(s.terms.all,'新型储能');
});
test('pane params combine shared filters with only that domain term and page',()=>{
 let s=act(make(),{type:'term',id:'technology',term:'人工智能'});s=act(s,{type:'page',id:'technology',page:2});s=act(s,{type:'filters',patch:{sources:['media','local']}});const p=model.paneParams(s,'technology');assert.equal(p.get('domain'),'technology');assert.equal(p.get('keyword'),'人工智能');assert.equal(p.get('page'),'1');assert.deepEqual(p.getAll('source_type'),['media','local']);assert.equal(model.paneParams(s,'environment').get('keyword'),null);
});

test('preset windows roll forward on restore while custom calendar ranges remain fixed',()=>{
 const s=make();const tomorrow=new Date('2026-10-28T04:00:00Z');const rolling=model.restoreWorkspace('',JSON.stringify(s),tomorrow);assert.equal(rolling.filters.to,'2026-10-28');assert.equal(rolling.filters.from,'2026-09-29');
 const custom=act(s,{type:'filters',patch:{from:'2026-10-01',to:'2026-10-10'}});const fixed=model.restoreWorkspace('',JSON.stringify(custom),tomorrow);assert.equal(fixed.filters.to,'2026-10-10');
});

test('a custom range equal to preset dates stays explicitly custom and does not roll',()=>{
 const original=make(),s=act(original,{type:'filters',patch:{from:original.filters.from,to:original.filters.to}});assert.equal(s.filters.rangeMode,'custom');
 const next=act(s,{type:'rollover',now:new Date('2026-10-28T04:00:00Z')});assert.equal(next.filters.to,'2026-10-27');assert.equal(model.sharedParams(next).get('range_mode'),'custom');
 const rolling=act(original,{type:'rollover',now:new Date('2026-10-28T04:00:00Z')});assert.equal(rolling.filters.to,'2026-10-28');
});
