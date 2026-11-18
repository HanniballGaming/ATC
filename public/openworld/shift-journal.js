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
  if(saved?.version===VERSION&&Array.isArray(saved.reports)&&saved.reports.length<=LIMIT&&(!saved.active||finite(saved.active.startMinute)))state=saved;
 }catch(e){console.warn("Schichtjournal konnte nicht geladen werden",e);}
 function persist(){try{storage?.setItem(KEY,JSON.stringify(state));}catch(e){console.warn("Schichtjournal konnte nicht gespeichert werden",e);}}
 function begin(s){
  if(state.active)return false;
  const snap=location(s);
  state.active={startMinute:snap.minute,start:snap.dispatch,last:snap.dispatch,peakWaiting:snap.dispatch?.waiting??null,updatedMinute:snap.minute};
  persist();return true;
 }
 function record(s){
  if(!state.active)return false;
  const snap=location(s),active=state.active;
  if(snap.dispatch){
   active.last=snap.dispatch;
   active.peakWaiting=Math.max(active.peakWaiting??0,snap.dispatch.waiting);
  }
  active.updatedMinute=Math.max(active.updatedMinute??active.startMinute,snap.minute);
  persist();return true;
 }
 function finish(s){
  if(!state.active)return null;
  record(s);
  const a=state.active,final=location(s);
  const report={
   id:Math.floor(Date.now())+"-"+state.reports.length,
   startMinute:a.startMinute,
   endMinute:Math.max(final.minute,a.updatedMinute??0),
   durationMinutes:Math.max(0,Math.max(final.minute,a.updatedMinute??0)-a.startMinute),
   start:a.start,end:a.last,peakWaiting:a.peakWaiting
  };
  state.reports.unshift(report);state.reports=state.reports.slice(0,LIMIT);state.active=null;
  persist();return JSON.parse(JSON.stringify(report));
 }
 function snapshot(){return JSON.parse(JSON.stringify(state));}
 function format(report){
  if(!report)return "Noch keine abgeschlossene Schicht vorhanden.";
  const span=(v)=>v?("Offene Einsätze: "+v.open+" · Wartende Notrufe: "+v.waiting+" · Einsatzmittel frei: "+v.free+"/"+v.total):"Noch keine Verbindung zum Einsatzleitsystem";
  const time=m=>String(Math.floor(m/60)%24).padStart(2,"0")+":"+String(Math.floor(m%60)).padStart(2,"0");
  return "Beginn: "+time(report.startMinute)+" · Ende: "+time(report.endMinute)+
   "\nSimulierte Schichtdauer: "+report.durationMinutes+" Minuten"+
   "\n\nEinsatzlage bei Beginn:\n"+span(report.start)+
   "\n\nEinsatzlage bei Ende:\n"+span(report.end)+
   "\n\nMaximal gleichzeitig wartende Notrufe: "+(report.peakWaiting??"nicht erfasst")+
   "\n\nHinweis: Dies sind protokollierte Lagewerte, keine erfundenen Einsatz- oder Leistungsbewertungen.";
 }
 return {begin,record,finish,snapshot,format};
}
root.LDFunkspruchShiftJournal=Object.freeze({create,location,key:KEY});
})(typeof window!=="undefined"?window:globalThis);
