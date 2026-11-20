/* Browser interface for FUNKSPRUCH offline training dispatch fallback. */
(function(root){"use strict";
const $=id=>document.getElementById(id);
const engine=root.LDFunkspruchFallbackELS;
if(!engine){$("notice").textContent="Offline-Einsatzleitsystem nicht verfügbar.";return;}
const frame=root.parent;
const publish=event=>{if(frame&&frame!==root)frame.postMessage(event,location.origin);};
const ops=engine.create(root.localStorage,{onEvent:event=>publish({type:"funkspruch:dispatch-activity",...event})});
function onDuty(){
 try{return JSON.parse(root.localStorage.getItem("ld-openworld-life-v1")||"null")?.onDuty===true;}
 catch{return false;}
}
function option(select,value,label){
 const opt=document.createElement("option");opt.value=value;opt.textContent=label;select.append(opt);
}
function fill(select,entries,chosen){
 select.replaceChildren();
 for(const [value,label] of entries)option(select,value,label);
 if(entries.some(([value])=>value===chosen))select.value=chosen;
}
function text(id,value){$(id).textContent=value;}
function notify(message,failed=false){
 const el=$("notice");el.textContent=message;el.style.borderLeftColor=failed?"#e79a95":"#4da0b8";
}
function speak(message){
 try{
  if(JSON.parse(root.localStorage.getItem("funkspruch-settings-v1")||"null")?.voice===false)return;
  if(typeof root.SpeechSynthesisUtterance!=="function"||!root.speechSynthesis)return;
  root.speechSynthesis.cancel();
  const voice=new root.SpeechSynthesisUtterance(message);voice.lang="de-DE";voice.rate=.94;voice.volume=.7;
  root.speechSynthesis.speak(voice);
 }catch{}
}
function render(){
 const state=ops.snapshot(),duty=onDuty(),active=state.active,live=state.incidents.filter(i=>i.phase!=="abgeschlossen");
 text("duty",duty?"● Eingestempelt":"○ Dienstfrei – bitte zuerst einstempeln");
 const scenario=active?engine.scenarios[active.template]:null;
 text("activeCall",active?(active.accepted?"Gespräch läuft: ":"Notruf wartet: ")+scenario.event+"\nFall "+active.id+" · "+scenario.type+"\n"+(active.accepted?"Rückfragen stellen und Einsatzakte eröffnen.":"Zum Beginn Anruf annehmen."):"Kein aktiver Übungsnotruf.");
 const last=active?.questions?.at(-1);
 text("reply",last?"Ihre Frage: "+last.question+"\nKI-Anrufer: "+last.answer:active?.accepted?"KI-Anrufer: "+scenario.event:"Noch keine gesicherte Auskunft.");
 $("call").disabled=!duty||!!active;
 $("answer").disabled=!duty||!active||active.accepted;
 $("ask").disabled=!duty||!active?.accepted;
 $("register").disabled=!duty||!active?.accepted;
 const selected=$("incident").value;
 fill($("incident"),live.map(i=>[i.id,i.id+" · "+i.type]),selected);
 const selectedCase=live.find(i=>i.id===$("incident").value)||live[0]||null;
 fill($("unit"),state.vehicles.map(v=>[v.id,v.id+" · "+engine.labels[v.status]]),$("unit").value);
 text("need",selectedCase?"Einsatzmittelbedarf: "+selectedCase.need.join(", ")+" · Alarmiert: "+(selectedCase.assigned.join(", ")||"noch keine"):"Noch keine offene Einsatzakte.");
 $("dispatch").disabled=!duty||!selectedCase;
 $("close").disabled=!duty||!selectedCase;
 const units=$("units");units.replaceChildren();
 for(const v of state.vehicles){
  const line=document.createElement("div");line.className="unit";
  const label=document.createElement("span");
  label.textContent=v.id+" · "+engine.labels[v.status]+(v.incidentId?" · "+v.incidentId:"");
  const btn=document.createElement("button");btn.type="button";btn.textContent="Status weiter";
  btn.dataset.unit=v.id;btn.disabled=!duty||v.status==="frei";
  line.append(label,btn);units.append(line);
 }
 const sum=ops.summary();
 text("situation","Offene Einsätze: "+sum.open+" · Wartende Notrufe: "+sum.waiting+" · Freie Fahrzeuge: "+sum.free+"/"+sum.total);
 text("radioLog",state.radio.length?state.radio.slice(-25).reverse().join("\n"):"Noch keine Funksprüche.");
 text("history",state.events.length?state.events.slice(-35).reverse().join("\n"):"Noch keine Einsätze.");
 publish({type:"funkspruch:dispatch-summary",...sum});
}
function action(fn,success){
 try{const result=fn();notify(typeof success==="function"?success(result):success||"Aktion ausgeführt.");render();return result;}
 catch(error){notify(error.message||String(error),true);return null;}
}
const select=$("scenario");
engine.scenarios.forEach((s,i)=>option(select,String(i),s.type+" – "+s.event));
$("call").onclick=()=>action(()=>ops.call(onDuty(),Number(select.value)),id=>"Übungsnotruf "+id+" eingegangen.");
$("answer").onclick=()=>{
 const id=action(()=>ops.accept(onDuty()),id=>"Übungsnotruf "+id+" angenommen.");
 if(id){const active=ops.snapshot().active;speak(engine.scenarios[active.template].event);}
};
$("ask").onclick=()=>{
 const question=$("question").value.trim();
 const answer=action(()=>ops.ask(onDuty(),question),"Rückfrage beantwortet und protokolliert.");
 if(answer!==null){$("question").value="";speak(answer);}
};
$("question").addEventListener("keydown",e=>{if(e.key==="Enter"){$("ask").click();e.preventDefault();}});
$("register").onclick=()=>action(()=>ops.register(onDuty()),id=>"Einsatzakte "+id+" eröffnet. Bitte Fahrzeuge alarmieren.");
$("dispatch").onclick=()=>action(()=>ops.dispatch(onDuty(),$("incident").value,$("unit").value),id=>id+" wurde alarmiert.");
$("close").onclick=()=>action(()=>ops.close(onDuty(),$("incident").value),id=>"Einsatz "+id+" abgeschlossen und dokumentiert.");
$("units").addEventListener("click",e=>{
 const unit=e.target?.closest?.("button[data-unit]")?.dataset?.unit;
 if(unit)action(()=>ops.advanceUnit(onDuty(),unit),status=>unit+": "+engine.labels[status]);
});
root.addEventListener("storage",event=>{if(event.key==="ld-openworld-life-v1")render();});
root.addEventListener("pagehide",()=>{try{root.speechSynthesis?.cancel?.();}catch{}});
setInterval(()=>{
 const duty=onDuty(),shown=$("duty").textContent.includes("Eingestempelt");
 if(duty!==shown)render();
},1500);
render();
root.FunkspruchFallbackApp=Object.freeze({engine:ops,render});
})(typeof window!=="undefined"?window:globalThis);
