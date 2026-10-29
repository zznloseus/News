// Initial context may walk upstream; explicit later selections are never rewritten.
export function initialRelationRoot(edges,id){
 const visited=new Set();let current=id;
 while(current&&!visited.has(current)){visited.add(current);const parent=edges.find(e=>e.to===current)?.from;if(!parent||visited.has(parent))break;current=parent;}
 return current;
}
export function relationSelection(nodes,edges,matchingIds,rootId,selectedId,startId=''){
 const matching=nodes.filter(n=>n.policy_eligible===true&&matchingIds.has(n.id));
 const candidates=matching.filter(n=>edges.some(e=>e.from===n.id)||!edges.some(e=>e.to===n.id));
 const requested=rootId||initialRelationRoot(edges,startId);
 // Related/unmatched files can be opened independently, even when their parent is filtered out.
 const root=matching.find(n=>n.id===requested)||matching.find(n=>n.id===startId)||candidates[0]||matching[0];
 const descendants=[],visited=new Set(root?[root.id]:[]);
 function walk(id,depth){for(const e of edges.filter(e=>e.from===id)){if(visited.has(e.to))continue;visited.add(e.to);descendants.push({...e,depth});walk(e.to,depth+1);}}
 if(root)walk(root.id,1);
 const chosen=visited.has(selectedId)?selectedId:visited.has(startId)?startId:root?.id;
 return {matching,candidates:root&&!candidates.some(n=>n.id===root.id)?[root,...candidates]:candidates,root,descendants,chosen,evidence:edges.find(e=>e.to===chosen&&visited.has(e.from))};
}
