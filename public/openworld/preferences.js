/* FUNKSPRUCH – persistent device preferences with safe defaults. */
(function(root){"use strict";
const KEY="funkspruch-settings-v1";
const defaults=Object.freeze({graphics:"auto",ambient:true,voice:true,fov:70,sensitivity:1});
function normalize(value){
 const data=value&&typeof value==="object"&&!Array.isArray(value)?value:{};
 return {
  graphics:["auto","low","medium"].includes(data.graphics)?data.graphics:defaults.graphics,
  ambient:typeof data.ambient==="boolean"?data.ambient:defaults.ambient,
  voice:typeof data.voice==="boolean"?data.voice:defaults.voice,
  fov:Number.isFinite(data.fov)&&data.fov>=60&&data.fov<=95?Math.round(data.fov):defaults.fov,
  sensitivity:Number.isFinite(data.sensitivity)&&data.sensitivity>=.5&&data.sensitivity<=2?Math.round(data.sensitivity*100)/100:defaults.sensitivity
 };
}
function load(storage=root.localStorage){
 try{
  const raw=storage?.getItem(KEY);
  if(!raw)return normalize(defaults);
  const data=JSON.parse(raw);
  return normalize(data?.version===1?data:null);
 }catch(error){console.warn("Spiel-Einstellungen konnten nicht geladen werden",error);return normalize(defaults);}
}
function save(value,storage=root.localStorage){
 const options=normalize(value);
 storage.setItem(KEY,JSON.stringify({version:1,...options}));
 return options;
}
root.LDFunkspruchPreferences=Object.freeze({key:KEY,defaults,normalize,load,save});
})(typeof window!=="undefined"?window:globalThis);
