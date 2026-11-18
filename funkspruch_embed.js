/* FUNKSPRUCH – Einbettung des vorhandenen Einsatzleitsystems in den 3D-Arbeitsplatz.
 * Wird ausschließlich bei ?fs_embed=1 aktiv; kein Zugriff auf echte Notrufsysteme.
 */
(()=>{"use strict";
if(new URLSearchParams(location.search).get("fs_embed")!=="1"||window.parent===window)return;
const host=window.parent;
const context={onDuty:false,minutes:null,synced:false,opened:false};
const style=document.createElement("style");
style.textContent=[
"html,body{min-height:100%!important}",
"body.fs-embed-active{overflow:hidden!important}",
"body.fs-embed-active #ld22-hud,body.fs-embed-active #ld22-briefing,body.fs-embed-active #ld16-panel,body.fs-embed-active .roomcontrols{display:none!important}",
"body.fs-embed-active #elsdesk{display:block!important;position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;max-height:none!important;max-width:none!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;z-index:99999!important;box-shadow:none!important}",
"body.fs-embed-active #app .game>.room{display:none!important}",
"body.fs-embed-active #app .game{height:100dvh!important;min-height:0!important}"
].join("\n");
document.head.append(style);
let lastReport="";
function report(status,message){
 const label=status+":"+(message||"");
 if(label===lastReport)return;
 lastReport=label;
 host.postMessage({type:"funkspruch:embedded-status",status,message:message||""},location.origin);
}
window.addEventListener("message",event=>{
 if(event.source!==host||event.origin!==location.origin||event.data?.type!=="funkspruch:desk-context")return;
 context.onDuty=event.data.onDuty===true;
 context.minutes=Number.isFinite(event.data.minutes)?event.data.minutes:null;
 update();
});
function update(){
 const ops=window.LDOperations;
 const s=ops?.getState?.()||window.getGame?.()?.s;
 const gameVisible=!!document.querySelector("#app .game")&&!document.querySelector("#app .menu");
 if(!s||!gameVisible){
   context.opened=false;document.body.classList.remove("fs-embed-active");
   report("menue","Leitstelle im Einsatzleitsystem auswählen");
   return;
 }
 if(!context.onDuty){
   document.body.classList.remove("fs-embed-active");
   report("dienstfrei","Vorher in der 3D-Leitstelle einstempeln");
   return;
 }
 // Die Schicht wurde bereits an der physischen Stechuhr übernommen.
 // Das ELS stellt keine zweite, unabhängige Schichtprüfung.
 if(!s.ld22Completed){
   s.ld22Init=true;s.ld22Completed=true;s.ld22WasPaused=false;
   s.ld22Checks={login:true,phone:true,radio:true,handover:true};
   s.ld22StartedAt=s.minute;
   s.paused=false;
   ops?.save?.();
 }
 if(!context.synced&&context.minutes!==null&&Number.isFinite(s.minute)){
   s.minute=((Math.round(context.minutes)%1440)+1440)%1440;
   context.synced=true;
   ops?.save?.();
 }
 if(typeof window.openWorkstation!=="function"){
   report("initialisierung","Das Einsatzleitsystem wird geladen");
   return;
 }
 const workstationOpen=window.LDWorkstation?.isOpen?.();
 if(!context.opened||workstationOpen===false){
   try{window.openWorkstation("call");context.opened=true;}
   catch(e){report("fehler",String(e.message||e));return;}
 }
 document.body.classList.add("fs-embed-active");
 report("bereit","Notruf, Einsatzakte und Funk sind verfügbar");
}
document.addEventListener("DOMContentLoaded",()=>{report("initialisierung","Einsatzleitsystem startet");update();});
window.addEventListener("pagehide",()=>window.LDOperations?.save?.());
setInterval(update,700);
setTimeout(()=>host.postMessage({type:"funkspruch:embedded-ready"},location.origin),0);
})();
