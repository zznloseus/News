import test from 'node:test';
import assert from 'node:assert/strict';
import {relationSelection,initialRelationRoot} from '../src/relations-state.mjs';
const nodes=['A','B','C','D'].map(id=>({id,policy_eligible:true}));
const edges=[{from:'A',to:'B'},{from:'B',to:'C'}];
test('explicit intermediate and related selection stays selected',()=>{
 const ids=new Set(nodes.map(n=>n.id));
 assert.equal(relationSelection(nodes,edges,ids,'B','B').root.id,'B');
 assert.equal(relationSelection(nodes,edges,new Set(['C','D']),'C','C').chosen,'C');
});
test('deep-link leaf opens in complete upstream context, only archive-qualified policies appear',()=>{
 assert.equal(initialRelationRoot(edges,'C'),'A');
 assert.equal(relationSelection(nodes,edges,new Set(['A','B','C']),'','C','C').chosen,'C');
 const n=[...nodes,{id:'report',policy_eligible:false},{id:'extractedTitle',policy_eligible:true}];
 const matching=relationSelection(n,edges,new Set(n.map(n=>n.id)),'','').matching;
 assert(!matching.some(n=>n.id==='report'));assert(matching.some(n=>n.id==='extractedTitle'));
});
