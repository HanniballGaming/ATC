/* Windows-Starttest in echter Electron-Laufzeit – ohne externe BOS-Verbindungen. */
import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import path from "node:path";
import {fileURLToPath} from "node:url";
const cwd=path.dirname(fileURLToPath(import.meta.url));
async function run(){
 const app=await electron.launch({args:["."],cwd,timeout:30000});
 try{
  const page=await app.firstWindow({timeout:30000});
  await page.locator("#startNormal").waitFor({timeout:30000});
  assert.match(page.url(),/^http:\/\/127\.0\.0\.1:47821\/openworld\//);
  assert.equal(await page.locator(".mode.locked button").isDisabled(),true);
  await page.evaluate(()=>localStorage.setItem("funkspruch-smoke-persistence","gespeichert"));
  console.log("Electron: Start, Menü und lokalen Spielstand erfolgreich geprüft.");
 }finally{await app.close();}
}
await run();
await new Promise(resolve=>setTimeout(resolve,1200));
const app=await electron.launch({args:["."],cwd,timeout:30000});
try{
 const page=await app.firstWindow({timeout:30000});
 await page.locator("#startNormal").waitFor({timeout:30000});
 const save=await page.evaluate(()=>localStorage.getItem("funkspruch-smoke-persistence"));
 assert.equal(save,"gespeichert","Speicherstand ging beim Neustart verloren");
 await page.evaluate(()=>localStorage.removeItem("funkspruch-smoke-persistence"));
 console.log("Electron: Speicherstände über Neustart hinweg erhalten.");
}finally{await app.close();}
