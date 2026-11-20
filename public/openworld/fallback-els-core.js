/* FUNKSPRUCH: local offline training-dispatch fallback, no external emergency calls.
 * Every transition is checked; persisted changes are committed before observers see them.
 */
(function(root){"use strict";
const KEY="funkspruch-fallback-els-v2",VERSION=2;
const scenarios=Object.freeze([
 {type:"Notfallrettung",event:"Eine Person klagt über Brustschmerzen.",address:"Augsburg, Übungsstraße 12 (fiktiv)",people:"Eine betroffene Person.",breathing:"Die Person atmet normal.",consciousness:"Die Person ist ansprechbar.",hazard:"Keine besondere Gefahr bekannt.",access:"Zugang über den Hauseingang.",onset:"Die Beschwerden begannen vor etwa zehn Minuten.",age:"Ungefähr 61 Jahre.",firstAid:"Die Person sitzt, eine Betreuungsperson ist vor Ort.",need:["RTW","NEF"]},
 {type:"Atemnot",event:"Eine Frau bekommt schlecht Luft.",address:"Augsburg, Musterweg 4 (fiktiv)",people:"Eine betroffene Person.",breathing:"Die Atmung ist erschwert.",consciousness:"Sie ist wach und kann sprechen.",hazard:"Keine Gefahr gemeldet.",access:"Wohnung im ersten Stock.",onset:"Seit etwa einer Viertelstunde.",age:"Etwa 72 Jahre.",firstAid:"Sie sitzt aufrecht.",need:["RTW","NEF"]},
 {type:"Verkehrsunfall",event:"Zwei Fahrzeuge sind zusammengestoßen.",address:"Augsburg, Beispielplatz 5 (fiktiv)",people:"Zwei Beteiligte, einer möglicherweise verletzt.",breathing:"Zur Atmung der verletzten Person liegen keine Angaben vor.",consciousness:"Die verletzte Person reagiert auf Ansprache.",hazard:"Fahrzeuge blockieren teilweise die Straße.",access:"Unfallstelle ist über die Straße erreichbar.",onset:"Gerade eben.",age:"Alter unbekannt.",firstAid:"Anwesende sichern die Stelle aus sicherer Entfernung.",need:["RTW","HLF"]},
 {type:"Wohnungsbrand",event:"Rauch dringt aus einem Fenster.",address:"Augsburg, Testgasse 8 (fiktiv)",people:"Ob sich Personen in der Wohnung befinden, ist unklar.",breathing:"Keine Angaben zu möglicherweise Betroffenen.",consciousness:"Keine Angaben.",hazard:"Rauchentwicklung und mögliche Brandgefahr.",access:"Mehrfamilienhaus, dritter Stock.",onset:"Seit wenigen Minuten.",age:"Unbekannt.",firstAid:"Anrufer wartet außerhalb des Gebäudes.",need:["HLF","DLK","RTW"]},
 {type:"Sturz",event:"Eine Person ist auf einer Treppe gestürzt.",address:"Augsburg, Übungsplatz 3 (fiktiv)",people:"Eine betroffene Person.",breathing:"Die Person atmet.",consciousness:"Die Person ist ansprechbar.",hazard:"Keine weitere Gefahr erkennbar.",access:"Erdgeschoss, Eingang frei.",onset:"Vor wenigen Minuten.",age:"Etwa 80 Jahre.",firstAid:"Die Person wird nicht unnötig bewegt.",need:["RTW"]},
 {type:"Bewusstlosigkeit",event:"Ein Mitarbeiter ist plötzlich zusammengebrochen.",address:"Augsburg, Trainingsallee 7 (fiktiv)",people:"Eine betroffene Person.",breathing:"Die Atmung kann derzeit nicht sicher beurteilt werden.",consciousness:"Keine Reaktion auf Ansprache.",hazard:"Keine weiteren Gefahren bekannt.",access:"Bürogebäude, Erdgeschoss.",onset:"Vor ungefähr zwei Minuten.",age:"Etwa 45 Jahre.",firstAid:"Ein Kollege prüft die Atmung auf Anweisung.",need:["RTW","NEF"]},
 {type:"Brandmeldeanlage",event:"Die Brandmeldeanlage eines Bürogebäudes hat ausgelöst.",address:"Augsburg, Schulungsring 2 (fiktiv)",people:"Keine verletzten Personen gemeldet.",breathing:"Keine Patienteninformationen.",consciousness:"Keine Patienteninformationen.",hazard:"Brandursache und Gefahrenlage unklar.",access:"Haupteingang, Ansprechperson wartet.",onset:"Soeben.",age:"Keine betroffene Person bekannt.",firstAid:"Personen verlassen vorsorglich das Gebäude.",need:["HLF"]},
 {type:"Wasserrettung",event:"Eine Person wird am Gewässer vermisst.",address:"Augsburg, Übungsufer 1 (fiktiv)",people:"Eine vermisste Person.",breathing:"Unbekannt.",consciousness:"Unbekannt.",hazard:"Gewässer und Uferbereich; Eigengefährdung möglich.",access:"Treffpunkt an einer ausgeschilderten Zufahrt.",onset:"Seit wenigen Minuten vermisst.",age:"Etwa 29 Jahre.",firstAid:"Anrufer bleibt am sicheren Ufer.",need:["HLF","RTW","NEF"]}
]);
const vehicles=Object.freeze([
 ["RTW 1","RTW"],["RTW 2","RTW"],["NEF 1","NEF"],["HLF 1","HLF"],["HLF 2","HLF"],["DLK 1","DLK"],["KTW 1","KTW"]
]);
const steps=Object.freeze({alarmiert:"anfahrt",anfahrt:"einsatzort",einsatzort:"rueckfahrt",rueckfahrt:"frei"});
const labels=Object.freeze({frei:"Frei",alarmiert:"Alarmiert",anfahrt:"Auf Anfahrt",einsatzort:"An der Einsatzstelle",rueckfahrt:"Rückfahrt"});
const clone=value=>JSON.parse(JSON.stringify(value));
function initial(){
 return {version:VERSION,seq:0,minute:420,active:null,incidents:[],vehicles:vehicles.map(([id,type])=>({id,type,status:"frei",incidentId:null})),events:[],radio:[]};
}
function normalize(data){
 if(!data||data.version!==VERSION||!Number.isSafeInteger(data.seq)||data.seq<0||data.seq>10000000||!Array.isArray(data.vehicles)||!Array.isArray(data.incidents)||!Array.isArray(data.events)||!Array.isArray(data.radio))return null;
 if(data.vehicles.length!==vehicles.length||data.incidents.length>80||data.events.length>200||data.radio.length>160)return null;
 if(data.active&&(!/^E-\d{5,8}$/.test(data.active.id)||!Number.isInteger(data.active.template)||data.active.template<0||data.active.template>=scenarios.length))return null;
 if(data.incidents.some(i=>typeof i.id!=="string"||!/^E-\d{5,8}$/.test(i.id)||!["disposition","alarmiert","abgeschlossen"].includes(i.phase)||!Array.isArray(i.assigned)||i.assigned.length>vehicles.length))return null;
 for(let j=0;j<vehicles.length;j++){
  const v=data.vehicles[j],expected=vehicles[j];
  if(!v||v.id!==expected[0]||v.type!==expected[1]||!Object.hasOwn(labels,v.status)||!(v.incidentId===null||typeof v.incidentId==="string"))return null;
 }
 return data;
}
function classify(question){
 const q=String(question||"").toLocaleLowerCase("de-DE");
 if(/\b(wo|adresse|hausnummer|einsatzort|straße|standort|befindet)\b/.test(q))return"address";
 if(/\b(atmet|atmung|atmen|luft|atem)\b/.test(q))return"breathing";
 if(/\b(bewusst|ansprechbar|wach|reagiert|reagieren)\b/.test(q))return"consciousness";
 if(/\b(wie viele|anzahl|personen|beteiligte|betroffene)\b/.test(q))return"people";
 if(/\b(gefahr|sicher|rauch|feuer|verkehr|gefahren)\b/.test(q))return"hazard";
 if(/\b(zugang|stock|etage|geschoss|hinein|eingang|erreichbar)\b/.test(q))return"access";
 if(/\b(seit wann|wie lange|begann|begonnen|zeitpunkt)\b/.test(q))return"onset";
 if(/\b(wie alt|alter|jahre)\b/.test(q))return"age";
 if(/\b(erste hilfe|helfen|maßnahme|gemacht|unternommen)\b/.test(q))return"firstAid";
 if(/\b(was|passiert|geschehen|ereignis|problem)\b/.test(q))return"event";
 return null;
}
function summary(state){
 return {minute:state.minute,open:state.incidents.filter(i=>i.phase!=="abgeschlossen").length+(state.active?1:0),waiting:state.active?1:0,free:state.vehicles.filter(v=>v.status==="frei").length,total:state.vehicles.length};
}
function create(storage=root.localStorage,{onEvent=()=>{}}={}){
 let state=initial();
 try{const raw=storage?.getItem(KEY),saved=raw?normalize(JSON.parse(raw)):null;if(saved)state=clone(saved);}
 catch(error){console.warn("Offline-ELS-Spielstand unlesbar",error);}
 function current(){return clone(state);}
 function change(fn){
  const next=clone(state),events=[];
  const emit=(kind,id)=>events.push({kind,incidentId:id||"",minute:next.minute});
  const answer=fn(next,emit);
  next.minute=(next.minute+1)%1440;
  next.events=next.events.slice(-200);next.radio=next.radio.slice(-160);next.incidents=next.incidents.slice(-80);
  // No half-completed mutations on quota errors.
  storage?.setItem(KEY,JSON.stringify(next));
  state=next;
  for(const e of events)try{onEvent(e);}catch(error){console.warn("Journal-Brücke nicht erreichbar",error);}
  return answer===undefined?current():answer;
 }
 function duty(onDuty){if(!onDuty)throw Error("Bitte an der Stechuhr einstempeln.");}
 function call(onDuty,template=null){
  duty(onDuty);
  return change((s,emit)=>{
   if(s.active)throw Error("Bitte zunächst den aktuellen Notruf abschließen.");
   const index=template===null?s.seq%scenarios.length:Number(template);
   if(!Number.isInteger(index)||index<0||index>=scenarios.length)throw Error("Unbekanntes Übungsszenario.");
   const id="E-"+String(++s.seq).padStart(5,"0");
   s.active={id,template:index,accepted:false,questions:[]};
   s.events.push("Neuer Übungsnotruf "+id+": "+scenarios[index].type);
   emit("notruf",id);
   return id;
  });
 }
 function accept(onDuty){
  duty(onDuty);
  return change(s=>{
   if(!s.active||s.active.accepted)throw Error("Kein wartender Notruf.");
   s.active.accepted=true;
   s.events.push("Notruf "+s.active.id+" angenommen.");
   return s.active.id;
  });
 }
 function ask(onDuty,question){
  duty(onDuty);
  return change(s=>{
   if(!s.active?.accepted)throw Error("Zunächst den Notruf annehmen.");
   const q=String(question||"").trim().slice(0,200);
   if(!q)throw Error("Bitte eine Frage eingeben.");
   if(s.active.questions.length>=24)throw Error("Weitere Rückfragen für diesen Fall nicht möglich.");
   const category=classify(q),scenario=scenarios[s.active.template];
   const response=category?scenario[category]:"Dazu habe ich keine gesicherten Angaben.";
   s.active.questions.push({question:q,category:category||"ungeklärt",answer:response});
   return response;
  });
 }
 function register(onDuty){
  duty(onDuty);
  return change((s,emit)=>{
   const c=s.active;if(!c?.accepted)throw Error("Zunächst Notruf annehmen und die Lage erfassen.");
   const template=scenarios[c.template];
   s.incidents.unshift({id:c.id,type:template.type,address:template.address,description:template.event,priority:template.need.length>1?"hoch":"normal",need:[...template.need],questions:c.questions,phase:"disposition",assigned:[],visited:false});
   s.events.push("Einsatzakte "+c.id+" eröffnet: "+template.type);
   s.active=null;emit("annahme",c.id);
   return c.id;
  });
 }
 function dispatch(onDuty,incidentId,unitId){
  duty(onDuty);
  return change((s,emit)=>{
   const incident=s.incidents.find(i=>i.id===incidentId&&i.phase!=="abgeschlossen");
   const unit=s.vehicles.find(v=>v.id===unitId);
   if(!incident)throw Error("Offenen Einsatz auswählen.");
   if(!unit||unit.status!=="frei")throw Error("Dieses Fahrzeug ist nicht verfügbar.");
   if(incident.assigned.includes(unitId))throw Error("Fahrzeug bereits zugeordnet.");
   unit.status="alarmiert";unit.incidentId=incident.id;
   incident.assigned.push(unitId);incident.phase="alarmiert";
   s.radio.push("Leitstelle an "+unit.id+": Alarm für "+incident.id+" – "+incident.type+" – "+incident.address);
   s.events.push(unit.id+" zu "+incident.id+" alarmiert.");
   emit("alarmierung",incident.id);emit("funk",incident.id);
   return unit.id;
  });
 }
 function advanceUnit(onDuty,unitId){
  duty(onDuty);
  return change((s,emit)=>{
   const unit=s.vehicles.find(v=>v.id===unitId);
   if(!unit||unit.status==="frei")throw Error("Fahrzeug ist nicht im Einsatz.");
   const incident=s.incidents.find(i=>i.id===unit.incidentId);
   const next=steps[unit.status];
   if(!next)throw Error("Unbekannter Fahrzeugstatus.");
   if(next==="einsatzort"&&incident)incident.visited=true;
   s.radio.push(unit.id+": "+labels[next]+" (Statusmeldung)");
   s.events.push(unit.id+": "+labels[next]+".");
   if(next==="frei")unit.incidentId=null;
   unit.status=next;emit("funk",incident?.id||"");
   return next;
  });
 }
 function close(onDuty,incidentId){
  duty(onDuty);
  return change((s,emit)=>{
   const incident=s.incidents.find(i=>i.id===incidentId&&i.phase!=="abgeschlossen");
   if(!incident)throw Error("Kein offener Einsatz ausgewählt.");
   if(incident.assigned.length===0)throw Error("Zunächst mindestens ein Einsatzmittel alarmieren.");
   if(!incident.visited)throw Error("Ein Einsatzmittel muss die Einsatzstelle erreicht haben.");
   if(s.vehicles.some(v=>v.incidentId===incident.id))throw Error("Alle alarmierten Fahrzeuge müssen wieder frei sein.");
   incident.phase="abgeschlossen";
   s.events.push("Einsatz "+incident.id+" abgeschlossen.");
   emit("abschluss",incident.id);
   return incident.id;
  });
 }
 return Object.freeze({snapshot:current,summary:()=>summary(state),call,accept,ask,register,dispatch,advanceUnit,close,scenarios,labels});
}
root.LDFunkspruchFallbackELS=Object.freeze({create,initial,normalize,classify,summary,key:KEY,scenarios,labels});
})(typeof window!=="undefined"?window:globalThis);
