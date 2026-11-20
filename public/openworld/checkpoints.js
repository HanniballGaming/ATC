/* FUNKSPRUCH – two rotating world checkpoints. ELS saves remain independent. */
(function(root){"use strict";
const KEY="funkspruch-openworld-save-v1",BACKUP=KEY+"-backup";
function plausible(data){
 return data&&typeof data==="object"&&[1,2].includes(data.version)&&data.player&&
  [data.player.x,data.player.z,data.player.heading,data.player.pitch].every(Number.isFinite);
}
function scopedKeys(regionId="augsburg"){
 if(typeof regionId!=="string"||!/^[a-z0-9-]{1,40}$/.test(regionId))throw Error("Ungültige ILS-Region");
 // Keep legacy Augsburg save keys readable and compatible.
 const key=regionId==="augsburg"?KEY:KEY+"-"+regionId;
 return {key,backup:key+"-backup"};
}
function candidates(storage=root.localStorage,regionId="augsburg"){
 const scoped=scopedKeys(regionId);
 const found=[];
 for(const [source,key] of [["current",scoped.key],["backup",scoped.backup]]){
  try{
   const raw=storage.getItem(key);
   if(!raw)continue;
   const data=JSON.parse(raw);
   if(plausible(data)&&(data.regionId||"augsburg")===regionId)found.push({source,world:data});
  }catch(error){console.warn("Schicht-Sicherung konnte nicht gelesen werden",source,error);}
 }
 return found;
}
function save(world,storage=root.localStorage,regionId="augsburg"){
 const scoped=scopedKeys(regionId);
 if((world?.regionId||"augsburg")!==regionId)throw Error("Welt-Spielstand gehört zu einer anderen ILS-Stadt");
 if(!plausible(world))throw Error("Ungültiger Weltzustand kann nicht gespeichert werden");
 const serialized=JSON.stringify(world),previous=storage.getItem(scoped.key);
 if(previous&&previous!==serialized){
  try{
   const old=JSON.parse(previous);
   if(plausible(old))storage.setItem(scoped.backup,previous);
  }catch(error){console.warn("Vorheriger Spielstand konnte nicht gesichert werden",error);}
 }
 storage.setItem(scoped.key,serialized);
 return serialized.length;
}
root.LDFunkspruchCheckpoints=Object.freeze({key:KEY,backupKey:BACKUP,scopedKeys,plausible,candidates,save});
})(typeof window!=="undefined"?window:globalThis);
