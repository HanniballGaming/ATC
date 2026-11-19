/* Node-Tests für Quellcode, Oberfläche und Open-World-Kern. */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";
import assert from "node:assert/strict";
const base=path.join(path.dirname(fileURLToPath(import.meta.url)),"web");
const read=p=>fs.readFileSync(path.join(base,p),"utf8");
assert.match(read("index.html"),/funkspruch_embed\.js/);
assert.match(read("index.html"),/\.\/vendor\/leaflet\/leaflet\.(js|css)/);
assert.ok(fs.statSync(path.join(base,"vendor","leaflet","leaflet.js")).size>100000);
assert.match(read("openworld/index.html"),/FUNKSPRUCH/);
for(const target of ["openworld/index.html","openworld/arbeitsplatz.html"]){
 const source=read(target),inline=Array.from(source.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi));
 for(let i=0;i<inline.length;i++)
  new vm.Script(inline[i][1],{filename:target+"#inline-"+i});
}

assert.match(read("openworld/index.html"),/rel="manifest"/);
const manifest=JSON.parse(read("manifest.webmanifest"));
assert.equal(manifest.start_url,"./openworld/");
assert.equal(manifest.short_name,"FUNKSPRUCH");
assert.match(read("openworld/index.html"),/id="startNormal"/);
assert.match(read("openworld/index.html"),/disabled aria-disabled="true"/);
assert.match(read("openworld/arbeitsplatz.html"),/fs_embed=1/);
assert.match(read("openworld/index.html"),/\.\/vendor\/three\.min\.js/);
assert.ok(fs.statSync(path.join(base,"openworld","vendor","three.min.js")).size>100000);
const mapTiles=[
 ["suedwest",[10.888,48.364,10.8985,48.3705]],
 ["suedost",[10.8985,48.364,10.909,48.3705]],
 ["nordwest",[10.888,48.3705,10.8985,48.377]],
 ["nordost",[10.8985,48.3705,10.909,48.377]]
];
let packagedTiles=0,roadsFromOSM=0,buildingsFromOSM=0;
for(const [name,bbox] of mapTiles){
 const file=path.join(base,"openworld","data","augsburg-"+name+".geojson");
 if(!fs.existsSync(file))continue;
 const geojson=JSON.parse(fs.readFileSync(file,"utf8"));
 assert.equal(geojson.type,"FeatureCollection");
 assert.equal(geojson.metadata?.source,"OpenStreetMap");
 assert.equal(geojson.metadata?.real,true);
 assert.equal(geojson.metadata?.license,"ODbL 1.0");
 assert.deepEqual(geojson.metadata?.bbox,bbox);
 const roads=geojson.features.filter(f=>f.properties?.highway);
 const buildings=geojson.features.filter(f=>f.properties?.building);
 assert.ok(roads.length>=8&&buildings.length>=8,"Echte Straßen und Gebäude fehlen: "+name);
 assert.ok(geojson.features.every(f=>typeof f.id==="string"&&f.id.startsWith("way/")&&!f.properties?.synthetic),
  "Manipulierte oder synthetische OSM-Daten im Paket: "+name);
 roadsFromOSM+=roads.length;buildingsFromOSM+=buildings.length;packagedTiles++;
}
console.log("Authentische Augsburger Offline-OSM-Kacheln:",packagedTiles+"/4",
 "Straßen-Ways:",roadsFromOSM,"Gebäude-Ways:",buildingsFromOSM);

const serviceWorker=read("sw.js");
assert.match(serviceWorker,/funkspruch-pwa-[a-f0-9]{14}/,"Versionierter Offline-Cache fehlt");
for(const file of ["openworld/city-region.js","openworld/geodata-session.js","openworld/traffic-ai.js","openworld/shift-journal.js","openworld/ambient.js","openworld/preferences.js","openworld/checkpoints.js","openworld/performance-budget.js","openworld/navigation-core.js","openworld/vendor/three.min.js","vendor/leaflet/leaflet.js"])
 assert.ok(serviceWorker.includes("./"+file),"Offline-Cache enthält "+file+" nicht");
const context={console,Math,Date,JSON,Map,Set,Array,Object,Number,String,Boolean,Promise,Intl,setTimeout,clearTimeout};
context.window=context;vm.createContext(context);
for(const file of ["geo-core.js","three-city.js","collision-core.js","indoor-collision.js","vehicle-core.js","vehicle-interaction.js","walker-core.js","life-core.js","road-graph.js","osm-loader.js","city-region.js","geodata-session.js","integration-tests.js","world-upgrades.js","traffic-ai.js","save-manager.js","shift-journal.js","ambient.js","preferences.js","checkpoints.js","performance-budget.js","navigation-core.js"])
 vm.runInContext(read("openworld/"+file),context,{filename:file,timeout:3000});
