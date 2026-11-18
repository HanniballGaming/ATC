/* End-to-end-Smoke-Test: normaler Modus, 3D-Start, Schicht und vollständiger Monitor. */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),"web");
const server=http.createServer((req,res)=>{
 try{
  const url=new URL(req.url,"http://127.0.0.1");
  let file=path.resolve(root,"."+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);res.end();return;}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,"index.html");
  if(!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  const ext=path.extname(file),mime={".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".png":"image/png"};
  res.setHeader("Content-Type",mime[ext]||"application/octet-stream");
  fs.createReadStream(file).pipe(res);
 }catch(e){res.writeHead(500);res.end(String(e));}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const base="http://127.0.0.1:"+server.address().port;
let browser=null;
try{
 browser=await chromium.launch({headless:true,...(process.env.CI?{channel:"chrome"}:{}),args:["--enable-webgl","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:1365,height:860}});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.stack||e.message));
 // Testet den vollständigen Kernbetrieb auch ohne Verbindung zu externen CDNs.
 await page.route(/^https?:\/\/(?!127\.0\.0\.1[:\/])[^/]+/i,route=>route.abort());
 await page.goto(base+"/openworld/",{waitUntil:"domcontentloaded",timeout:30000});
 await page.locator("#startNormal").waitFor();
 assert.equal(await page.locator(".mode.locked button").isDisabled(),true,"Zweiter Modus muss gesperrt bleiben");
 await page.locator("#startNormal").click();
 try{
  await page.waitForFunction(()=>!!window.FunkspruchGame,null,{timeout:14000});
 }catch(error){
  const debug=await page.evaluate(()=>({
   title:document.title,
   info:document.getElementById("info")?.textContent?.slice(0,1800),
   menuHidden:document.getElementById("mainMenu")?.hidden,
   fatal:document.body.classList.contains("fatal"),
   three:typeof window.THREE,
   integration:typeof window.LDOpenWorldIntegrationTests,
   runtime:typeof window.LDOpenWorldRuntime,
   game:typeof window.FunkspruchGame
  }));
  throw new Error("3D-Initialisierung fehlgeschlagen: "+JSON.stringify(debug)+"; JS-Fehler: "+JSON.stringify(errors.slice(0,6))+"; "+error.message);
 }
 await page.keyboard.press("Escape");
 await page.locator("#mainMenu").waitFor({state:"visible"});
 assert.match(await page.locator("#startNormal").textContent(),/fortsetzen/i,"Pausenmenü fehlt");
 await page.locator("#startNormal").click();
 await page.locator("#mainMenu").waitFor({state:"hidden"});
 // E-Taste und WASD werden direkt über die Spieleingabe bedient.
 await page.evaluate(()=>{window.__fsLastKeys=[];window.addEventListener("keydown",e=>window.__fsLastKeys.push(e.code),{capture:true,once:false});});
 await page.keyboard.press("KeyE");
 const keyDebug=await page.evaluate(()=>({keys:window.__fsLastKeys,world:window.FunkspruchGame?.status(),activeTag:document.activeElement?.tagName}));
 console.log("Tastatur und Ausgangsposition:",JSON.stringify(keyDebug).slice(0,2000));
 await page.waitForFunction(()=>window.FunkspruchGame?.status()?.indoor,{timeout:10000});
 const beforeMove=await page.evaluate(()=>window.FunkspruchGame.walker.snapshot());
 await page.keyboard.down("w");
 await page.waitForTimeout(420);
 await page.keyboard.up("w");
 const afterMove=await page.evaluate(()=>window.FunkspruchGame.walker.snapshot());
 assert.ok(Math.hypot(afterMove.x-beforeMove.x,afterMove.z-beforeMove.z)>.04,"WASD-Fortbewegung funktioniert nicht");
 const state=await page.evaluate(()=>{
  const g=window.FunkspruchGame;
  g.walker.teleport(-5.5,-4.5);
  g.stamp();
  g.walker.teleport(1,-1.3);
  g.sitDesk();
  return g.status();
 });
 assert.equal(state.life.onDuty,true,"Schichtbeginn fehlgeschlagen");
 assert.equal(state.atDesk,true,"Arbeitsplatz nicht aktiv");
 await page.evaluate(()=>{
  const g=window.FunkspruchGame;
  localStorage.setItem("funkspruch-openworld-save-v1",JSON.stringify(g.saveWorld()));
 });
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("funkspruch-openworld-save-v1")));
 assert.equal(saved.indoor,true,"Innenraum nicht speicherbar");
 assert.equal(saved.onDuty,true,"Dienststatus nicht speicherbar");
 await page.waitForFunction(()=>document.getElementById("dispatchMonitor")?.getAttribute("src")!==null);
 const outer=page.frameLocator("#dispatchMonitor");
 await outer.locator("#els").waitFor({timeout:15000});
 assert.match(await outer.locator("#els").getAttribute("src"),/fs_embed=1/);
 const embedded=outer.frameLocator("#els");
 await embedded.locator("body").waitFor({timeout:20000});
 let embeddedGame="";
 for(let n=0;n<35;n++){
   try{embeddedGame=await embedded.locator("body").evaluate(node=>window.LDOperations?.getState!==undefined?node.innerText.slice(0,300):"");}catch{}
   if(embeddedGame.length>40)break;
   await page.waitForTimeout(400);
 }
 assert.ok(embeddedGame.length>40,"Vollständiges ELS nicht geladen");
 const modules=await embedded.locator("body").evaluate(()=>({
   operations:typeof window.LDOperations,
   ai:typeof window.LDAI23,
   firstPerson:typeof window.LDFirstPerson22,
   buttons:Array.from(document.querySelectorAll("#app .menu button")).map(b=>b.textContent.trim()).slice(0,15)
 }));
 console.log("Hauptspiel-Module und Menü:",JSON.stringify(modules));
 assert.equal(modules.operations,"object","Einsatzlogik nicht eingebunden");
 assert.notEqual(modules.ai,"undefined","Notruf- und Team-KI fehlt");
 const newGame=embedded.locator("#app .menu button",{hasText:"Neuen Spielstand starten"});
 if(await newGame.count()){
   await newGame.click();
   const checks=embedded.locator("#ld22-briefing.open input[data-check]");
   await checks.first().waitFor({state:"visible",timeout:15000});
   for(const name of ["login","phone","radio","handover"])
     await embedded.locator('#ld22-briefing input[data-check="'+name+'"]').check();
   await embedded.locator('#ld22-briefing [data-brief="begin"]').click();
   await embedded.locator("body.fs-embed-active").waitFor({state:"visible",timeout:15000});
   const next=await embedded.locator("#app").evaluate(el=>({
     preview:el.innerText.slice(0,1100),
     inputs:Array.from(el.querySelectorAll("select, input")).map(i=>({type:i.tagName,id:i.id,options:i.tagName==="SELECT"?Array.from(i.options).slice(0,5).map(o=>o.textContent):[]})).slice(0,10),
     buttons:Array.from(el.querySelectorAll("button")).slice(0,20).map(b=>b.textContent.trim())
   }));
   console.log("ELS-Menü nach Neu:",JSON.stringify(next));
   const embeddedStatus=await embedded.locator("body").evaluate(()=>({
     active:document.body.classList.contains("fs-embed-active"),
     workstationOpen:window.LDWorkstation?.isOpen?.()??null,
     onDuty:window.LDOperations?.getState?.()?.ld22Completed??null,
     elsDeskVisible:!!document.querySelector("#elsdesk")
   }));
   console.log("ELS-Einbettung:",JSON.stringify(embeddedStatus));
   assert.equal(embeddedStatus.active,true,"Monitor nicht als Spielbildschirm eingebettet");
   assert.equal(embeddedStatus.workstationOpen,true,"ELS-Monitor nicht geöffnet");
   assert.equal(embeddedStatus.onDuty,true,"Leitplatzprüfung nicht abgeschlossen");
   await page.waitForFunction(()=>window.FunkspruchGame?.status()?.dispatch!==null,{timeout:12000});
   const summary=await page.evaluate(()=>window.FunkspruchGame.status().dispatch);
   assert.ok(Number.isInteger(summary.open)&&Number.isInteger(summary.waiting)&&Number.isInteger(summary.free),"ELS-Lage nicht an 3D-Monitore übergeben");
   console.log("3D-Monitore mit echter ELS-Lage synchronisiert:",JSON.stringify(summary));
   // End-to-End-Fallbearbeitung: Notruf, Rückfrage, dokumentierte KI-Antwort.
   const conversation=await embedded.locator("body").evaluate(()=>{
     const s=window.LDOperations.getState();
     const issue=s.incidents.find(i=>["Anruf","Unversorgt"].includes(i.phase));
     if(!issue)return {error:"Kein übernehmbarer Übungsnotruf im Spielstand"};
     window.LDLogic.accept(s,issue.id,()=>{},"Eigenplatz");
     const response=window.LDLogic.converse(s,issue.id,"Wo genau ist der Einsatzort?",()=>{});
     window.LDOperations.save?.();
     window.refreshWorkstation?.();
     return {phase:issue.phase,answer:response?.answer||"",matched:!!response?.matched,turns:issue.transcript?.length||0};
   });
   console.log("KI-Notrufannahme:",JSON.stringify(conversation));
    const dispatchApi=await embedded.locator("body").evaluate(()=>{
      const s=window.LDOperations?.getState?.();
      return {methods:Object.keys(window.LDLogic||{}),ops:Object.keys(window.LDOperations||{}),active:s?.incidents?.slice(0,1).map(i=>({id:i.id,phase:i.phase,owner:i.owner,assigned:i.units,keys:Object.keys(i)})),vehicle:s?.vehicles?.slice(0,1)};
    });
    console.log("ELS-Dispositionsstruktur:",JSON.stringify(dispatchApi).slice(0,3200));
    const logicSignatures=await embedded.locator("body").evaluate(()=>({dispatch:window.LDLogic.dispatch.toString().slice(0,3400),radio:window.LDLogic.radio.toString().slice(0,2600),opsDispatch:window.LDOperations.dispatch.toString().slice(0,1800)}));
    console.log("ELS-Dispositionsfunktionen:",JSON.stringify(logicSignatures).slice(0,7500));
    const deployed=await embedded.locator("body").evaluate(()=>{
      const ops=window.LDOperations,s=ops.getState();
      const incident=s.incidents.find(i=>i.phase==="Disponierung"&&i.owner==="Eigenplatz");
      if(!incident)return {error:"Kein disponierbarer Notruf nach Annahme"};
      const need=Array.isArray(incident.need)?incident.need:typeof incident.need==="string"?[incident.need]:[];
      const unit=s.vehicles.find(v=>v.status==="frei"&&need.includes(v.type))||s.vehicles.find(v=>v.status==="frei"&&v.type==="RTW");
      if(!unit)return {error:"Kein freies disponierbares Fahrzeug"};
      const before=unit.status,radioBefore=s.radioLog?.length||0;
      const dispatched=ops.dispatch(incident.id,unit.type,unit.id);
      const assigned=incident.assigned?.includes(unit.id)||unit.incident===incident.id;
      const radioAccepted=ops.radio(unit.id,"Leitstelle an "+unit.id+": Bitte kommen.");
      return {dispatched,assigned,radioAccepted,unit:unit.id,before,after:unit.status,incident:incident.id,assignedList:incident.assigned,radioAdded:(s.radioLog?.length||0)>radioBefore,need};
    });
    console.log("ELS-Fahrzeugdisposition und Funk:",JSON.stringify(deployed));
    assert.ok(!deployed.error,deployed.error||"");
    assert.equal(deployed.dispatched,true,"Fahrzeug wurde nicht disponiert");
    assert.equal(deployed.assigned,true,"Fahrzeug ist nicht dem Einsatz zugeordnet");
    // LDOperations.radio schreibt das Funkprotokoll, liefert aber keinen Erfolgswert zurück.
    // Der überprüfte Protokolleintrag ist das tatsächliche Erfolgsmerkmal.
    assert.equal(deployed.radioAdded,true,"Funkspruch wurde nicht protokolliert");
   assert.ok(!conversation.error,conversation.error||"");
   assert.ok(conversation.matched&&conversation.answer.length>15,"KI-Rückfrage liefert keine passende Antwort");
   assert.ok(conversation.turns>=2,"Gesprächsprotokoll wurde nicht angelegt");
   assert.ok(!["Anruf","Unversorgt"].includes(conversation.phase),"Notruf konnte nicht angenommen werden");
   await page.waitForFunction(()=>window.FunkspruchGame.status().dispatch?.waiting===0,null,{timeout:12000});
   // Schichtende tatsächlich an der 3D-Stechuhr: Einsatzsimulation pausiert.
   await page.evaluate(()=>{
     const g=window.FunkspruchGame;
     g.leaveDesk();
     g.walker.teleport(-5.5,-4.5);
     g.stamp();
   });
   let offDuty;
   for(let n=0;n<25;n++){
     offDuty=await embedded.locator("body").evaluate(()=>{
       const s=window.LDOperations.getState();
       return {paused:s.paused,byDuty:s.funkspruchPausedByDuty===true};
     });
     if(offDuty.byDuty&&offDuty.paused)break;
     await page.waitForTimeout(350);
   }
   assert.equal(offDuty.byDuty,true,"Leitstelle läuft nach dem Ausstempeln weiter");
   assert.equal(offDuty.paused,true,"Einsatzsimulation bei Dienstende nicht angehalten");
   // Nächste Schicht: zuvor laufende Simulation wieder aufnehmen, Fortschritt behalten.
   await page.evaluate(()=>{
     const g=window.FunkspruchGame;
     g.walker.teleport(-5.5,-4.5);
     g.stamp();
     g.walker.teleport(1,-1.3);
     g.sitDesk();
   });
   let newDuty;
   for(let n=0;n<25;n++){
     newDuty=await embedded.locator("body").evaluate(()=>{
       const s=window.LDOperations.getState();
       return {paused:!!s.paused,byDuty:!!s.funkspruchPausedByDuty};
     });
     if(!newDuty.byDuty&&!newDuty.paused)break;
     await page.waitForTimeout(350);
   }
   assert.equal(newDuty.byDuty,false,"Dienstsimulation nicht wiederaufgenommen");
   assert.equal(newDuty.paused,false,"Simulation nach neuer Schicht weiterhin pausiert");
   console.log("Dienstende und erneute Schichtübernahme: Einsatzsimulation pausiert und setzt korrekt fort.");

 }
 await page.reload({waitUntil:"domcontentloaded"});
 await page.locator("#startNormal").waitFor();
 await page.waitForFunction(()=>!document.getElementById("startNormal")?.disabled,{timeout:30000});
 assert.match(await page.locator("#startNormal").textContent(),/fortsetzen/);
 await page.locator("#startNormal").click();
 await page.waitForFunction(()=>!!window.FunkspruchGame&&window.FunkspruchGame.status().indoor,{timeout:30000});
 const restored=await page.evaluate(()=>window.FunkspruchGame.status());
 assert.equal(restored.indoor,true,"Gespeicherter Innenraum wurde nicht wiederhergestellt");
 assert.equal(restored.life.onDuty,true,"Gespeicherter Dienststatus wurde nicht wiederhergestellt");
 console.log("Spielstand: Innenraum und Dienststatus nach Neuladen wiederhergestellt.");
 console.log("Browsertest: First Person, Dienstbeginn, Arbeitsplatz, ELS und gesperrter Modus geprüft.");
 const tablet=await browser.newPage({viewport:{width:820,height:1180},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 try{
  await tablet.goto(base+"/openworld/",{waitUntil:"domcontentloaded",timeout:30000});
  await tablet.locator("#startNormal").click({timeout:30000});
  await tablet.waitForFunction(()=>!!window.FunkspruchGame,{timeout:30000});
  const touch=await tablet.evaluate(()=>!!document.querySelector('[aria-label="FUNKSPRUCH – Touchsteuerung"]'));
  assert.equal(touch,true,"Tablet-Touchsteuerung nicht initialisiert");
  const mobileDesk=await tablet.evaluate(()=>{
   const g=window.FunkspruchGame;
   g.toggleDoor();g.walker.teleport(-5.5,-4.5);g.stamp();g.walker.teleport(1,-1.3);g.sitDesk();
   const r=document.querySelector("#monitor").getBoundingClientRect();
   return {width:r.width,viewport:innerWidth,active:document.querySelector("#monitor").classList.contains("active")};
  });
  assert.equal(mobileDesk.active,true,"Tablet-Monitor nicht geöffnet");
  assert.ok(mobileDesk.width>=mobileDesk.viewport*.94,"Tablet-Monitor ist nicht bildschirmfüllend");
  console.log("Tablet: Touchsteuerung und bildschirmfüllender Arbeitsplatz geprüft.");
 }finally{await tablet.close();}
 console.log("ELS-Ausschnitt:",embeddedGame.slice(0,170).replace(/\s+/g," "));
 assert.equal(errors.filter(error=>error.includes("Invalid LatLng object")).length,0,"Fehlerhafte Kartenkoordinaten im Leitstellenmonitor: "+JSON.stringify(errors.slice(0,4)));
 if(errors.length)throw Error("Unbehandelte Browserfehler: "+JSON.stringify(errors.slice(0,8)));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
