/* Gemeinsame Web-Codebasis für Windows zusammenstellen. */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import AdmZip from "adm-zip";
import {createHash} from "node:crypto";
const desktop=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(desktop,"..");
const output=path.join(desktop,"web");
const archive=path.join(root,"LEITSTELLE_DEUTSCHLAND_v0_21.zip");
if(!fs.existsSync(archive))throw Error("Release-Archiv fehlt: "+archive);
fs.rmSync(output,{recursive:true,force:true});
fs.mkdirSync(output,{recursive:true});
new AdmZip(archive).extractAllTo(output,true);
if(!fs.existsSync(path.join(output,"index.html")))throw Error("Einsatzleitsystem fehlt im ZIP.");
fs.cpSync(path.join(root,"public","openworld"),path.join(output,"openworld"),{recursive:true,force:true});
fs.copyFileSync(path.join(root,"funkspruch_embed.js"),path.join(output,"funkspruch_embed.js"));
const index=path.join(output,"index.html");
let html=fs.readFileSync(index,"utf8");
if(!html.includes("funkspruch_embed.js")){
 if(!/<\/body\s*>/i.test(html))throw Error("Hauptspiel hat kein schließendes body-Tag.");
 html=html.replace(/<\/body\s*>/i,'<script src="./funkspruch_embed.js"></script></body>');
}
// Leaflet lokal bereitstellen, damit die Leitstellenkarte ohne CDN starten kann.
const leafletRoot=path.join(desktop,"node_modules","leaflet");
const leafletDist=path.join(leafletRoot,"dist");
if(!fs.existsSync(path.join(leafletDist,"leaflet.js")))throw Error("Leaflet fehlt: npm install erforderlich");
const leafletDest=path.join(output,"vendor","leaflet");
fs.mkdirSync(leafletDest,{recursive:true});
fs.cpSync(leafletDist,leafletDest,{recursive:true});
if(fs.existsSync(path.join(leafletRoot,"LICENSE")))fs.copyFileSync(path.join(leafletRoot,"LICENSE"),path.join(leafletDest,"LICENSE"));
html=html.replaceAll("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js","./vendor/leaflet/leaflet.js")
         .replaceAll("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css","./vendor/leaflet/leaflet.css");
fs.writeFileSync(index,html,"utf8");
const vendor=path.join(output,"openworld","vendor");
fs.mkdirSync(vendor,{recursive:true});
const three=path.join(desktop,"node_modules","three","build","three.min.js");
if(!fs.existsSync(three))throw Error("Three.js fehlt – erst npm install ausführen.");
fs.copyFileSync(three,path.join(vendor,"three.min.js"));
const world=path.join(output,"openworld","index.html");
let worldHTML=fs.readFileSync(world,"utf8");
worldHTML=worldHTML.replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.149\.0\/build\/three\.min\.js/g,"./vendor/three.min.js");
fs.writeFileSync(world,worldHTML,"utf8");
// Installierte iPad-/Browser-PWAs starten grundsätzlich in der neuen 3D-Startansicht,
// nicht versehentlich im alten getrennten Leitstellenspiel.
const manifestPath=path.join(output,"manifest.webmanifest");
let manifest={};
if(fs.existsSync(manifestPath)){
 try{manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));}catch{manifest={};}
}
Object.assign(manifest,{
 name:"FUNKSPRUCH – Stimmen im Rauschen",
 short_name:"FUNKSPRUCH",
 start_url:"./openworld/",
 scope:"./",
 display:"standalone",
 background_color:"#06121e",
 theme_color:"#164b66"
});
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+"\n","utf8");
// iPad-/Browser-PWA: die vollständigen lokalen Startdateien vorab zwischenspeichern.
const entries=[];
const supported=new Set([".html",".js",".css",".json",".webmanifest",".png",".jpg",".jpeg",".svg",".woff",".woff2",".mp3",".ogg",".wav"]);
function collect(directory){
 for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
  const absolute=path.join(directory,entry.name);
  if(entry.isDirectory()){collect(absolute);continue;}
  if(!entry.isFile()||absolute===path.join(output,"sw.js"))continue;
  if(!supported.has(path.extname(absolute).toLowerCase()))continue;
  entries.push({relative:path.relative(output,absolute).split(path.sep).join("/"),absolute});
 }
}
collect(output);
entries.sort((a,b)=>a.relative.localeCompare(b.relative));
const digest=createHash("sha256");
for(const entry of entries){digest.update(entry.relative);digest.update(fs.readFileSync(entry.absolute));}
const cache="funkspruch-pwa-"+digest.digest("hex").slice(0,14);
const assets=["./","./openworld/",...entries.map(entry=>"./"+entry.relative)];
const swSource=[
 "/* FUNKSPRUCH: lokal erzeugter, versionierter Offline-Serviceworker. */",
 "const CACHE="+JSON.stringify(cache)+";",
 "const ASSETS="+JSON.stringify(assets)+";",
 'self.addEventListener("install",event=>{',
 ' event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));',
 '});',
 'self.addEventListener("activate",event=>{',
 ' event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("funkspruch-pwa-")&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));',
 '});',
 'self.addEventListener("fetch",event=>{',
 ' if(event.request.method!=="GET")return;',
 ' const url=new URL(event.request.url);',
 ' if(url.origin!==self.location.origin)return;',
 ' event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));',
 '});'
].join("\n")+"\n";
fs.writeFileSync(path.join(output,"sw.js"),swSource,"utf8");
console.log("PWA-Offline-Cache mit "+assets.length+" Dateien erzeugt.");
console.log("Hauptspiel, 3D-Welt und Arbeitsplätze für Windows zusammengestellt.");
