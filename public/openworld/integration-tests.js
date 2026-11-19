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
 test("Augsburg: benachbarte geografische OSM-Kacheln",()=>{
  const r=root.LDFunkspruchRegion.tiles;
  if(r.length!==4||new Set(r.map(t=>t.id)).size!==4)throw Error("OSM-Kacheln fehlen");
  if(!r.every(t=>t.bounds.north>t.bounds.south&&t.bounds.east>t.bounds.west&&t.bundledUrl?.endsWith(".geojson")))throw Error("Ungültige Geodatenkacheln");
  if(r[0].bounds.east!==r[1].bounds.west||r[0].bounds.north!==r[2].bounds.south)throw Error("Lücken im Straßennetz-Bereich");
 });
 test("OSM-Kacheln: identische Way-IDs ohne doppelte Straßen oder Gebäude",()=>{
  const elements=[];
  for(let i=0;i<10;i++){
   elements.push({type:"Feature",id:"way/"+(i+1),properties:{highway:"residential"},
    geometry:{type:"LineString",coordinates:[[10.9+i*.00001,48.37],[10.9001+i*.00001,48.37]]}});
   elements.push({type:"Feature",id:"way/"+(i+100),properties:{building:"yes"},
    geometry:{type:"Polygon",coordinates:[[[10.9,48.37],[10.9001,48.37],[10.9001,48.3701],[10.9,48.37]]]}});
  }
  const tile={type:"FeatureCollection",features:elements,metadata:{source:"OpenStreetMap",real:true}};
  const combined=root.LDFunkspruchMap.mergeGeoJSON([{geojson:tile},{geojson:tile}]);
  if(combined.features.length!==elements.length)throw Error("OSM-Ways doppelt übernommen");
  if(combined.metadata.tileCount!==2||!root.LDFunkspruchMap.validData(combined))
   throw Error("Echte OSM-Herkunft nach Zusammenführen verloren");
 });
 test("Geodaten: fiktive Stadt ist kein erlaubter Spielstand",()=>{
  const fake={type:"FeatureCollection",metadata:{source:"Fiktive Trainingsstadt",real:false},features:[]};
  if(root.LDFunkspruchMap.validData(fake))throw Error("Fiktive Stadt wurde akzeptiert");
 });
 test("Geodaten: kleine oder manipulierte Daten dürfen nicht als OSM gelten",()=>{
  const fake={type:"FeatureCollection",metadata:{source:"OpenStreetMap"},features:[...data.features,{type:"Feature",properties:{synthetic:true,highway:"residential"},geometry:{type:"LineString",coordinates:[[10.9,48.37],[10.901,48.37]]}}]};
  if(root.LDFunkspruchMap.validData(fake))throw Error("Synthetische Geometrie als OSM akzeptiert");
 });
 test("Echte OSM-Straßenarten: klassengerechte Fahrbahnbreiten",()=>{
  const width=root.LDOpenWorldRenderer?.roadWidth;
  if(typeof width!=="function")throw Error("OSM-Straßenrenderer fehlt");
  if(!(width({highway:"primary"})>width({highway:"residential"})))throw Error("Hauptstraße nicht breiter als Wohnstraße");
  if(!(width({highway:"residential"})>width({highway:"footway"})))throw Error("Gehweg zu breit");
  if(Math.abs(width({highway:"residential",width:"6.75"})-6.75)>1e-8)throw Error("OSM-Originalbreite nicht übernommen");
  if(width({highway:"secondary",lanes:"2"})<6)throw Error("Anzahl Fahrstreifen ignoriert");
 });
 test("Echte OSM-Gebäudehöhen: metrisch, Fuß und Stockwerke",()=>{
  const g=root.LDOpenWorldRenderer;
  if(Math.abs(g.buildingHeight({height:"40 ft"})-12.192)>.001)throw Error("OSM-Höhen in Fuß falsch");
  if(Math.abs(g.buildingHeight({height:"12,5 m"})-12.5)>.001)throw Error("OSM-Meterangabe falsch");
  if(g.buildingHeight({"building:levels":"4"})!==12)throw Error("OSM-Stockwerkszahl fehlt");
  if(g.buildingBaseHeight({min_height:"3.2 m"})!==3.2)throw Error("OSM-Höhe über Grund falsch");
  if(g.buildingHeight({})!==9)throw Error("Schätzhöhe ohne OSM-Tag fehlt");
 });
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
 test("Leitstelle: Kollision mit Trennwänden",()=>{
  const indoor=root.LDFunkspruchIndoor.model();
  if(indoor.buildings.length<12)throw Error("Innenraumkollisionen für Möbel und Trennwände fehlen");
  if(!root.LDOpenWorldCollision.collides({x:1,z:-2},indoor,.3))throw Error("Disponententisch ist durchlässig");
  const w=root.LDOpenWorldWalker.create({x:-2.7,z:1.5});
  w.update(.25,{strafe:-1},indoor);
  if(w.snapshot().x<-3.05)throw Error("Trennwand ist durchlässig");
  const clear=root.LDOpenWorldWalker.create({x:0,z:2});
  clear.update(.25,{forward:1},indoor);
  if(clear.snapshot().z>=2)throw Error("Hauptgang blockiert");
 });
 test("OSM-Verkehr: nur befahrbare Straßen und Rechtsverkehr",()=>{
  const example={roads:[
    {points:[{x:0,z:0},{x:40,z:0},{x:80,z:0}],properties:{highway:"residential",oneway:"yes",maxspeed:"30"}},
    {points:[{x:40,z:-40},{x:40,z:0},{x:40,z:40}],properties:{highway:"residential"}},
    {points:[{x:0,z:40},{x:40,z:40}],properties:{highway:"footway"}}
  ]};
  const nets=root.LDFunkspruchTraffic.buildNetwork(example);
  if(nets.car.edges.some(e=>e.props.highway==="footway"))throw Error("Auto fährt auf dem Fußweg");
  if(nets.car.edges.filter(e=>e.props.oneway==="yes").length!==2)throw Error("Einbahnstraße hat Gegenrichtung");
  if(!nets.walker.edges.some(e=>e.props.highway==="footway"))throw Error("Fußweg nicht erkannt");
  const cars=root.LDFunkspruchTraffic.generate(example,{cars:3,walkers:2});
  if(cars.filter(a=>a.kind==="car").length!==3)throw Error("Stadtverkehr fehlt");
  if(!cars.some(a=>a.kind==="walker"&&a.edge.props.highway==="footway"))throw Error("Fußgänger laufen nicht auf kartierten Wegen");
 });
 test("OSM-Verkehr: Kreuzungen verwenden verbundene echte Segmente",()=>{
  const network=root.LDFunkspruchTraffic.buildNetwork({roads:[
    {points:[{x:-20,z:0},{x:0,z:0},{x:20,z:0}],properties:{highway:"residential"}},
    {points:[{x:0,z:-20},{x:0,z:0},{x:0,z:20}],properties:{highway:"residential"}}
  ]}).car;
  const edge=network.edges.find(e=>e.a.x===-20&&e.b.x===0);
  if(!edge)throw Error("Teststraße fehlt");
  const a={kind:"car",edge,graph:network,progress:edge.length-1,seed:2,transitions:0};
  root.LDFunkspruchTraffic.advance(a,5,network);
  if(a.edge.from!==edge.to)throw Error("Fahrzeug überspringt Kreuzung");
  if(a.edge.to===edge.from)throw Error("Fahrzeug wendet ohne Not an Kreuzung");
 });
 test("OSM-Verkehr: Rückwärtsfahrt auf Einbahnstraße unterbunden",()=>{
  const road={points:[{x:0,z:0},{x:25,z:0}],properties:{highway:"residential",oneway:"-1"}};
  const graph=root.LDFunkspruchTraffic.buildNetwork({roads:[road]}).car;
  if(graph.edges.length!==1||graph.edges[0].a.x!==25)throw Error("Rückwärts-Einbahnstraße missachtet");
  const agent={edge:graph.edges[0],progress:24,seed:3,transitions:0};
  root.LDFunkspruchTraffic.advance(agent,8,graph);
  if(agent.edge.a.x!==25||agent.edge.b.x!==0)throw Error("Unerlaubte Gegenrichtung");
 });
 test("OSM-Verkehr: plausible Tempoangaben und kein eigener Straßenbau",()=>{
  const t=root.LDFunkspruchTraffic;
  if(!(t.speedFor({maxspeed:"30"})<t.speedFor({maxspeed:"50"})))throw Error("Tempolimit ignoriert");
  if(t.allowed({highway:"construction"},"car"))throw Error("Fahrt über Baustelle erlaubt");
  if(t.allowed({highway:"motorway"},"walker"))throw Error("Fußgänger auf Autobahn");
  const agents=t.generate(model,{cars:2,walkers:2});
  if(!agents.some(a=>a.kind==="car")||!Number.isFinite(agents[0].progress))throw Error("Fahrzeugdaten fehlen");
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
 test("Nachtschicht: Dienstbericht und Funkereignisse über Mitternacht",()=>{
  const data=new Map();
  const storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};
  const j=root.LDFunkspruchShiftJournal.create(storage);
  const state=(minutes)=>({life:{minutes,onDuty:true},dispatch:{open:2,waiting:1,free:4,total:6}});
  if(!j.begin(state(23*60+50)))throw Error("Nachtschicht nicht begonnen");
  j.record(state(23*60+59));
  j.recordEvent({kind:"funk",minute:2,incidentId:"15"});
  j.record(state(24*60+12));
  const report=j.finish(state(24*60+12));
  if(report.durationMinutes!==22)throw Error("Mitternacht hat die Schichtdauer verfälscht: "+report.durationMinutes);
  if(report.events[0]?.minute!==1442)throw Error("Funkereignis nach Mitternacht falsch einsortiert");
  if(!j.format(report).includes("00:12"))throw Error("Dienstende nicht im 24h-Format");
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
 test("Autonavigation: nur öffentliche befahrbare OSM-Wege",()=>{
  const roads=[
   {points:[{x:0,z:0},{x:25,z:0}],properties:{highway:"residential",maxspeed:"30"}},
   {points:[{x:25,z:0},{x:50,z:0}],properties:{highway:"footway"}},
   {points:[{x:25,z:0},{x:25,z:25}],properties:{highway:"cycleway"}}
  ];
  const g=root.LDOpenWorldRoadGraph.create({roads},{mode:"car"});
  if(g.edgeCount!==2)throw Error("Nichtbefahrbare Wege für Autos geroutet");
  if(!root.LDOpenWorldRoadGraph.canTravel({highway:"footway"},"walk"))throw Error("Gehweg für Fußgänger fehlt");
  if(root.LDOpenWorldRoadGraph.canTravel({highway:"residential",motor_vehicle:"no"},"car"))throw Error("OSM-Fahrverbot ignoriert");
 });
 test("Autonavigation: Einbahnstraßen inklusive OSM-Rückwärtsrichtung",()=>{
  const roads=[
   {points:[{x:0,z:0},{x:20,z:0}],properties:{highway:"residential",oneway:"yes"}},
   {points:[{x:20,z:0},{x:20,z:30}],properties:{highway:"residential",oneway:"-1"}}
  ];
  const g=root.LDOpenWorldRoadGraph.create({roads},{mode:"car"});
  if(!g.route({x:0,z:0},{x:20,z:0}))throw Error("Erlaubte Einbahnstraße nicht routbar");
  if(g.route({x:20,z:0},{x:0,z:0}))throw Error("Unzulässige Gegenrichtung geroutet");
  if(!g.route({x:20,z:30},{x:20,z:0}))throw Error("Rückwärts-Einbahnstraße nicht berücksichtigt");
  if(g.route({x:20,z:0},{x:20,z:30}))throw Error("Gegenrichtung bei -1 erlaubt");
 });
 test("Routing: Fahrtstreckenlänge und geschätzte Dauer",()=>{
  const roads=[{points:[{x:0,z:0},{x:100,z:0},{x:150,z:0}],properties:{highway:"residential",maxspeed:"30"}}];
  const g=root.LDOpenWorldRoadGraph.create({roads},{mode:"car"}),route=g.route({x:0,z:0},{x:150,z:0});
  if(!route||Math.abs(route.meters-150)>1||!(route.secondsEstimated>0&&route.secondsEstimated<100))
    throw Error("Routenberechnung unplausibel");
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
