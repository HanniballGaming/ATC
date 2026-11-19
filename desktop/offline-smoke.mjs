/* PWA offline acceptance: cached world and embedded dispatcher work with network disabled. */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";
import {mockOsmRoute} from "./osm-test-fixture.mjs";
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),"web");
const server=http.createServer((request,response)=>{
 try{
  const target=new URL(request.url,"http://127.0.0.1");
  let filename=path.resolve(root,"."+decodeURIComponent(target.pathname));
  if(filename!==root&&!filename.startsWith(root+path.sep)){response.writeHead(403);response.end();return;}
  if(fs.existsSync(filename)&&fs.statSync(filename).isDirectory())filename=path.join(filename,"index.html");
  if(!fs.existsSync(filename)){response.writeHead(404);response.end();return;}
  const mime={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".webmanifest":"application/manifest+json",".png":"image/png"};
  response.setHeader("Content-Type",mime[path.extname(filename)]||"application/octet-stream");
  fs.createReadStream(filename).pipe(response);
 }catch(error){response.writeHead(500);response.end(error.message);}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
let browser=null;
try{
 browser=await chromium.launch({headless:true,...(process.env.CI?{channel:"chrome"}:{}),args:["--enable-webgl","--use-gl=angle","--use-angle=swiftshader"]});
 const context=await browser.newContext({viewport:{width:1200,height:850},serviceWorkers:"allow"});
 const page=await context.newPage(),errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.route(/^https?:\/\/(?!127\.0\.0\.1[:\/])[^/]+/i,mockOsmRoute);
 const url="http://127.0.0.1:"+server.address().port+"/openworld/";
 await page.goto(url,{waitUntil:"domcontentloaded",timeout:30000});
 await page.waitForFunction(()=>!!window.FunkspruchGame,{timeout:30000});
 await page.waitForFunction(async()=>{
  if(!navigator.serviceWorker?.controller)return false;
  return (await caches.keys()).some(key=>key.startsWith("funkspruch-pwa-"));
 },null,{timeout:40000});
 const before=await page.evaluate(()=>({
  worker:!!navigator.serviceWorker.controller,
  cache:location.origin,
  streets:window.FunkspruchGame.listStreets().length
 }));
 assert.equal(before.worker,true,"PWA besitzt vor Offline-Wechsel keinen aktiven Serviceworker");
 assert.ok(before.streets>0,"Reale Straßennamen fehlen bereits online");
 await context.setOffline(true);
 await page.reload({waitUntil:"domcontentloaded",timeout:30000});
 await page.waitForFunction(()=>!!window.FunkspruchGame&&!document.querySelector("#startNormal")?.disabled,null,{timeout:30000});
 await page.locator("#startNormal").click();
 await page.evaluate(()=>{
  const game=window.FunkspruchGame;
  game.toggleDoor();
  game.walker.teleport(-5.5,-4.5);
  game.stamp();
  game.walker.teleport(1,-1.3);
  game.sitDesk();
 });
 const embedded=page.frameLocator("#dispatchMonitor").frameLocator("#els");
 await embedded.locator("body").waitFor({timeout:20000});
 let info=null;
 for(let i=0;i<35;i++){
  try{info=await embedded.locator("body").evaluate(()=>({logic:typeof window.LDOperations,query:location.search}));}
  catch{}
  if(info?.logic==="object")break;
  await page.waitForTimeout(350);
 }
 assert.equal(info?.logic,"object","Haupt-ELS lässt sich offline nicht öffnen");
 assert.match(info.query,/fs_embed=1/,"Offline-Dienst verliert eingebetteten ELS-Modus");
 const scene=await page.evaluate(()=>window.FunkspruchGame.status());
 assert.equal(scene.indoor,true);
 assert.equal(scene.life.onDuty,true);
 assert.ok(!errors.some(x=>/ReferenceError|SyntaxError|TypeError/.test(x)),"Offline-Fehler: "+JSON.stringify(errors));
 console.log("PWA-Offline-Abnahme: 3D-Stadt, Street-OSM-Cache, Dienstbeginn und vollständiges ELS mit ?fs_embed=1 bestanden.");
 await context.setOffline(false);
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
