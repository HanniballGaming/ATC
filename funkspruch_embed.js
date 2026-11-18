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
let lastReport="",lastSummary="",previousIncidents=null,previousRadioCount=null;
function shareSummary(s){
 if(!s||!Array.isArray(s.incidents)||!Array.isArray(s.vehicles))return;
 const payload={
  type:"funkspruch:dispatch-summary",
  minute:Number.isFinite(s.minute)?Math.round(s.minute):null,
  open:s.incidents.filter(i=>i&&i.phase!=="Abgeschlossen").length,
  waiting:s.incidents.filter(i=>i&&["Anruf","Unversorgt"].includes(i.phase)).length,
  free:s.vehicles.filter(v=>v&&v.status==="frei").length,
  total:s.vehicles.length
 };
 const signature=JSON.stringify(payload);
 if(signature===lastSummary)return;
 lastSummary=signature;host.postMessage(payload,location.origin);
}

function shareActivity(s){
 if(!s||!Array.isArray(s.incidents)||!context.onDuty||!s.ld22Completed)return;
 const current=new Map();
 for(const issue of s.incidents.slice(0,300)){
  if(!issue||!["string","number"].includes(typeof issue.id))continue;
  const id=String(issue.id).slice(0,55),phase=typeof issue.phase==="string"?issue.phase.slice(0,60):"";
  const assigned=Array.isArray(issue.assigned)?issue.assigned.length:Array.isArray(issue.units)?issue.units.length:0;
  current.set(id,{phase,assigned:Math.min(100,assigned)});
 }
 const radioCount=Array.isArray(s.radioLog)?s.radioLog.length:0;
 if(previousIncidents!==null){
  const events=[];
  for(const [id,now] of current){
   const before=previousIncidents.get(id);
   if(!before&&["Anruf","Unversorgt"].includes(now.phase))events.push({kind:"notruf",id});
   if(before&&before.phase!==now.phase){
    if(now.phase==="Disponierung")events.push({kind:"annahme",id});
    if(now.phase==="Abgeschlossen")events.push({kind:"abschluss",id});
   }
   if(before&&now.assigned>before.assigned)events.push({kind:"alarmierung",id});
  }
  if(previousRadioCount!==null&&radioCount>previousRadioCount)events.push({kind:"funk",id:""});
  const minute=Number.isFinite(s.minute)?Math.round(s.minute):null;
  for(const event of events.slice(0,12)){
   host.postMessage({type:"funkspruch:dispatch-activity",kind:event.kind,incidentId:event.id,minute},location.origin);
  }
 }
 previousIncidents=current;previousRadioCount=radioCount;
}
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
 shareSummary(s);
 if(s&&gameVisible)shareActivity(s);
 if(!s||!gameVisible){
   context.opened=false;document.body.classList.remove("fs-embed-active");
   report("menue","Leitstelle im Einsatzleitsystem auswählen");
   return;
 }
 if(!context.onDuty){
   // Nach dem tatsächlichen Ausstempeln darf der Simulationsleitplatz nicht
   // unbeaufsichtigt weiterlaufen. Ein noch nicht begonnener Dienst wird nicht verändert.
   if(s.ld22Completed&&!s.funkspruchPausedByDuty){
     s.funkspruchWasPausedBeforeDuty=!!s.paused;
     s.funkspruchPausedByDuty=true;
     s.paused=true;
     ops?.save?.();
   }
   document.body.classList.remove("fs-embed-active");
   report("dienstfrei","Dienst beendet – Einsatzsimulation pausiert");
   return;
 }
 if(s.funkspruchPausedByDuty){
   s.paused=!!s.funkspruchWasPausedBeforeDuty;
   delete s.funkspruchWasPausedBeforeDuty;
   delete s.funkspruchPausedByDuty;
   ops?.save?.();
 }
 // Physisch einstempeln und danach die vier Leitplatzprüfungen persönlich abschließen.
 // Die bestehende Schichtübergabe wird nicht automatisch übersprungen.
 if(!context.synced&&context.minutes!==null&&Number.isFinite(s.minute)){
   s.minute=((Math.round(context.minutes)%1440)+1440)%1440;
   context.synced=true;
   ops?.save?.();
 }
 if(!s.ld22Completed){
   document.body.classList.remove("fs-embed-active");
   context.opened=false;
   report("uebergabe","Arbeitsplatzprüfung und Dienstübergabe abschließen");
   return;
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
