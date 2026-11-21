/* Browser-platform logic acceptance for offline dispatch fallback – no Windows required. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";
const folder=path.join(path.dirname(fileURLToPath(import.meta.url)),"web","openworld");
const source=readFileSync(path.join(folder,"fallback-els-core.js"),"utf8");
const sandbox={console,JSON,Math,Date,Map,Set};
sandbox.window=sandbox;
vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:"fallback-els-core.js"});
const E=sandbox.LDFunkspruchFallbackELS;
assert.ok(E&&E.scenarios.length>=8,"Ausfallsicherung enthält zu wenige unterschiedliche Übungslagen");
const mem=new Map();
const storage={getItem:key=>mem.get(key)||null,setItem:(key,value)=>mem.set(key,String(value))};
const events=[];
const s=E.create(storage,{onEvent:e=>events.push(e)});
assert.equal(s.summary().free,7);
assert.throws(()=>s.call(false,0),/einstempeln/);
assert.equal(s.snapshot().seq,0,"Dienstfreie Aktion hat Daten verändert");
const id=s.call(true,0);
assert.equal(id,"E-00001");
assert.equal(s.summary().waiting,1);
assert.throws(()=>s.ask(true,"Wo ist der Einsatzort?"),/annehmen/);
assert.equal(s.accept(true),id);
assert.match(s.ask(true,"Wo genau ist der Einsatzort?"),/Augsburg/);
assert.match(s.ask(true,"Atmet die Person?"),/atmet/i);
assert.equal(s.ask(true,"Wie heißt der Bürgermeister?"),"Dazu habe ich keine gesicherten Angaben.");
assert.equal(s.register(true),id);
assert.equal(s.summary().waiting,0);
assert.equal(s.summary().open,1);
assert.throws(()=>s.close(true,id),/alarmieren/);
assert.equal(s.dispatch(true,id,"RTW 1"),"RTW 1");
assert.equal(s.summary().free,6);
assert.throws(()=>s.dispatch(true,id,"RTW 1"),/nicht verfügbar/);
assert.throws(()=>s.close(true,id),/Einsatzstelle/);
assert.equal(s.advanceUnit(true,"RTW 1"),"anfahrt");
assert.equal(s.advanceUnit(true,"RTW 1"),"einsatzort");
assert.throws(()=>s.close(true,id),/wieder frei/);
assert.equal(s.advanceUnit(true,"RTW 1"),"rueckfahrt");
assert.equal(s.advanceUnit(true,"RTW 1"),"frei");
assert.equal(s.close(true,id),id);
assert.equal(s.summary().free,7);
assert.equal(s.summary().open,0);
assert.ok(events.some(e=>e.kind==="notruf")&&events.some(e=>e.kind==="annahme")&&events.some(e=>e.kind==="alarmierung")&&events.some(e=>e.kind==="abschluss"),"Ereignisbrücke unvollständig");
assert.ok(s.snapshot().radio.length>=5,"Funkmeldungen fehlen");
const recovered=E.create(storage);
assert.equal(recovered.snapshot().incidents[0].phase,"abgeschlossen","Abgeschlossene Einsatzakte nicht gespeichert");
assert.equal(recovered.summary().free,7,"Fahrzeugstatus nach Neuladen verloren");
assert.equal(E.classify("Ist die Person ansprechbar?"),"consciousness");
assert.equal(E.classify("Was ist genau passiert?"),"event");
assert.equal(E.classify("Wie viele Personen sind betroffen?"),"people");
// Persist failure must not mutate in-memory state or dispatch journal.
const failingStorage={getItem:key=>mem.get(key)||null,setItem:()=>{throw Error("Speicher voll");}};
const failed=E.create(failingStorage);
const savedBefore=JSON.stringify(failed.snapshot());
assert.throws(()=>failed.call(true,1),/Speicher voll/);
assert.equal(JSON.stringify(failed.snapshot()),savedBefore,"Halbfertiger Einsatz nach Speicherfehler");
assert.throws(()=>failed.call(true,999),/Unbekanntes Übungsszenario/);
// Broken JSON and invalid vehicle states must not be loaded.
mem.set(E.key,"{defekt");
assert.equal(E.create(storage).summary().free,7,"Beschädigte Sicherung übernommen");
const corrupted=E.initial();
corrupted.vehicles[0].status="erfunden";
mem.set(E.key,JSON.stringify(corrupted));
assert.equal(E.create(storage).snapshot().vehicles[0].status,"frei","Ungültiger Fahrzeugstatus übernommen");
// Exercise every scenario with a complete vehicle lifecycle, ensuring no dead ends.
for(let i=0;i<E.scenarios.length;i++){
 const data=new Map(),store={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,String(value))};
 const sim=E.create(store);
 const name=sim.call(true,i);
 sim.accept(true);
 sim.ask(true,"Was ist passiert?");
 sim.ask(true,"Besteht eine Gefahr?");
 sim.register(true);
 const type=E.scenarios[i].need[0];
 const unit=sim.snapshot().vehicles.find(v=>v.type===type);
 assert.ok(unit,"Kein Fahrzeug für "+E.scenarios[i].type);
 sim.dispatch(true,name,unit.id);
 for(let j=0;j<4;j++)sim.advanceUnit(true,unit.id);
 sim.close(true,name);
 assert.equal(sim.summary().open,0,"Szenario kann nicht abgeschlossen werden: "+E.scenarios[i].type);
}
// Preserve an older open case and its assigned vehicle when the archive fills.
mem.clear();
const volume = E.create(storage);
const open = volume.call(true, 0);
volume.accept(true);
volume.register(true);
volume.dispatch(true, open, "RTW 1");
let newest;
for (let i = 0; i < 80; i++) {
 newest = volume.call(true, 4);
 volume.accept(true);
 volume.register(true);
 assert.throws(() => volume.dispatch(true, newest, "RTW 1"), /nicht verfügbar/);
 volume.dispatch(true, newest, "RTW 2");
 for (let step = 0; step < 4; step++) volume.advanceUnit(true, "RTW 2");
 volume.close(true, newest);
}
const restoredVolume = E.create(storage);
assert.equal(restoredVolume.snapshot().incidents.length, 80);
assert.equal(restoredVolume.snapshot().incidents[0].id, newest);
assert.equal(restoredVolume.snapshot().vehicles[0].incidentId, open);
assert.equal(restoredVolume.summary().open, 1);
for (let step = 0; step < 4; step++) restoredVolume.advanceUnit(true, "RTW 1");
assert.equal(restoredVolume.close(true, open), open);

mem.clear();
const busy = E.create(storage);
for (let i = 0; i < 80; i++) {
 busy.call(true, 4);
 busy.accept(true);
 busy.register(true);
}
assert.throws(() => busy.call(true, 4), /80 offene Einsätze/);
assert.equal(busy.summary().open, 80);

// Version 2 allowed a call to be accepted even with 80 open cases.
const legacy = busy.snapshot();
legacy.seq++;
const legacyCall = {id:"E-00081",template:4,accepted:true,questions:[]};
legacy.active = legacyCall;
mem.set(E.key, JSON.stringify(legacy));
const restoredBusy = E.create(storage);
assert.throws(() => restoredBusy.register(true), /80 offene Einsätze/);
assert.equal(E.create(storage).snapshot().active.id, legacyCall.id);
const oldest = legacy.incidents.at(-1).id;
restoredBusy.dispatch(true, oldest, "RTW 1");
for (let step = 0; step < 4; step++) restoredBusy.advanceUnit(true, "RTW 1");
restoredBusy.close(true, oldest);
assert.equal(restoredBusy.register(true), legacyCall.id);
assert.equal(E.create(storage).summary().open, 80);
assert.equal(E.create(storage).snapshot().incidents[0].id, legacyCall.id);

assert.equal(E.classify("Wie lautet der Straßenname?"), "address");
console.log("OK: Offline-ELS – 8 Übungsszenarien, Notrufannahme, KI-Rückfragen, Disposition, Statusfolge, Funk, Abschluss, Speicherfehler, Neustart, Ereignisbrücke.");
