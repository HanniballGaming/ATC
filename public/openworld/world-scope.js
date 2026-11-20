/* FUNKSPRUCH: separated browser-city and Windows nationwide world contracts.
 * Physical navigation is only allowed in genuinely loaded OSM world areas.
 * A national simulation is not the same thing as a fully driveable 3D map.
 */
(function(root){"use strict";
const PLATFORM_ENDPOINT="/__funkspruch/platform";
const MODES=Object.freeze({
 browser:Object.freeze({platform:"browser",drivingTarget:"ils-city",outside:"simulation",national3d:false}),
 windows:Object.freeze({platform:"windows",drivingTarget:"germany",outside:"world-streaming",national3d:true})
});
const safePlatform=platform=>platform==="windows"?"windows":"browser";
async function detect({fetchImpl=root.fetch}={}){
 if(typeof fetchImpl!=="function")return "browser";
 try{
  const res=await fetchImpl(PLATFORM_ENDPOINT,{cache:"no-store"});
  if(!res?.ok)return "browser";
  const data=await res.json();
  return data?.product==="FUNKSPRUCH"&&data?.platform==="windows"&&data?.protocol===1?"windows":"browser";
 }catch{return "browser";}
}
function policy(platform="browser"){return MODES[safePlatform(platform)];}
function bounds(region){
 const tiles=region?.tiles;
 if(!Array.isArray(tiles)||!tiles.length)return null;
 const box={south:Infinity,west:Infinity,north:-Infinity,east:-Infinity};
 for(const tile of tiles){
  const b=tile?.bounds;
  if(!b||!["south","west","north","east"].every(k=>Number.isFinite(b[k])))return null;
  box.south=Math.min(box.south,b.south);
  box.west=Math.min(box.west,b.west);
  box.north=Math.max(box.north,b.north);
  box.east=Math.max(box.east,b.east);
 }
 return box;
}
function inBounds(coordinates,area){
 return !!area&&Number.isFinite(coordinates?.lat)&&Number.isFinite(coordinates?.lon)&&
  coordinates.lat>=area.south&&coordinates.lat<=area.north&&
  coordinates.lon>=area.west&&coordinates.lon<=area.east;
}
function pointMode({platform="browser",region,point,loadedBounds}={}){
 const p=policy(platform);
 if(p.platform==="windows")return {mode:"world-streaming",ready:false,reason:"Deutschlandweiter 3D-Kartenstream noch im Aufbau"};
 const area=loadedBounds||bounds(region);
 return inBounds(point,area)?
  {mode:"driveable",ready:true,reason:"Kartierte ILS-Stadt"}:
  {mode:"simulated",ready:true,reason:"Außerhalb der geladenen ILS-Stadt: nur Einsatzsimulation"};
}
function areaText(platform,region){
 if(safePlatform(platform)==="windows")return "Windows: Deutschland als zusammenhängendes, befahrbares 3D-Gebiet ist das Ausbauziel. Der vollständige Kartenstream steht noch aus.";
 return "Browser: Nur die geladenen OSM-Stadtgebiete rund um ausgewählte ILS-Standorte sind 3D-befahrbar. Deutschland außerhalb dieser Gebiete wird ausschließlich simuliert.";
}
root.LDFunkspruchWorldScope=Object.freeze({detect,policy,bounds,inBounds,pointMode,areaText});
})(typeof window!=="undefined"?window:globalThis);
