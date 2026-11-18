/* FUNKSPRUCH: Loopback-Server mit fester Origin für dauerhafte Speicherstände. */
"use strict";
const {app,BrowserWindow,shell,session,dialog}=require("electron");
const fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const ROOT=path.resolve(__dirname,"web"),HOST="127.0.0.1",PORT=47821,ORIGIN="http://"+HOST+":"+PORT;
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".webmanifest":"application/manifest+json; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".svg":"image/svg+xml",".woff2":"font/woff2",".mp3":"audio/mpeg",".ogg":"audio/ogg",".wav":"audio/wav",".webp":"image/webp",".ico":"image/x-icon"};
let server=null,win=null,forcedQuitTimer=null;
const activeSockets=new Set();
function closeServer(){
 if(!server)return;
 const existing=server;server=null;
 try{existing.closeAllConnections?.();}catch{}
 try{existing.close();}catch{}
 for(const socket of activeSockets){try{socket.destroy();}catch{}}
 activeSockets.clear();
}
const single=app.requestSingleInstanceLock();
if(!single)app.quit();
else{
 app.on("second-instance",()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
 app.whenReady().then(start).catch(err=>{dialog.showErrorBox("FUNKSPRUCH – Startfehler",String(err.stack||err));app.quit();});
 app.on("window-all-closed",()=>app.quit());
 app.on("before-quit",()=>{
  closeServer();
  // Beenden selbst bei hängendem Renderprozess: normale Schließroutine erhält 3 Sekunden.
  if(!forcedQuitTimer)forcedQuitTimer=setTimeout(()=>{
   if(win&&!win.isDestroyed())win.destroy();
  },3000);
  forcedQuitTimer.unref?.();
 });
 app.on("will-quit",closeServer);
}
function serve(req,res){
 try{
  if(req.method!=="GET"&&req.method!=="HEAD"){res.writeHead(405);res.end();return;}
  const u=new URL(req.url,ORIGIN),pathname=decodeURIComponent(u.pathname);
  if(pathname.includes("\0"))throw Error("Ungültiger Pfad");
  let target=path.resolve(ROOT,"."+pathname);
  if(target!==ROOT&&!target.startsWith(ROOT+path.sep))throw Error("Pfad außerhalb der App");
  if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,"index.html");
  if(!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end("Nicht gefunden");return;}
  const real=fs.realpathSync(target);
  if(real!==ROOT&&!real.startsWith(ROOT+path.sep))throw Error("Ungültiges Dateiziel");
  const stat=fs.statSync(real),ext=path.extname(real).toLowerCase();
  res.writeHead(200,{"Content-Type":MIME[ext]||"application/octet-stream","Content-Length":stat.size,"Cache-Control":"no-cache","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"});
  if(req.method==="HEAD"){res.end();return;}
  const stream=fs.createReadStream(real);
  stream.on("error",()=>{if(!res.headersSent)res.writeHead(500);res.end();});
  stream.pipe(res);
 }catch(e){res.writeHead(403);res.end("Zugriff verweigert");}
}
async function start(){
 if(!single)return;
 await new Promise((resolve,reject)=>{
  server=http.createServer(serve);
  server.on("connection",socket=>{
   activeSockets.add(socket);
   socket.on("close",()=>activeSockets.delete(socket));
  });
  server.once("error",reject);
  server.listen(PORT,HOST,resolve);
 });
 session.defaultSession.setPermissionRequestHandler((webContents,permission,callback,details)=>{
  const origin=details?.requestingUrl||webContents.getURL();
  callback(permission==="media"&&origin.startsWith(ORIGIN+"/"));
 });
 win=new BrowserWindow({width:1440,height:900,minWidth:960,minHeight:620,backgroundColor:"#071522",
  title:"FUNKSPRUCH – Stimmen im Rauschen",autoHideMenuBar:true,show:false,
  webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,backgroundThrottling:false}});
 win.once("ready-to-show",()=>win.show());
 win.webContents.setWindowOpenHandler(({url})=>{
  if(/^https?:\/\//i.test(url)&&!url.startsWith(ORIGIN+"/"))shell.openExternal(url).catch(()=>{});
  return {action:"deny"};
 });
 win.webContents.on("will-navigate",(event,url)=>{
  if(!url.startsWith(ORIGIN+"/")){event.preventDefault();if(/^https?:\/\//i.test(url))shell.openExternal(url).catch(()=>{});}
 });
 await win.loadURL(ORIGIN+"/openworld/");
}
