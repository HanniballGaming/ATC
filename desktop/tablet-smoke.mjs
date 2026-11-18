/* Touchscreen-Abnahme: First Person, mobile Steuerung, Leitstellenzugang. */
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
  let filename=path.resolve(root,"."+decodeURIComponent(url.pathname));
  if(filename!==root&&!filename.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  if(fs.existsSync(filename)&&fs.statSync(filename).isDirectory())filename=path.join(filename,"index.html");
  if(!fs.existsSync(filename)){res.writeHead(404);res.end();return;}
  const mime={".html":"text/html",".js":"text/javascript",".css":"text/css",".png":"image/png",".webmanifest":"application/manifest+json"};
  res.setHeader("Content-Type",mime[path.extname(filename)]||"application/octet-stream");
  fs.createReadStream(filename).pipe(res);
 }catch(e){res.writeHead(500);res.end(String(e));}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
const origin="http://127.0.0.1:"+server.address().port;
let browser=null;
try{
 browser=await chromium.launch({headless:true,args:["--enable-webgl","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:820,height:1180},hasTouch:true,isMobile:true,deviceScaleFactor:1});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.route(/^https?:\/\/(?!127\.0\.0\.1[:\/])[^/]+/i,route=>route.abort());
 await page.goto(origin+"/openworld/",{waitUntil:"domcontentloaded",timeout:30000});
 await page.locator("#startNormal").click({timeout:30000});
 await page.waitForFunction(()=>!!window.FunkspruchGame,null,{timeout:30000});
 const touch=page.locator('[aria-label="FUNKSPRUCH – Touchsteuerung"]');
 await touch.waitFor({state:"visible"});
 assert.equal(await touch.locator('[role="group"]').count(),2,"Zwei Touchsticks fehlen");
 assert.equal((await page.evaluate(()=>window.FunkspruchGame.status())).nearDoor,true,"Eingang nicht in Reichweite");
 await touch.getByRole("button",{name:"Interagieren"}).tap({timeout:15000});
 await page.waitForFunction(()=>window.FunkspruchGame.status().indoor,null,{timeout:10000});
 const state=await page.evaluate(()=>window.FunkspruchGame.status());
 assert.equal(state.indoor,true,"Touch-Interaktion öffnet die Leitstelle nicht");
 assert.ok(!errors.some(x=>/TypeError|ReferenceError|Invalid LatLng/.test(x)),"Mobile Spielfehler: "+JSON.stringify(errors));
 console.log("Mobile Abnahme: 820px Touchdisplay, 2 Sticks, Interagieren und 3D-Leitstelle bestanden.");
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