// Regressionstest mit den tatsächlich abgefragten Augsburger OSM-Ways:
const authenticTiles=mapTiles.map(([name])=>{
 const file=path.join(base,"openworld","data","augsburg-"+name+".geojson");
 return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,"utf8")):null;
}).filter(Boolean);
if(authenticTiles.length){
 const merged=context.LDFunkspruchMap.mergeGeoJSON(authenticTiles);
 const modeled=context.LDOpenWorldGeo.loadGeoJSON(merged,{lon:10.8985,lat:48.3705});
 const driving=context.LDOpenWorldRoadGraph.create(modeled,{mode:"car"});
 const walking=context.LDOpenWorldRoadGraph.create(modeled,{mode:"walk"});
 assert.ok(modeled.roads.length>80&&modeled.buildings.length>80,"Echte Augsburg-Karte zu unvollständig");
 assert.ok(driving.nodeCount>100&&walking.nodeCount>100,"OSM-Navigation erzeugt kein Straßennetz");
 const sample=modeled.roads.find(road=>road.points.length>=2&&
  context.LDOpenWorldRoadGraph.canTravel(road.properties,"car")&&
  !["yes","1","true","-1"].includes(String(road.properties?.oneway)));
 if(sample){
  const route=driving.route(sample.points[0],sample.points[1]);
  assert.ok(route&&route.meters>0&&Number.isFinite(route.secondsEstimated),
   "Erste echte Augsburger Straßenverbindung nicht routbar");
 }
 console.log("Augsburg OSM-Routing:",driving.nodeCount,"Knoten für Fahrzeuge,",
  walking.nodeCount,"Fußwegknoten,",modeled.roads.length,"echte Straßenobjekte");
}
const result=await context.LDOpenWorldIntegrationTests.run();
if(result.passed!==result.total)throw Error("Open-World-Tests fehlgeschlagen: "+JSON.stringify(result.results.filter(x=>!x.ok)));
assert.equal(context.LDFunkspruchWorld.daylight(0),0);
assert.ok(context.LDFunkspruchWorld.daylight(720)>.99);
assert.equal(context.LDFunkspruchWorld.daylight(1300),0);
const storage=(()=>{
 const data=new Map([["ld-openworld-life-v1",'{"onDuty":true}'],["funkspruch-openworld-save-v1",'{"version":1}'],["funkspruch-osm-cache-v1:xyz","huge-map"],["unrelated-data","unrelated"]]);
 return {key:i=>Array.from(data.keys())[i],getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),get length(){return data.size}};
})();
const backup=context.LDFunkspruchSave.capture(storage);
assert.equal(backup.entries["ld-openworld-life-v1"],'{"onDuty":true}');
assert.equal(backup.entries["funkspruch-openworld-save-v1"],'{"version":1}');
assert.equal(backup.entries["funkspruch-osm-cache-v1:xyz"],undefined);
storage.setItem("ld-openworld-life-v1",'{"onDuty":false}');
assert.equal(context.LDFunkspruchSave.restore(backup,storage),2);
assert.equal(storage.getItem("ld-openworld-life-v1"),'{"onDuty":true}');
assert.throws(()=>context.LDFunkspruchSave.validate({format:"invalid",entries:{}}));
storage.setItem("funkspruch-shift-journal-v1",'{"stale":true}');
storage.setItem("ld-old-dispatch-state",'{"stale":true}');
const imported={format:backup.format,entries:{"ld-openworld-life-v1":'{"onDuty":false}'}};
assert.equal(context.LDFunkspruchSave.restore(imported,storage),1);
assert.equal(storage.getItem("funkspruch-shift-journal-v1"),null,"Altes Schichtjournal nach Import vorhanden");
assert.equal(storage.getItem("ld-old-dispatch-state"),null,"Alte Einsatzdaten nach Import vorhanden");
assert.equal(storage.getItem("funkspruch-osm-cache-v1:xyz"),"huge-map","OSM-Cache darf nicht gelöscht werden");
assert.equal(storage.getItem("unrelated-data"),"unrelated","Fremde Browserdaten dürfen nicht gelöscht werden");
// Simulierter Speicherausfall nach dem Löschen alter Schlüssel: vollständiger Rollback.
storage.setItem("funkspruch-shift-journal-v1","previous-journal");
const failing={key:i=>storage.key(i),getItem:k=>storage.getItem(k),removeItem:k=>storage.removeItem(k),get length(){return storage.length;},setItem:(k,v)=>{if(k==="ld-new-state")throw Error("QuotaExceededError");storage.setItem(k,v);}};
assert.throws(()=>context.LDFunkspruchSave.restore({format:backup.format,entries:{"ld-new-state":"new"}},failing),/konnte nicht importiert/);
assert.equal(storage.getItem("funkspruch-shift-journal-v1"),"previous-journal","Rollback muss entfernte Schlüssel wiederherstellen");
assert.equal(storage.getItem("ld-openworld-life-v1"),'{"onDuty":false}',"Rollback muss vorherige Spielstände erhalten");

