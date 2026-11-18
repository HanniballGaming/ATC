/* FUNKSPRUCH: kleine, lizenzierte OSM-Ausschnitte mit Cache und Offline-Trainingskarte. */
(function(root){"use strict";
const PREFIX="funkspruch-osm-cache-v1:",TTL=7*86400000;
function key(bounds){return PREFIX+["south","west","north","east"].map(k=>bounds[k].toFixed(5)).join(":");}
async function load({bounds,fallback,storage=root.localStorage,fetchImpl=root.fetch,timeoutMs=5000,online=root.navigator?.onLine!==false}={}){
 if(!fallback||fallback.type!=="FeatureCollection")throw Error("Trainingskarte fehlt");
 const config={geojson:fallback,source:"Trainingskarte",real:false,cache:false};
 const loader=root.LDOpenWorldOSM;
 const boundsValid=loader?.validateBounds(bounds);
 if(!boundsValid)return config;
 const cacheKey=key(bounds);
 let old=null;
 try{
  const raw=storage?.getItem(cacheKey);
  if(raw){const parsed=JSON.parse(raw);if(parsed.geojson?.type==="FeatureCollection"&&Array.isArray(parsed.geojson.features)&&parsed.geojson.features.length>=10)old=parsed;}
 }catch{}
 if(old&&Date.now()-old.time<TTL)return {geojson:old.geojson,source:"OpenStreetMap",real:true,cache:true};
 if(!online||typeof fetchImpl!=="function")return old?{geojson:old.geojson,source:"OpenStreetMap",real:true,cache:true}:config;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const geojson=await loader.fetchBounds(bounds,{signal:controller.signal,fetchImpl});
  if(!Array.isArray(geojson.features)||geojson.features.length<10)throw Error("Zu wenige Kartenelemente");
  try{storage?.setItem(cacheKey,JSON.stringify({time:Date.now(),geojson}));}catch{}
  return {geojson,source:"OpenStreetMap",real:true,cache:false};
 }catch(e){
  console.warn("FUNKSPRUCH: Kartendaten nicht verfügbar, nutze "+(old?"Zwischenspeicher":"Trainingskarte"),e.message||e);
  return old?{geojson:old.geojson,source:"OpenStreetMap",real:true,cache:true}:config;
 }finally{clearTimeout(timer);}
}
root.LDFunkspruchMap=Object.freeze({load,key});
})(typeof window!=="undefined"?window:globalThis);
