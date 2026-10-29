import {emptyLibrary,validateLibrary,migrateLegacy,mergeLibraries,parseLibraryBackup,exportLibrary} from './library.mjs';
import {contentHash} from './archive.mjs';

function storageError(error){return Error(error?.name==='QuotaExceededError'?'浏览器存储空间不足；本次修改未保存，请导出备份':`本机资料库读写失败：${error?.message||error}。原有数据已保留，可下载原始备份恢复。`);}
export async function openPrivateLibrary({indexedDB=globalThis.indexedDB,legacyStorage=globalThis.localStorage,databaseName='policy-private-library'}={}){
 if(!indexedDB)throw Error('此浏览器不支持 IndexedDB；请使用可用浏览器保存私有资料');
 const db=await new Promise((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('library'))request.result.createObjectStore('library');};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(storageError(request.error));request.onblocked=()=>reject(Error('资料库升级被其他标签页阻塞；请关闭旧标签后重试'));});
 db.onversionchange=()=>db.close();let queue=Promise.resolve();
 const enqueue=task=>{const pending=queue.then(task);queue=pending.catch(()=>{});return pending;};
 function transaction(mutator,{raw=false}={}){return new Promise((resolve,reject)=>{
  let tx,value,reason;try{tx=db.transaction('library',raw?'readonly':'readwrite');const store=tx.objectStore('library'),request=store.get('state');
   request.onsuccess=()=>{try{if(raw){value=request.result??null;return;}let current=request.result===undefined?emptyLibrary():validateLibrary(request.result);
    if(!current.legacy_migrated){const legacy=legacyStorage?.getItem('policy-saved');if(legacy!==null&&legacy!==undefined){let parsed;try{parsed=JSON.parse(legacy);}catch{throw Error('旧收藏JSON损坏；已保留 policy-saved 原始值');}current=mergeLibraries(current,migrateLegacy(parsed));}else current={...current,legacy_migrated:true};}
    value=validateLibrary(mutator?mutator(current):current);if(value?.then)throw Error('资料库修改函数必须同步返回');store.put(value,'state');
   }catch(error){reason=error;tx.abort();}};
   request.onerror=()=>{reason=request.error;};tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(storageError(reason||tx.error));tx.onerror=()=>{reason=reason||tx.error;};
  }catch(error){reject(storageError(error));}
 });}
 return {
  read:()=>enqueue(()=>transaction()),
  // Each updater reads the current state inside the same readwrite transaction. No stale caller snapshot is written.
  update:mutator=>enqueue(()=>transaction(mutator)),
  exportBackup:()=>enqueue(async()=>exportLibrary(await transaction())),
  importBackup:text=>enqueue(async()=>{const incoming=parseLibraryBackup(text);for(const b of incoming.bookmarks)for(const v of b.versions)if(await contentHash(v.text)!==v.content_hash)throw Error('备份正文哈希不匹配；原有资料未改变');return transaction(current=>mergeLibraries(current,incoming));}),
  recoverRaw:()=>enqueue(async()=>({schema_version:1,recovery_only:true,indexeddb:await transaction(null,{raw:true}),legacy:legacyStorage?.getItem('policy-saved')??null})),
  // Explicit recovery only: caller first offers recoverRaw() download and user chooses replacement.
  replaceForRecovery:state=>enqueue(async()=>{const safe=validateLibrary(state);for(const b of safe.bookmarks)for(const v of b.versions)if(await contentHash(v.text)!==v.content_hash)throw Error('备份正文哈希不匹配');return new Promise((resolve,reject)=>{const tx=db.transaction('library','readwrite');tx.objectStore('library').put({...safe,legacy_migrated:true},'state');tx.oncomplete=()=>resolve({...safe,legacy_migrated:true});tx.onabort=()=>reject(storageError(tx.error));tx.onerror=()=>{};});}),
  close:()=>db.close()
 };
}
