/* FUNKSPRUCH – nachvollziehbares, lokales Schichtjournal.
 * Dokumentiert echte Zustandsänderungen, behauptet keine fiktiv bearbeiteten Einsätze.
 */
(function(root){"use strict";
const KEY="funkspruch-shift-journal-v1",VERSION=1,LIMIT=24;
const finite=n=>typeof n==="number"&&Number.isFinite(n);
function count(n){return Number.isSafeInteger(n)&&n>=0&&n<=100000?n:null;}
function location(s){
 const minute=finite(s?.life?.minutes)?Math.max(0,Math.round(s.life.minutes)):0;
 const d=s?.dispatch||{};
 const valid=["open","waiting","free","total"].every(k=>count(d[k])!==null)&&d.waiting<=d.open&&d.free<=d.total;
 return {minute,dispatch:valid?{open:d.open,waiting:d.waiting,free:d.free,total:d.total}:null};
}
function create(storage=root.localStorage){
 let state={version:VERSION,active:null,reports:[]};
 try{
  const raw=storage?.getItem(KEY),saved=raw?JSON.parse(raw):null;
  const validEvent=e=>e&&typeof e==="object"&&["notruf","annahme","alarmierung","abschluss","funk"].includes(e.kind)&&finite(e.minute)&&e.minute>=0&&e.minute<=10000000&&typeof e.text==="string"&&e.text.length<=180;
  const validActive=a=>a===null||(a&&typeof a==="object"&&finite(a.startMinute)&&a.startMinute>=0&&a.startMinute<=10000000&&finite(a.updatedMinute)&&a.updatedMinute>=a.startMinute&&a.updatedMinute<=10000000&&Array.isArray(a.events)&&a.events.length<=120&&a.events.every(validEvent));
  const validReport=r=>r&&typeof r==="object"&&finite(r.startMinute)&&r.startMinute>=0&&finite(r.endMinute)&&r.endMinute>=r.startMinute&&r.endMinute<=10000000&&finite(r.durationMinutes)&&r.durationMinutes===r.endMinute-r.startMinute&&Array.isArray(r.events)&&r.events.length<=120&&r.events.every(validEvent);
  if(saved?.version===VERSION&&Array.isArray(saved.reports)&&saved.reports.length<=LIMIT&&validActive(saved.active??null))
   state={version:VERSION,active:saved.active??null,reports:saved.reports.filter(validReport)};
 }catch(e){console.warn("Schichtjournal konnte nicht geladen werden",e);}
 function persist(){try{storage?.setItem(KEY,JSON.stringify(state));}catch(e){console.warn("Schichtjournal konnte nicht gespeichert werden",e);}}
 function begin(s){
  if(state.active)return false;
  const snap=location(s);
  state.active={startMinute:snap.minute,start:snap.dispatch,last:snap.dispatch,peakWaiting:snap.dispatch?.waiting??null,updatedMinute:snap.minute,events:[]};
  persist();return true;
 }
 function record(s){
  if(!state.active)return false;
  const snap=location(s),active=state.active;
  if(snap.dispatch){
   active.last=snap.dispatch;
   active.peakWaiting=Math.max(active.peakWaiting??0,snap.dispatch.waiting);
  }
  const previous=active.updatedMinute??active.startMinute;
  let current=Math.floor(previous/1440)*1440+(snap.minute%1440);
  if(current<previous&&previous-current>720)current+=1440;
  active.updatedMinute=Math.max(previous,current);
  persist();return true;
 }
 function recordEvent(raw){
  if(!state.active||!raw||typeof raw!=="object")return false;
  const messages={
   notruf:"Neuer Übungsnotruf eingegangen",
   annahme:"Notruf angenommen und Einsatzakte eröffnet",
   alarmierung:"Einsatzmittel alarmiert",
   abschluss:"Einsatz abgeschlossen",
   funk:"Funkmeldung protokolliert"
  };
  if(!Object.prototype.hasOwnProperty.call(messages,raw.kind))return false;
  const id=typeof raw.incidentId==="string"&&/^[\w\-#]{1,55}$/.test(raw.incidentId)?raw.incidentId:null;
  const minute=Number.isFinite(raw.minute)&&raw.minute>=0?Math.round(raw.minute):state.active.updatedMinute;
  // ELS-Zeit ist eine Tagesuhr (0–1439). Bei Mitternacht nicht auf den
  // Schichtbeginn zurückspringen; Ereignisse monoton fortschreiben.
  const previous=state.active.updatedMinute??state.active.startMinute;
  const day=Math.floor(previous/1440);
  let clock=minute<1440?day*1440+minute:minute;
  if(clock<previous&&previous-clock>720)clock+=1440;
  clock=Math.max(previous,clock);
  state.active.updatedMinute=clock;
  const events=state.active.events||(state.active.events=[]);
  const text=messages[raw.kind]+(id?" · #"+id:"");
  if(events.length>=120)events.shift();
  events.push({kind:raw.kind,minute:clock,text});
  persist();return true;
 }
 function finish(s){
  if(!state.active)return null;
  record(s);
  const a=state.active,final=location(s);
  const report={
   id:Math.floor(Date.now())+"-"+state.reports.length,
   startMinute:a.startMinute,
   endMinute:Math.max(a.updatedMinute??a.startMinute,final.minute),
   durationMinutes:Math.max(0,Math.max(a.updatedMinute??a.startMinute,final.minute)-a.startMinute),
   start:a.start,end:a.last,peakWaiting:a.peakWaiting,events:(a.events||[]).slice(-120)
  };
  state.reports.unshift(report);state.reports=state.reports.slice(0,LIMIT);state.active=null;
  persist();return JSON.parse(JSON.stringify(report));
 }
 function reconcile(current){
  if(current?.life?.onDuty===true&&!state.active)return begin(current);
  // A crash or an imported save may leave a journal marked active although
  // the player is no longer on duty. Never attach the next shift to that one.
  if(current?.life?.onDuty===false&&state.active){
   finish(current);
   return true;
  }
  return false;
 }
 function snapshot(){return JSON.parse(JSON.stringify(state));}
 function format(report){
  if(!report)return "Noch keine abgeschlossene Schicht vorhanden.";
  const span=(v)=>v?("Offene Einsätze: "+v.open+" · Wartende Notrufe: "+v.waiting+" · Einsatzmittel frei: "+v.free+"/"+v.total):"Noch keine Verbindung zum Einsatzleitsystem";
  const time=m=>String(Math.floor(m/60)%24).padStart(2,"0")+":"+String(Math.floor(m%60)).padStart(2,"0");
  const eventLines=Array.isArray(report.events)&&report.events.length?report.events.slice(-30).map(e=>time(e.minute)+" · "+e.text).join("\n"):"Keine einzelnen Funk- oder Einsatzereignisse protokolliert";
  return "Beginn: "+time(report.startMinute)+" · Ende: "+time(report.endMinute)+
   "\nSimulierte Schichtdauer: "+report.durationMinutes+" Minuten"+
   "\n\nEinsatzlage bei Beginn:\n"+span(report.start)+
   "\n\nEinsatzlage bei Ende:\n"+span(report.end)+
   "\n\nMaximal gleichzeitig wartende Notrufe: "+(report.peakWaiting??"nicht erfasst")+
   "\n\nEinsatz- und Funkchronik:\n"+eventLines+
   "\n\nHinweis: Dies sind protokollierte Lagewerte, keine erfundenen Einsatz- oder Leistungsbewertungen.";
 }
 return {begin,record,recordEvent,finish,reconcile,snapshot,format};
}
root.LDFunkspruchShiftJournal=Object.freeze({create,location,key:KEY});
})(typeof window!=="undefined"?window:globalThis);
