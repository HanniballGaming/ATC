/* Automated browser assertions for Open World core and integration contracts.
 * Open test.html to run; no external testing framework required.
 */
(function(root){"use strict";
async function run(){
 const results=[];
 function test(name,fn){try{fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:e.message});}}
 const origin={lon:10.9,lat:48.37},geo=root.LDOpenWorldGeo;
 const point=geo.project(10.9001,48.3701,origin);
 test("Koordinaten: WGS84-Rückrechnung",()=>{
  const p=geo.unproject(point.x,point.z,origin);
  if(Math.abs(p.lon-10.9001)>1e-8||Math.abs(p.lat-48.3701)>1e-8)throw Error("Projection mismatch");
 });
 const data={type:"FeatureCollection",features:[
  {type:"Feature",properties:{highway:"residential"},geometry:{type:"LineString",coordinates:[[10.9,48.37],[10.904,48.37]]}},
  {type:"Feature",properties:{building:"yes"},geometry:{type:"Polygon",coordinates:[[[10.901,48.371],[10.9012,48.371],[10.9012,48.3708],[10.901,48.3708],[10.901,48.371]]]}}
 ]};
 const model=geo.loadGeoJSON(data,origin);
 test("GeoJSON: Straße und Gebäude",()=>{if(model.roads.length!==1||model.buildings.length!==1)throw Error("Feature count");});
 test("Tile-Index: lange Straße ohne Zwischenpunkte",()=>{
  const tiles=geo.tilesFor(model,32);
  const middle=geo.project(10.902,48.37,origin);
  const key=geo.tileKey(middle.x,middle.z,32);
  if(!tiles.get(key)?.roads.includes(model.roads[0]))throw Error("Missing intermediate tile");
 });
 test("Kollision: Gebäudeinneres",()=>{
  const b=model.buildings[0],ring=b.rings[0],p={x:(ring[0].x+ring[2].x)/2,z:(ring[0].z+ring[2].z)/2};
  if(!root.LDOpenWorldCollision.collides(p,model,0.35))throw Error("Missing collision");
 });
 test("Fußweg: Bewegung",()=>{
  const w=root.LDOpenWorldWalker.create();
  const before=w.snapshot();w.update(0.1,{forward:1});
  if(!(w.snapshot().z<before.z))throw Error("Walker did not move north");
 });
 test("Schichtuhr: Vorwärts-Synchronisierung",()=>{
  const life=root.LDOpenWorldLife.create({minutes:6*60,hunger:15});
  life.syncClock(6*60+14);
  if(life.snapshot().minutes!==374)throw Error("Clock did not sync");
  const before=life.snapshot().minutes;
  life.syncClock(6*60+3);
  if(life.snapshot().minutes!==before)throw Error("Clock went backwards");
 });
 test("Fahrzeug: Beschleunigung",()=>{
  const v=root.LDOpenWorldVehicle.create();v.reset({handbrake:false});
  for(let i=0;i<30;i++)v.step(1/60,{throttle:1,handbrake:false});
  if(v.snapshot().speed<=0)throw Error("Vehicle did not accelerate");
 });
 test("Fahrzeug: Einsteigen und Aussteigen",()=>{
  const v=root.LDOpenWorldVehicle.create(),player={x:1,z:1,heading:0};
  const i=root.LDOpenWorldInteraction.create({vehicle:v,player});
  i.enter();if(!i.driving)throw Error("Entry failed");
  i.exit();if(i.driving)throw Error("Exit failed");
 });
 test("Routen: vorhandenes Straßennetz",()=>{
  const graph=root.LDOpenWorldRoadGraph.create(model);
  const path=graph.route(model.roads[0].points[0],model.roads[0].points[1]);
  if(!path||path.meters<=0)throw Error("No road route");
 });
 test("OSM-Konverter: Straße",()=>{
  const converted=root.LDOpenWorldOSM.convert({elements:[
   {type:"node",id:1,lon:10,lat:48},{type:"node",id:2,lon:10.001,lat:48},
   {type:"way",id:3,nodes:[1,2],tags:{highway:"residential"}}]});
  if(converted.features.length!==1)throw Error("OSM import failed");
 });
 return {passed:results.filter(r=>r.ok).length,total:results.length,results};
}
root.LDOpenWorldIntegrationTests=Object.freeze({run});
})(typeof window!=="undefined"?window:globalThis);
