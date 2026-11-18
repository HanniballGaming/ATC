/* FUNKSPRUCH – ausschließlich geografisch nachgewiesene OSM-Straßen und Gebäude.
 * Kein erfundenes Straßennetz, keine Ersatzstadt bei Verbindungsproblemen.
 * Ein geprüftes echtes OSM-Paket kann offline nach /openworld/data/augsburg.geojson
 * geliefert werden. Sonst ist beim ersten Start eine Verbindung nötig.
 */
(function(root){"use strict";
const PREFIX="funkspruch-osm-cache-v1:",TTL=14*86400000,MAX_FEATURES=50000;
const ENDPOINTS=Object.freeze([
 "https://overpass.private.coffee/api/interpreter",
 "https://ovp.dresel.systems/api/interpreter"
]);
function key(bounds){return PREFIX+["south","west","north","east"].map(k=>bounds[k].toFixed(5)).join(":");}
function validData(data){
 if(!data||data.type!=="FeatureCollection"||!Array.isArray(data.features)||data.features.length<15||data.features.length>MAX_FEATURES)return false;
 if(data.metadata?.source!=="OpenStreetMap"||data.metadata?.real===false)return false;
 let roads=0,buildings=0;
 for(const feature of data.features){
  if(!feature||feature.properties?.synthetic===true)return false;
  const g=feature.geometry;
  if(g?.type==="LineString"&&feature.properties?.highway)roads++;
  else if(g?.type==="Polygon"&&feature.properties?.building)buildings++;
 }
 return roads>=4&&buildings>=4;
}
async function load({bounds,storage=root.localStorage,fetchImpl=root.fetch,timeoutMs=14500,online=root.navigator?.onLine!==false,bundledUrl="./data/augsburg.geojson",endpoints=ENDPOINTS}={}){
 const loader=root.LDOpenWorldOSM;
 if(!loader?.validateBounds)throw Error("OpenStreetMap-Kartenmodul fehlt");
 loader.validateBounds(bounds);
 const cacheKey=key(bounds);
 let cached=null;
 try{
  const data=JSON.parse(storage?.getItem(cacheKey)||"null");
  if(validData(data?.geojson))cached=data;
 }catch{}
 if(cached&&Number.isFinite(cached.time)&&Date.now()-cached.time<TTL)return {geojson:cached.geojson,source:"OpenStreetMap",real:true,cache:true};
 function store(geojson){try{storage?.setItem(cacheKey,JSON.stringify({time:Date.now(),geojson}));}catch(e){console.warn("OSM-Zwischenspeicherung nicht möglich",e);}}
 // Das lokale GeoJSON darf nur mit verifizierbarer OpenStreetMap-Provenienz ausgeliefert werden.
 if(typeof fetchImpl==="function"&&bundledUrl){
  try{
   const response=await fetchImpl(bundledUrl,{cache:"no-cache"});
   if(response.ok){
    const result=await response.json();
    if(validData(result)){
     store(result);
     return {geojson:result,source:"OpenStreetMap",real:true,cache:false,bundled:true};
    }
    console.warn("Lokales Kartenpaket ist keine gültige OSM-Karte und wird ignoriert");
   }
  }catch(error){console.warn("Lokales OSM-Kartenpaket nicht verfügbar",error.message||error);}
 }
 if(online&&typeof fetchImpl==="function"){
  const count=Math.min(2,Array.isArray(endpoints)?endpoints.length:0);
  for(let i=0;i<count;i++){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
   try{
    const geojson=await loader.fetchBounds(bounds,{endpoint:endpoints[i],signal:controller.signal,fetchImpl});
    if(!validData(geojson))throw Error("Zu wenige echte Straßen oder Gebäude für diesen Stadtteil");
    store(geojson);
    return {geojson,source:"OpenStreetMap",real:true,cache:false,bundled:false};
   }catch(error){
    console.warn("OpenStreetMap-Dienst "+(i+1)+" nicht verfügbar",error.message||error);
   }finally{clearTimeout(timer);}
  }
 }
 if(cached)return {geojson:cached.geojson,source:"OpenStreetMap",real:true,cache:true,stale:true};
 throw Error("Für Augsburg konnten keine echten OpenStreetMap-Straßen und Gebäude geladen werden. Bitte die Internetverbindung prüfen und neu laden. Eine fiktive Ersatzstadt wird nicht verwendet.");
}
root.LDFunkspruchMap=Object.freeze({load,key,validData});
})(typeof window!=="undefined"?window:globalThis);
