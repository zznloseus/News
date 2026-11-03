// Helpers for exact-version text selections and annotation anchors.
export function quoteRange(version,note){
 if(!version||note.version_id!==version.id||!note.quote)return null;
 const start=note.quote_start??version.text.indexOf(note.quote);
 if(!Number.isInteger(start)||start<0||version.text.slice(start,start+note.quote.length)!==note.quote)return null;
 if(note.quote_start==null&&version.text.indexOf(note.quote,start+1)!==-1)return null;
 return {start,end:start+note.quote.length};
}

/** Read only paragraph text, excluding margin buttons and toolbar labels. */
export function readSelection(container,version,selection){
 if(!container||!version||!selection?.rangeCount||selection.isCollapsed)return null;
 const range=selection.getRangeAt(0);
 if(!container.contains(range.startContainer)||!container.contains(range.endContainer))return null;
 let start=null,end=null,offset=0;
 for(const paragraph of container.querySelectorAll('[data-reader-paragraph]')){
  const text=paragraph.textContent||'';
  if(range.intersectsNode(paragraph)){
   const part=paragraph.ownerDocument.createRange();part.selectNodeContents(paragraph);
   let from=0;
   if(paragraph.contains(range.startContainer)){
    const prefix=part.cloneRange();prefix.setEnd(range.startContainer,range.startOffset);from=prefix.toString().length;
    part.setStart(range.startContainer,range.startOffset);
   }
   if(paragraph.contains(range.endContainer))part.setEnd(range.endContainer,range.endOffset);
   const length=part.toString().length;
   if(length){if(start===null)start=offset+from;end=offset+from+length;}
  }
  offset+=text.length+2;
 }
 if(start===null||end===null)return null;
 while(start<end&&/\s/.test(version.text[start]))start++;
 while(end>start&&/\s/.test(version.text[end-1]))end--;
 if(start===end)return null;
 return {quote:version.text.slice(start,end),quoteStart:start,versionId:version.id};
}

export function paragraphAnnotations(version,notes){
 let offset=0;
 const ranges=notes.map((note,index)=>({note,number:index+1,range:quoteRange(version,note)})).filter(x=>x.range);
 return (version?.paragraphs||[]).map(text=>{
  const start=offset,end=start+text.length;offset=end+2;
  const matches=ranges.filter(x=>x.range.end>start&&x.range.start<end);
  const points=[...new Set([0,text.length,...matches.flatMap(x=>[Math.max(0,x.range.start-start),Math.min(text.length,x.range.end-start)])])].sort((a,b)=>a-b);
  return {start,matches,parts:points.slice(0,-1).map((p,i)=>({text:text.slice(p,points[i+1]),ids:matches.filter(x=>x.range.start<start+points[i+1]&&x.range.end>start+p).map(x=>x.note.id)}))};
 });
}
