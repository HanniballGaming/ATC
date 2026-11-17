/* LEITSTELLE DEUTSCHLAND – OSM city data adapter.
 * Uses OpenStreetMap data via a configurable Overpass API endpoint.
 * Attribution required: © OpenStreetMap contributors (ODbL).
 * Fetch only bounded small areas, never whole cities in a single request.
 */
(function(root){"use strict";
const DEFAULT_ENDPOINT="https://overpass.kumi.systems/api/interpreter";
function validateBounds(b){
 if(!b||!["south","west","north","east"].every(k=>Number.isFinite(b[k])))throw Error("Ungültige Kartengrenzen");
 if(b.south>=b.north||b.west>=b.east||Math.abs(b.south)>85||Math.abs(b.north)>85||Math.abs(b.west)>180||Math.abs(b.east)>180)throw Error("Ungültiger Kartenausschnitt");
 if(b.north-b.south>0.02||b.east-b.west>0.03)throw Error("Kartenausschnitt zu groß: bitte kleinere Kacheln laden");
 return b;
}
function query(bounds){
 const b=validateBounds(bounds),bb=[b.south,b.west,b.north,b.east].join(",");
 return '[out:json][timeout:25];(way["highway"]["area"!="yes"]('+bb+');way["building"]('+bb+'););out body;>;out skel qt;';
}
function convert(data){
 if(!data||!Array.isArray(data.elements))throw Error("Ungültige OSM-Antwort");
 const nodes=new Map();
 for(const el of data.elements)if(el.type==="node"&&Number.isFinite(el.lon)&&Number.isFinite(el.lat))nodes.set(el.id,[el.lon,el.lat]);
 const features=[];
 for(const el of data.elements){
  if(el.type!=="way"||!Array.isArray(el.nodes))continue;
  const coords=el.nodes.map(id=>nodes.get(id));
  if(coords.some(p=>!p)||coords.length<2)continue;
  const tags=el.tags||{};
  const building=tags.building&&tags.building!=="no";
  const road=tags.highway&&!building&&tags.area!=="yes";
  if(!building&&!road)continue;
  if(building&&coords.length<4)continue;
  if(building&&(coords[0][0]!==coords[coords.length-1][0]||coords[0][1]!==coords[coords.length-1][1]))coords.push(coords[0]);
  features.push({type:"Feature",id:"way/"+el.id,properties:{...tags,osm_id:el.id},geometry:{type:building?"Polygon":"LineString",coordinates:building?[coords]:coords}});
 }
 return {type:"FeatureCollection",features,metadata:{source:"OpenStreetMap",attribution:"© OpenStreetMap contributors",license:"ODbL 1.0",generatedAt:new Date().toISOString()}};
}
async function fetchBounds(bounds,{endpoint=DEFAULT_ENDPOINT,signal,fetchImpl=root.fetch}={}){
 if(typeof fetchImpl!=="function")throw Error("Fetch nicht verfügbar");
 const response=await fetchImpl(endpoint,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body:"data="+encodeURIComponent(query(bounds)),signal});
 if(!response.ok)throw Error("OSM-Datenabruf fehlgeschlagen: HTTP "+response.status);
 return convert(await response.json());
}
root.LDOpenWorldOSM=Object.freeze({validateBounds,query,convert,fetchBounds});
})(typeof window!=="undefined"?window:globalThis);
