/* Browser or Node smoke tests for openworld/geo-core.js.
 * In browser, load geo-core.js first and run LDOpenWorldGeoTests.run().
 */
(function(root){
"use strict";
function run(){
 const geo=root.LDOpenWorldGeo;if(!geo)throw Error("Load geo-core.js first");
 const origin={lon:10.8985,lat:48.3705};
 const at=geo.project(origin.lon,origin.lat,origin);
 if(Math.abs(at.x)>1e-8||Math.abs(at.z)>1e-8)throw Error("Origin not zero");
 const p=geo.project(10.9,48.371,origin),back=geo.unproject(p.x,p.z,origin);
 if(Math.abs(back.lon-10.9)>1e-9||Math.abs(back.lat-48.371)>1e-9)throw Error("Round trip failed");
 const data={type:"FeatureCollection",features:[
  {type:"Feature",properties:{highway:"residential"},geometry:{type:"LineString",coordinates:[[10.8985,48.3705],[10.9,48.371]]}},
  {type:"Feature",properties:{building:"yes"},geometry:{type:"Polygon",coordinates:[[[10.8985,48.3705],[10.8986,48.3705],[10.8986,48.3706],[10.8985,48.3705]]]}}
 ]};
 const model=geo.loadGeoJSON(data,origin);
 if(model.roads.length!==1||model.buildings.length!==1)throw Error("Geometry counts wrong");
 const tiles=geo.tilesFor(model);
 if(!geo.nearbyTiles(tiles,0,0).length)throw Error("No nearby tiles");
 return {passed:4,roads:model.roads.length,buildings:model.buildings.length,tiles:tiles.size};
}
root.LDOpenWorldGeoTests={run};
})(typeof window!=="undefined"?window:globalThis);
