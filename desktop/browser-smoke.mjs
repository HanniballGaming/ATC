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
 browser=await chromium.launch({headless:true,args:["--enable-webgl","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:1365,height:860}});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.stack||e.message));
 await page.goto(base+"/openworld/",{waitUntil:"domcontentloaded",timeout:30000});
 await page.locator("#startNormal").waitFor();
 assert.equal(await page.locator(".mode.locked button").isDisabled(),true,"Zweiter Modus muss gesperrt bleiben");
 await page.locator("#startNormal").click();
 await page.waitForFunction(()=>!!window.FunkspruchGame,{timeout:25000});
 const state=await page.evaluate(()=>{
  const g=window.FunkspruchGame;
  g.toggleDoor();
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
 }
 await page.reload({waitUntil:"domcontentloaded"});
 await page.locator("#startNormal").waitFor();
 assert.match(await page.locator("#startNormal").textContent(),/fortsetzen/);
 await page.locator("#startNormal").click();
 await page.waitForFunction(()=>!!window.FunkspruchGame&&window.FunkspruchGame.status().indoor,{timeout:30000});
 const restored=await page.evaluate(()=>window.FunkspruchGame.status());
 assert.equal(restored.indoor,true,"Gespeicherter Innenraum wurde nicht wiederhergestellt");
 assert.equal(restored.life.onDuty,true,"Gespeicherter Dienststatus wurde nicht wiederhergestellt");
 console.log("Spielstand: Innenraum und Dienststatus nach Neuladen wiederhergestellt.");
 console.log("Browsertest: First Person, Dienstbeginn, Arbeitsplatz, ELS und gesperrter Modus geprüft.");
 console.log("ELS-Ausschnitt:",embeddedGame.slice(0,170).replace(/\s+/g," "));
 assert.equal(errors.filter(error=>error.includes("Invalid LatLng object")).length,0,"Fehlerhafte Kartenkoordinaten im Leitstellenmonitor: "+JSON.stringify(errors.slice(0,4)));
 if(errors.length)console.warn("Weitere Browserfehler:",errors.slice(0,8));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
