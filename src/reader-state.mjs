import {latestArchiveVersion} from '../lib/archive.mjs';

/** Display order never determines currentness: an actual source may revert A → B → A. */
export function readerVersions(record,bookmark){
 const rows=new Map();
 for(const version of [...(bookmark?.versions||[]),...(record?.versions||[])])rows.set(version.id,version);
 const current=currentReaderVersion(record,bookmark);
 if(current)rows.set(current.id,current);
 return [...rows.values()].sort((a,b)=>a.captured_at.localeCompare(b.captured_at));
}
export function currentReaderVersion(record,bookmark){
 return record?.versions?.length?latestArchiveVersion(record):latestArchiveVersion(bookmark);
}
export const readerDraftKey=({editing='',versionId='',quote=''})=>JSON.stringify([editing,versionId,quote]);
// Unfinished text survives switching articles/views in this visit. It is never published.
export const readerDrafts=new Map();
