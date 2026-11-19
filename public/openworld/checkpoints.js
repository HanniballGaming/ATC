/* FUNKSPRUCH – two rotating world checkpoints. ELS saves remain independent. */
(function(root){"use strict";
const KEY="funkspruch-openworld-save-v1",BACKUP=KEY+"-backup";
function plausible(data){
 return data&&typeof data==="object"&&[1,2].includes(data.version)&&data.player&&
  [data.player.x,data.player.z,data.player.heading,data.player.pitch].every(Number.isFinite);
}
function candidates(storage=root.localStorage){
 const found=[];
 for(const [source,key] of [["current",KEY],["backup",BACKUP]]){
  try{
   const raw=storage.getItem(key);
   if(!raw)continue;
   const data=JSON.parse(raw);
   if(plausible(data))found.push({source,world:data});
  }catch(error){console.warn("Schicht-Sicherung konnte nicht gelesen werden",source,error);}
 }
 return found;
}
function save(world,storage=root.localStorage){
 if(!plausible(world))throw Error("Ungültiger Weltzustand kann nicht gespeichert werden");
 const serialized=JSON.stringify(world),previous=storage.getItem(KEY);
 if(previous&&previous!==serialized){
  try{
   const old=JSON.parse(previous);
   if(plausible(old))storage.setItem(BACKUP,previous);
  }catch(error){console.warn("Vorheriger Spielstand konnte nicht gesichert werden",error);}
 }
 storage.setItem(KEY,serialized);
 return serialized.length;
}
root.LDFunkspruchCheckpoints=Object.freeze({key:KEY,backupKey:BACKUP,plausible,candidates,save});
})(typeof window!=="undefined"?window:globalThis);
