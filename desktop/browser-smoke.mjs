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
 page.on("pageerror",e=>errors.push(e.message));
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
 await page.waitForFunction(()=>document.getElementById("dispatchMonitor")?.getAttribute("src")!==null);
 const outer=page.frameLocator("#dispatchMonitor");
 await outer.locator("#els").waitFor({timeout:15000});
 assert.match(await outer.locator("#els").getAttribute("src"),/fs_embed=1/);
 const embedded=outer.frameLocator("#els");
 await embedded.locator("body").waitFor({timeout:20000});
 const embeddedGame=await embedded.locator("body").evaluate(node=>node.innerText.slice(0,300));
 assert.ok(embeddedGame.length>0,"Vollständiges ELS nicht geladen");
 const modules=await embedded.locator("body").evaluate(()=>({
   operations:typeof window.LDOperations,
   ai:typeof window.LDAI23,
   firstPerson:typeof window.LDFirstPerson22,
   buttons:Array.from(document.querySelectorAll("#app .menu button")).map(b=>b.textContent.trim()).slice(0,15)
 }));
 console.log("Hauptspiel-Module und Menü:",JSON.stringify(modules));
 assert.equal(modules.operations,"object","Einsatzlogik nicht eingebunden");
 assert.notEqual(modules.ai,"undefined","Notruf- und Team-KI fehlt");
 console.log("Browsertest: First Person, Dienstbeginn, Arbeitsplatz, ELS und gesperrter Modus geprüft.");
 console.log("ELS-Ausschnitt:",embeddedGame.slice(0,170).replace(/\s+/g," "));
 if(errors.length)console.warn("Weitere Browserfehler:",errors.slice(0,8));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