const testLife=context.LDOpenWorldLife.create({location:"leitstelle",onDuty:true,fatigue:70,thirst:50});
testLife.action("ruhepause");
assert.ok(testLife.snapshot().fatigue>55&&testLife.snapshot().fatigue<56,"Die Ruhepause soll Müdigkeit trotz Zeitablauf verringern");
assert.ok(testLife.snapshot().thirst<50);
testLife.action("trinken");
assert.ok(testLife.snapshot().thirst<10);
const freshLife=context.LDOpenWorldLife.create({location:"leitstelle",onDuty:false});
assert.throws(()=>freshLife.action("ruhepause"));
const colleague=context.LDFunkspruchWorld.colleagueResponse;
assert.match(colleague("Kollegin Meyer",{open:3,waiting:2,free:7,total:24},true),/2 wartende Notrufe/);
assert.match(colleague("Kollege Weber",{open:3,waiting:0,free:5,total:24},true),/3 Einsätze/);
assert.match(colleague("Kollege Braun",null,true),/Lageübersicht/);
assert.match(colleague("Kollegin Schulz",{open:1,waiting:1,free:0,total:24},false),/zum Dienst/);
assert.equal(context.LDFunkspruchAmbient.alertTransitions({waiting:0,free:8},{waiting:1,free:8}).ring,true);
assert.equal(context.LDFunkspruchAmbient.alertTransitions({waiting:1,free:8},{waiting:1,free:7}).radio,true);
assert.equal(context.LDFunkspruchAmbient.alertTransitions(null,{waiting:1,free:7}).ring,false);
const memo=new Map();
const memoStore={getItem:k=>memo.get(k)??null,setItem:(k,v)=>memo.set(k,String(v))};
const journal=context.LDFunkspruchShiftJournal.create(memoStore);
const duty=(minutes,onDuty,dispatch)=>({life:{minutes,onDuty},dispatch});
const orphanStorage=new Map();
const orphanStore={getItem:k=>orphanStorage.get(k)??null,setItem:(k,v)=>orphanStorage.set(k,String(v))};
const orphan=context.LDFunkspruchShiftJournal.create(orphanStore);
assert.equal(orphan.begin(duty(500,true,{open:1,waiting:0,free:3,total:3})),true);
assert.equal(orphan.reconcile(duty(520,false,{open:0,waiting:0,free:3,total:3})),true);
assert.equal(orphan.snapshot().active,null,"Abgebrochene Schicht bleibt aktiv");
assert.equal(orphan.snapshot().reports.length,1,"Abgebrochene Schicht nicht abgeschlossen");
assert.equal(orphan.begin(duty(540,true,{open:0,waiting:0,free:3,total:3})),true,"Neue Schicht nach Wiederherstellung blockiert");
const invalidJournal=context.LDFunkspruchShiftJournal.create({getItem:()=>JSON.stringify({version:1,active:{startMinute:500,updatedMinute:NaN,events:[]},reports:[]}),setItem(){}});
assert.equal(invalidJournal.snapshot().active,null,"Ungültige Schichtdaten übernommen");

assert.equal(journal.begin(duty(480,true,{open:2,waiting:1,free:6,total:10})),true);
journal.record(duty(495,true,{open:3,waiting:2,free:5,total:10}));
assert.equal(journal.recordEvent({kind:"annahme",incidentId:"E12",minute:496}),true);
assert.equal(journal.recordEvent({kind:"alarmierung",incidentId:"E12",minute:497}),true);
assert.equal(journal.recordEvent({kind:"funk",incidentId:"",minute:499}),true);
assert.equal(journal.recordEvent({kind:"ungueltig",incidentId:"E12",minute:499}),false);
const report=journal.finish(duty(510,false,{open:1,waiting:0,free:8,total:10}));
assert.equal(report.durationMinutes,30);
assert.equal(report.events.length,3);
assert.match(journal.format(report),/Einsatz- und Funkchronik/);
assert.match(journal.format(report),/Einsatzmittel alarmiert/);
assert.equal(report.peakWaiting,2);
assert.equal(report.start.open,2);
assert.equal(report.end.open,1);
assert.match(journal.format(report),/Simulierte Schichtdauer: 30 Minuten/);
assert.equal(context.LDFunkspruchShiftJournal.create(memoStore).snapshot().reports.length,1);
const historical=context.LDFunkspruchShiftJournal.create({getItem:()=>null,setItem:()=>{}});
assert.equal(historical.reconcile(duty(600,true,{open:1,waiting:0,free:10,total:10})),true);
assert.equal(historical.snapshot().active.startMinute,600);
assert.equal(historical.reconcile(duty(601,true,{open:1,waiting:0,free:10,total:10})),false);
console.log("OK: "+result.passed+"/"+result.total+" Logiktests, vier KI-Kollegenantworten, Speicherstand-Export/-Import, Dienstpausen und Trinkstation, Tag-Nacht-Zyklus, Desktop-Paket und gesperrter zweiter Modus geprüft.");
