import test from 'node:test';
import assert from 'node:assert/strict';
import {contentHashSync} from '../lib/archive.mjs';
import {emptyLibrary,saveBookmark,putNote,exportLibrary,parseLibraryBackup,mergeLibraries} from '../lib/library.mjs';
import {readerDraftKey} from '../src/reader-state.mjs';
import * as annotations from '../src/reader-annotations.mjs';

const at='2026-11-03T00:00:00Z';
const a={id:'selection',source_id:'gov',url:'https://www.gov.cn/zhengce/selection.htm',title:'关于推进产业发展的意见',collected_at:at};
const paragraphs=['支持中试平台。完善公共服务。','支持中试平台。落实具体任务。'];
const text=paragraphs.join('\n\n'),hash=contentHashSync(text),version={id:a.id+':'+hash,content_hash:hash,captured_at:at,status:'text',text,paragraphs};
const base=()=>saveBookmark(emptyLibrary(),a,{article_id:a.id,source_id:a.source_id,source_url:a.url,versions:[version]});
test('sentence and cross-paragraph quotes survive backup and remain bound to their exact version',()=>{
 let state=base();
 state=putNote(state,{id:'sentence',article_id:a.id,version_id:version.id,quote:'支持中试平台',quote_start:16,text:'第二处引用'});
 state=putNote(state,{id:'across',article_id:a.id,version_id:version.id,quote:'公共服务。\n\n支持中试',quote_start:9,text:'跨段笔记'});
 const restored=parseLibraryBackup(exportLibrary(state));
 assert.equal(restored.notes[0].quote_start,16);assert.equal(restored.notes[1].quote_start,9);
 assert.equal(restored.notes[1].quote,'公共服务。\n\n支持中试');
 assert.deepEqual(mergeLibraries(base(),restored).notes,restored.notes);
});
test('bad offsets, forged quotes and changes to existing quote anchors are rejected',()=>{
 for(const quote_start of [-1,1,1.5,999])assert.throws(()=>putNote(base(),{article_id:a.id,version_id:version.id,quote:'支持中试平台',quote_start,text:'笔记'}));
 assert.throws(()=>putNote(base(),{article_id:a.id,version_id:version.id,quote:'不存在的正文',text:'笔记'}));
 const state=putNote(base(),{id:'one',article_id:a.id,version_id:version.id,quote:'支持中试平台',quote_start:0,text:'笔记'});
 assert.throws(()=>putNote(state,{...state.notes[0],quote_start:16}));
 assert.throws(()=>mergeLibraries(state,{...state,notes:[{...state.notes[0],quote_start:16}]}));
});
test('legacy whole-paragraph notes remain readable and duplicate-text drafts do not overwrite one another',()=>{
 const state=putNote(base(),{article_id:a.id,version_id:version.id,quote:paragraphs[0],text:'旧版笔记'});
 assert.equal(parseLibraryBackup(exportLibrary(state)).notes[0].quote,paragraphs[0]);
 assert.notEqual(readerDraftKey({versionId:version.id,quote:'支持中试平台',quoteStart:0}),readerDraftKey({versionId:version.id,quote:'支持中试平台',quoteStart:16}));
});
test('quote markers use version and offset, never guess among repeated legacy quotes',()=>{
 assert.equal(typeof annotations.quoteRange,'function');
 assert.deepEqual(annotations.quoteRange(version,{version_id:version.id,quote:'支持中试平台',quote_start:16}),{start:16,end:22});
 assert.equal(annotations.quoteRange(version,{version_id:version.id,quote:'支持中试平台'}),null);
 assert.equal(annotations.quoteRange(version,{version_id:'other',quote:'完善公共服务'}),null);
 assert.deepEqual(annotations.quoteRange(version,{version_id:version.id,quote:'完善公共服务'}),{start:7,end:13});
});
test('overlapping cross-paragraph marks preserve original text and identify both notes',()=>{
 const notes=[
  {id:'cross',version_id:version.id,quote:'公共服务。\n\n支持中试',quote_start:9},
  {id:'inside',version_id:version.id,quote:'中试平台',quote_start:18},
  {id:'old',version_id:'old-version',quote:'落实具体任务'}
 ];
 const rendered=annotations.paragraphAnnotations(version,notes);
 assert.deepEqual(rendered.map(p=>p.parts.map(x=>x.text).join('')),paragraphs);
 assert.deepEqual(rendered[1].parts,[{text:'支持',ids:['cross']},{text:'中试',ids:['cross','inside']},{text:'平台',ids:['inside']},{text:'。落实具体任务。',ids:[]}]);
 assert.deepEqual(rendered[1].matches.map(m=>m.number),[1,2]);
});
test('editing an anchored note preserves its old text version after current source changes',()=>{
 let state=putNote(base(),{id:'old',article_id:a.id,version_id:version.id,quote:'支持中试平台',quote_start:16,text:'初稿'});
 const nextText='新版正文，仅保留一处说明。',nextHash=contentHashSync(nextText),next={...version,id:a.id+':'+nextHash,content_hash:nextHash,text:nextText,paragraphs:[nextText],captured_at:'2026-11-04T00:00:00Z'};
 state=saveBookmark(state,a,{article_id:a.id,source_id:a.source_id,source_url:a.url,versions:[version,next]});
 state=putNote(state,{...state.notes[0],text:'更新后的观察'});
 const restored=parseLibraryBackup(exportLibrary(state));
 assert.equal(restored.notes[0].version_id,version.id);
 assert.equal(restored.notes[0].quote_start,16);
 assert.equal(annotations.quoteRange(next,restored.notes[0]),null);
 assert.deepEqual(annotations.quoteRange(version,restored.notes[0]),{start:16,end:22});
});
