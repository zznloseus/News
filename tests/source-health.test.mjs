import test from 'node:test';import assert from 'node:assert/strict';
import {sourceHealth} from '../lib/source-health.mjs';
test('health distinguishes stale source successes from a recently finished job',()=>{
 const report=sourceHealth({generated_at:'2026-11-15T08:00:00Z',runs:[{started_at:'2026-11-15T07:00:00Z',finished_at:'2026-11-15T08:00:00Z'}],health:{gov:{status:'error',checked_at:'2026-11-15T08:00:00Z',last_success_at:'2026-11-10T08:00:00Z',consecutive_failures:4}}},[{id:'gov',enabled:true,access:'public'}],new Date('2026-11-15T09:00:00Z'));
 assert.equal(report.stale,1);assert.equal(report.failed,1);assert.equal(report.job_finished_at,'2026-11-15T08:00:00Z');assert.equal(report.rows[0].last_success_at,'2026-11-10T08:00:00Z');
});
test('disabled/unauthorized sources stay out of success denominator and future timestamps are invalid',()=>{
 const report=sourceHealth({health:{a:{status:'ok',count:12,checked_at:'2099-01-01T00:00:00Z',last_success_at:'2099-01-01T00:00:00Z'}}},[{id:'a',enabled:true,access:'public'},{id:'b',enabled:false},{id:'c',enabled:true,access:'authorization-required'}],new Date('2026-11-15'));
 assert.equal(report.eligible,1);assert.equal(report.successful,0);assert.equal(report.rows[0].anomaly,true);
});

test('collector retains last success, increments failures, and detects real count drops',async()=>{
 const {mergeCollection,emptySnapshot}=await import('../lib/dataset.mjs');
 const rows=Array.from({length:10},(_,i)=>({url:`https://www.gov.cn/zhengce/${i}.htm`,title:`国务院关于推进第${i}项产业发展的通知`,published_at:'2026-11-15'}));
 let snapshot=await mergeCollection(emptySnapshot(),[{source_id:'gov',status:'ok',articles:rows,checked_at:'2026-11-15T00:00:00Z'}]);
 for(let i=1;i<=3;i++)snapshot=await mergeCollection(snapshot,[{source_id:'gov',status:'error',articles:[],checked_at:`2026-11-15T0${i}:00:00Z`}]);
 assert.equal(snapshot.health.gov.consecutive_failures,3);assert.equal(snapshot.health.gov.last_success_at,'2026-11-15T00:00:00.000Z');
 snapshot=await mergeCollection(snapshot,[{source_id:'gov',status:'partial',articles:rows.slice(0,1),checked_at:'2026-11-15T04:00:00Z'}]);
 assert.equal(snapshot.health.gov.consecutive_failures,0);assert.equal(snapshot.health.gov.count_drop,true);assert.equal(snapshot.health.gov.last_good_count,1);assert.equal(snapshot.articles.length,10);
});
