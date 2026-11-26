/* Windows-Starttest in echter Electron-Laufzeit – ohne externe BOS-Verbindungen. */
import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import path from "node:path";
import {fileURLToPath} from "node:url";
const cwd=path.dirname(fileURLToPath(import.meta.url));
async function closeChecked(electronApp,label){
 console.log("Electron-Starttest: reguläres Fensterschließen – "+label);
 const child=electronApp.process();
 if(!child||child.exitCode!==null)return;
 let timeout;
 const exited=new Promise((resolve,reject)=>{
  child.once("exit",resolve);
  timeout=setTimeout(()=>{
   try{child.kill();}catch{}
   reject(new Error("Windows-App beendet "+label+" nach Fensterschließen nicht innerhalb von 15 Sekunden."));
  },15000);
 });
 try{
  // Entspricht dem tatsächlichen Klicken auf das Fenster-Schließen-X.
  // app.close() von Playwright prüft nicht denselben Ablauf und kann beim
  // zweiten Elektron-Start auf Windows den Testprozess blockieren.
  try{
   await electronApp.evaluate(({BrowserWindow})=>{
    for(const win of BrowserWindow.getAllWindows())if(!win.isDestroyed())win.close();
   });
  }catch(error){console.warn("Fensterschließen trennte die DevTools-Verbindung:",error.message);}
  await exited;
 }finally{clearTimeout(timeout);}
}
async function run(){
 console.log("Electron-Starttest: erste Instanz starten");
 const app=await electron.launch({args:["."],cwd,timeout:30000});
 try{
  const page=await app.firstWindow({timeout:30000});
  await page.locator("#startNormal").waitFor({timeout:30000});
  assert.match(page.url(),/^http:\/\/127\.0\.0\.1:47821\/openworld\//);
  assert.equal(await page.locator(".mode.locked button").isDisabled(),true);
  await page.evaluate(()=>localStorage.setItem("funkspruch-smoke-persistence","gespeichert"));
  console.log("Electron: Start, Menü und lokalen Spielstand erfolgreich geprüft.");
 }finally{await closeChecked(app,"erste Instanz");}
}
await run();
await new Promise(resolve=>setTimeout(resolve,1200));
console.log("Electron-Starttest: zweite Instanz starten");
const app=await electron.launch({args:["."],cwd,timeout:30000});
try{
 const page=await app.firstWindow({timeout:30000});
 await page.locator("#startNormal").waitFor({timeout:30000});
 const save=await page.evaluate(()=>localStorage.getItem("funkspruch-smoke-persistence"));
 assert.equal(save,"gespeichert","Speicherstand ging beim Neustart verloren");
 await page.evaluate(()=>localStorage.removeItem("funkspruch-smoke-persistence"));
 console.log("Electron: Speicherstände über Neustart hinweg erhalten.");
}finally{await closeChecked(app,"zweite Instanz");}
