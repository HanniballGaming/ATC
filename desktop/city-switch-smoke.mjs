/* Browser acceptance: ILS cities load only their local 3D tiles; outside Germany stays simulated.
 * Synthetic tile responses exist exclusively in the test harness. */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";
import {mockCityOsmRoute} from "./osm-test-fixture.mjs";
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),"web");
const server=http.createServer((req,res)=>{
 try{
  const url=new URL(req.url,"http://127.0.0.1");
  let file=path.resolve(root,"."+decodeURIComponent(url.pathname));
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,"index.html");
  if(!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  const ext=path.extname(file).toLowerCase(),mime={".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".webmanifest":"application/manifest+json"};
  res.setHeader("Content-Type",mime[ext]||"application/octet-stream");
  fs.createReadStream(file).pipe(res);
 }catch(error){res.writeHead(500);res.end(String(error));}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
let browser=null;
try{
 browser=await chromium.launch({headless:true,...(process.env.CI?{channel:"chrome"}:{}),args:["--enable-webgl","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:1365,height:860}});
 const errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 page.on("dialog",dialog=>dialog.accept());
 await page.route(/^https?:\/\/(?!127\.0\.0\.1[:\/])[^/]+/i,mockCityOsmRoute);
 const base="http://127.0.0.1:"+server.address().port+"/openworld/";
 await page.goto(base,{waitUntil:"domcontentloaded",timeout:30000});
 await page.waitForFunction(()=>!!window.FunkspruchGame&&document.getElementById("startNormal")?.disabled===false,null,{timeout:40000});
 assert.equal(await page.locator("#ilsCity").inputValue(),"augsburg");
 assert.equal(await page.evaluate(()=>window.FunkspruchWorldMode?.platform),"browser");
 await page.evaluate(()=>{
  const game=window.FunkspruchGame;
  game.toggleDoor();
  window.LDFunkspruchCheckpoints.save(game.saveWorld(),localStorage,"augsburg");
 });
 assert.equal(await page.evaluate(()=>window.FunkspruchGame.status().indoor),true);
 await page.locator("#ilsCity").selectOption("berlin");
 await page.waitForFunction(()=>
  window.FunkspruchWorldMode?.regionId==="berlin"&&!!window.FunkspruchGame&&
  document.getElementById("startNormal")?.disabled===false,null,{timeout:65000});
 const berlin=await page.evaluate(()=>({
  region:window.FunkspruchWorldMode.regionId,
  near:window.FunkspruchWorldMode.classify(13.405,52.52).mode,
  far:window.FunkspruchWorldMode.classify(10.8985,48.3705).mode,
  streets:window.FunkspruchGame.listStreets().length,
  keys:Object.keys(localStorage).filter(key=>key.startsWith("funkspruch-openworld-save-v1"))
 }));
 assert.equal(berlin.region,"berlin");
 assert.equal(berlin.near,"driveable","Geladene ILS-Stadt nicht befahrbar");
 assert.equal(berlin.far,"simulated","Rest Deutschlands wird im Browser als 3D-Welt dargestellt");
 assert.ok(berlin.streets>0,"Keine befahrbaren Straßen in der neu geladenen Stadt");
 assert.ok(berlin.keys.some(key=>key==="funkspruch-openworld-save-v1"),"Augsburger Spielstand wurde beim Stadtwechsel verworfen");
 await page.locator("#ilsCity").selectOption("augsburg");
 await page.waitForFunction(()=>
  window.FunkspruchWorldMode?.regionId==="augsburg"&&!!window.FunkspruchGame&&
  document.getElementById("startNormal")?.disabled===false,null,{timeout:40000});
 const restored=await page.evaluate(()=>({
  indoor:window.FunkspruchGame.status().indoor,
  region:window.FunkspruchGame.saveWorld().regionId,
  berlinSave:!!localStorage.getItem("funkspruch-openworld-save-v1-berlin")
 }));
 assert.equal(restored.indoor,true,"Augsburger 3D-Spielstand nach ILS-Wechsel nicht wiederhergestellt");
 assert.equal(restored.region,"augsburg");
 assert.equal(restored.berlinSave,true,"Separater Berliner Speicherstand nicht angelegt");
 assert.deepEqual(errors,[],"Unbehandelte Browserfehler beim ILS-Wechsel");
 console.log("ILS-Städtewechsel bestanden: Augsburg → Berlin → Augsburg, 3D-Kacheln getrennt, Deutschland außerhalb simuliert, zwei Spielstände erhalten.");
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
