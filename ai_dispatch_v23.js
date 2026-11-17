/* LEITSTELLE DEUTSCHLAND v0.23 – erweiterte fiktive Notruf- und Team-KI.
   Offline, regelbasiert, keine Anbindung an reale Notrufe, keine medizinischen Handlungsanweisungen.
   Alle Namen, Rückmeldungen und Einsätze sind ausschließlich Simulationsdaten. */
(()=>{'use strict';
const logic=window.LDLogic, ops=window.LDOperations;
if(!logic || !ops || window.LDAI23)return;
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=m=>`${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(Math.floor(m%60)).padStart(2,'0')}`;
const normalize=s=>String(s||'').toLocaleLowerCase('de-DE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss').replace(/[.,!?;:]/g,' ').replace(/\s+/g,' ').trim();
const scenarios={
'Bewusstlose Person':{count:'Eine Person.',breathing:'Nein, ich kann keine normale Atmung erkennen.',responsive:'Sie reagiert auf mich überhaupt nicht.',onset:'Das habe ich gerade erst bemerkt, vor wenigen Minuten.',hazard:'Hier kann ich keine weitere unmittelbare Gefahr erkennen.',access:'Wir sind in einer Wohnung, Zugang über das Treppenhaus.'},
'Atemnot':{count:'Eine Person, mein Angehöriger.',breathing:'Die Atmung ist schwer und die Person bekommt kaum ganze Sätze heraus.',responsive:'Ja, sie reagiert, aber es fällt ihr schwer zu antworten.',onset:'Es hat vor wenigen Minuten begonnen.',access:'Wir sind in der Wohnung. Die Haustür kann geöffnet werden.'},
'Brustschmerzen':{count:'Eine betroffene Person.',breathing:'Die Person atmet, wirkt dabei sehr angestrengt.',responsive:'Sie ist wach und kann noch sprechen.',onset:'Etwa vor zehn Minuten, plötzlich.',symptom:'Starke Brustschmerzen, Blässe und Schwäche.'},
'Schlaganfallverdacht':{count:'Meine Mutter ist betroffen, sonst niemand.',breathing:'Sie scheint normal zu atmen.',responsive:'Sie ist wach, versteht mich aber nicht richtig.',onset:'Die Veränderung habe ich vor ungefähr fünfzehn Minuten bemerkt.',symptom:'Sie spricht auffällig und bewegt einen Arm nicht richtig.'},
'Krampfanfall':{count:'Eine Person.',breathing:'Sie atmet, ich kann die Atemzüge aber nicht genau einschätzen.',responsive:'Der Anfall lässt nach, die Person wirkt verwirrt.',onset:'Vielleicht seit zwei Minuten.'},
'Wohnungsbrand':{count:'Die genaue Zahl weiß ich nicht. Möglicherweise ist noch jemand im Haus.',breathing:'Einige Personen husten. Mehr kann ich aus der Entfernung nicht erkennen.',responsive:'Ich weiß nicht, wie es allen im Haus geht.',hazard:'Es ist viel Rauch im Treppenraum. Ob noch Menschen darin sind, weiß ich nicht.',access:'Mehrfamilienhaus, der Zugang ist über die Haustür.'},
'Gewerbebrand':{count:'Eine Person wird vermisst, andere sind draußen.',hazard:'Dichter schwarzer Rauch; möglicherweise stehen Gasflaschen im Lager.',access:'Das Betriebsgelände hat eine große Zufahrt für Lkw.'},
'Verkehrsunfall mit Verletzten':{count:'Mindestens zwei Verletzte.',responsive:'Eine Person reagiert, bei der anderen kann ich es nicht erkennen.',hazard:'Auslaufende Flüssigkeit und vorbeifahrender Verkehr.',access:'Unfallstelle direkt an der Straße, die Fahrzeuge stehen an einer Kreuzung.'},
'Massenanfall Verletzter':{count:'Mindestens sechs Betroffene, vielleicht mehr.',hazard:'Es fahren noch Fahrzeuge vorbei, ein Unfallfahrzeug raucht.',access:'Autobahn in Fahrtrichtung Stadt, Nähe einer Anschlussstelle.'},
'Brandmeldeanlage':{count:'Bisher keine verletzten Personen gemeldet.',hazard:'Rauch oder Flammen haben wir bisher nicht gesehen.',access:'Betriebsgebäude, Haupteingang über den Hof.'},
'Kohlenmonoxidwarnung':{count:'Mehrere Personen haben Beschwerden.',hazard:'Der CO-Warner hat ausgelöst. Wir sind wegen möglicher Gase draußen.',access:'Wohnhaus mit Eingang von der Straße.'},
'Person im Aufzug':{count:'Wir sind zu dritt eingeschlossen.',responsive:'Alle drei sind ansprechbar.',breathing:'Wir atmen alle normal, soweit ich das sagen kann.',access:'Aufzug zwischen Erdgeschoss und erstem Stock.'},
'Sturzverletzung':{count:'Eine Person.',responsive:'Sie ist wach und kann antworten.',breathing:'Die Person atmet soweit ich sehe normal.',onset:'Das ist gerade eben passiert.',symptom:'Starke Schmerzen nach dem Sturz.'},
'Türöffnung / Hilflose Person':{count:'Eine Person ist vermutlich in der Wohnung.',responsive:'Ich höre eine schwache Stimme durch die Tür.',access:'Wohnung in der dritten Etage, Wohnungstür verschlossen.'}
};
const patterns=[
 ['where',/\b(wo|welche strasse|welcher ort|hausnummer|adresse|standort|einsatzort|position|postleitzahl)\b|wo genau|wo befinden/],
 ['caller',/\b(name|wer spricht|wer ruft|wie heissen|wie hei(?:ss|s)t|identitaet|identitat)\b/],
 ['callback',/\b(rueckruf|ruckruf|telefonnummer|handynummer|nummer|erreichbar|zurueckrufen|zuruckrufen)\b/],
 ['event',/was (ist|genau|denn) (passiert|geschehen|los)|was ist passiert|was ist los|beschreiben|schildern|worum geht/],
 ['count',/wie viele|wieviele|anzahl|verletzte|betroffene|wie viel personen|noch jemand betroffen|weitere personen/],
 ['breathing',/\b(atmet|atmung|atemzuege|atemzuge|luft|atmen|erstick|atemnot)\b/],
 ['responsive',/\b(ansprechbar|bewusstlos|reagiert|wach|bewusstsein|antwortet|bei bewusstsein)\b/],
 ['hazard',/\b(gefahr|gefahren|rauch|flammen|strom|gas|auslaufen|verkehr|sicher|fahrbahn)\b/],
 ['access',/\b(zugang|zufahrt|eingang|tu(e|)r|stockwerk|etage|klingel|aufzug|treppenhaus|schluessel|schlussel)\b/],
 ['onset',/seit wann|wie lange|wann begann|zeitpunkt|begonnen|wie lang geht/],
 ['symptom',/\b(schmerz|beschwerde|blutung|blutet|symptom|verletzung|schwindel|sprache|lähmung|lahmung)\b/],
 ['age',/wie alt|alter der|geburtsjahr|welches alter/],
 ['alone',/sind sie allein|ist jemand bei ihnen|haben sie hilfe|wer hilft|noch jemand da/],
 ['change',/veraendert|verandert|verschlechtert|veraenderung|neue lage|neuigkeiten|aktuelle lage|wie geht es jetzt|wie ist der zustand jetzt/],
 ['help',/wann kommen|wo bleibt|sind die kraefte unterwegs|kommt jemand|schicken sie|wo ist die rettung/],
 ['repeat',/noch einmal|wiederholen|nicht verstanden|bitte nochmal|sprechen sie lauter/],
 ['support',/bleiben sie ruhig|ich bleibe dran|ich bin bei ihnen|sie machen das gut|wir helfen ihnen/],
 ['wait',/bleiben sie am telefon|nicht auflegen|bleiben sie dran|warten sie bitte/]
];
function intents(text){const q=normalize(text);const hits=[];for(const [key,rx] of patterns){const m=q.match(rx);if(m)hits.push({key,pos:m.index});}hits.sort((a,b)=>a.pos-b.pos);const keep=[];for(const x of hits)if(!keep.some(k=>k.key===x.key))keep.push(x);return keep.slice(0,3).map(x=>x.key)}
function state(i){if(!i.callerAI23){const n=Math.abs(Number(i.id)||1001),s=scenarios[i.type]||{};i.callerAI23={seed:n%997,variant:n%5,stress:i.prio===1?3:1,asked:{},updates:0,lastUpdateMinute:null,spokeIntro:false,notes:'',scenario:s};}return i.callerAI23}
function response(s,i,key){const p=state(i),t=scenarios[i.type]||{},n=p.variant;
 switch(key){
 case 'where':return `${i.location||'Der Einsatzort liegt in '+(i.city||'der gemeldeten Region')}. ${i.city?'Der Ort ist '+i.city+'.':''} Eine genauere Hausnummer kann ich ${n%3===0?'nicht sicher lesen':'gerade nicht zuverlässig nennen'}.`;
 case 'caller':return `Mein Name ist ${i.caller||'leider gerade nicht bekannt'}.`;
 case 'callback':return 'Ich kann die Rückrufnummer gerade nicht sicher nennen. Bitte nutzen Sie die bestehende Verbindung.';
 case 'event':return i.intro||`Es geht um ${i.type||'einen Notfall'}.`;
 case 'count':return t.count||'Ich kann sicher nur eine betroffene Person erkennen. Weitere Personen kann ich nicht beurteilen.';
 case 'breathing':return t.breathing||'Ich kann die Atmung nicht sicher beurteilen.';
 case 'responsive':return t.responsive||'Das kann ich gerade nicht zuverlässig beurteilen.';
 case 'hazard':return t.hazard||'Weitere unmittelbare Gefahren kann ich von hier nicht sicher erkennen.';
 case 'access':return t.access||'Zugang über den Haupteingang. Weitere Einzelheiten weiß ich nicht.';
 case 'onset':return t.onset||'Ich weiß nicht genau, seit wann es so ist.';
 case 'symptom':return t.symptom||'Ich kann gerade keine weiteren Beschwerden genauer beschreiben.';
 case 'age':return /Brand|Feuer|Wasser|Baum|Brandmeldeanlage/.test(i.type||'')?'Das Alter ist mir nicht bekannt.':`Die Person ist nach meiner Schätzung ungefähr ${((Number(i.id)||1001)*7)%6*10+24} Jahre alt.`;
 case 'alone':return n%3===0?'Eine weitere Person ist bei mir, sie versucht zu helfen.':'Ich bin gerade allein bei der Situation.';
 case 'change':{const f=(i.live?.followUps||[]).at(-1);return f?String(f.text).replace(/^#\d+ · /,''):'Im Moment hat sich nichts Entscheidendes verändert, soweit ich sehen kann.';}
 case 'help':return i.assigned?.length?'Ich hoffe, die Einsatzkräfte kommen bald. Ich kann sie noch nicht sehen.':'Bitte schicken Sie schnell die passenden Einsatzkräfte.';
 case 'repeat':return p.notes||i.intro||'Wir brauchen Hilfe am angegebenen Einsatzort.';
 case 'support':return ['Danke. Ich versuche ruhig zu bleiben.','Gut, ich bleibe am Telefon.','Okay, ich höre zu.','Ja, ich versuche es.','Danke, bitte helfen Sie uns.'][n];
 case 'wait':return 'Ich bleibe dran und sage Bescheid, wenn sich etwas ändert.';
 default:return 'Entschuldigung, das weiß ich gerade nicht. Können Sie bitte genauer fragen?';
 }}
const intakeKey={where:'where',caller:'who',event:'what',count:'howmany',hazard:'safety'};
const docs={where:'location',caller:'caller',count:'persons',hazard:'danger',event:'keyword',access:'access'};
function documentAnswer(i,key,text,s){i.intake??={};i.documentation??={};const ak=intakeKey[key];if(ak&&!i.intake[ak])i.intake[ak]={answer:text,minute:s.minute,source:'Gesprächssimulation'};
 const dk=docs[key];if(dk&&!String(i.documentation[dk]||'').trim()){i.documentation[dk]=key==='where'?(i.location||i.city||text):key==='caller'?(i.caller||text):key==='event'?(i.type||text):text;}}
function converse(s,id,utterance,log){const i=s?.incidents?.find(i=>i.id===Number(id));if(!i||i.callEnded||['Anruf','Unversorgt','Abgeschlossen'].includes(i.phase))return null;const question=String(utterance||'').trim().slice(0,320);if(!question)return null;const p=state(i),topics=intents(question);let replies=[];
 if(topics.length){for(const key of topics){const a=response(s,i,key);p.asked[key]=(p.asked[key]||0)+1;documentAnswer(i,key,a,s);replies.push(a);} }else{replies=['Das habe ich nicht ganz verstanden. Können Sie bitte etwas anders fragen?'];}
 const answer=replies.join(' ').slice(0,750);p.notes=answer;i.asked=true;i.transcript??=[];i.history??=[];
 i.transcript.push(`${clock(s.minute)} · DISPONENT: ${question}`,`${clock(s.minute)} · ANRUFER: ${answer}`);i.transcript=i.transcript.slice(-150);
 i.history.unshift({minute:s.minute,text:`Notruf-Rückfrage: ${topics.length?topics.join(', '):'unbekannt'}`});i.history=i.history.slice(0,100);i.freeQuestions=(i.freeQuestions||0)+1;log?.(`#${i.id}: Gesprächsangaben dokumentiert`);
 return {answer,matched:topics.length>0,scripted:true,topics,version:23};}
// Eine hörbare Rückmeldung ist nur in der aktiven Anrufannahme vorgesehen – nie als echte Notrufleitung.
function speak(text,id){const s=ops.getState?.();const i=s?.incidents?.find(x=>x.id===Number(id));if(!i||!text)return false;return !!window.LDVoice21?.speak?.(text,'caller')}
function callerUpdate(s,i,log){if(i.callEnded||!['Disponierung','Unterwegs'].includes(i.phase)||!i.transcript?.length)return;
 const p=state(i);if(p.lastUpdateMinute==null){p.lastUpdateMinute=s.minute;return}if(s.minute-p.lastUpdateMinute<6+p.variant*2||p.updates>=3)return;p.lastUpdateMinute=s.minute;p.updates++;
 const t=i.type||'',note=/Brand|Feuer|Kohlenmonoxid/.test(t)?'Ich sehe weiterhin Rauch beziehungsweise eine mögliche Gefahr.':/Verkehrsunfall|Massenanfall/.test(t)?'Hier sind immer noch Menschen an der Unfallstelle.':/Bewusstlose|Atemnot|Brustschmerzen|Schlaganfall|Krampfanfall/.test(t)?'Ich warte weiter bei der betroffenen Person.':'Ich bin noch hier. Die Lage ist weiter unklar.';
 i.transcript.push(`${clock(s.minute)} · ANRUFER (Nachmeldung): ${note}`);i.history?.unshift({minute:s.minute,text:'Anrufer meldet neue Information'});log?.(`#${i.id}: neue Anrufermeldung eingegangen`);
 }
// Verbesserte Teamsteuerung: Arbeitsplätze übernehmen eigene, priorisierte Warteschlangenfälle.
function ensureTeam(s){if(!s)return;window.LDColleagueControl?.ensure?.(s);s.teamAI23??={messages:[],lastAutoTake:-100,lastMinute:-1};for(const c of s.colleagueRoster||[])c.ai23??={lastProgress:-10,questions:0};}
function teamMessage(s,author,text,id){ensureTeam(s);const message={minute:s.minute,from:author,text,id:id||null};s.teamAI23.messages.unshift(message);s.teamAI23.messages=s.teamAI23.messages.slice(0,60);s.logs??=[];s.logs.unshift(`[${clock(s.minute)}] ${author}: ${text}`);s.logs=s.logs.slice(0,120)}
function teamTick(s){if(!s||s.paused)return;ensureTeam(s);if(s.teamAI23.lastMinute===s.minute)return;s.teamAI23.lastMinute=s.minute;
 const pending=s.incidents.filter(i=>['Anruf','Unversorgt'].includes(i.phase)).sort((a,b)=>(a.prio-b.prio)||(b.age-a.age));
 const assigned=new Set(s.incidents.filter(i=>i.phase!=='Abgeschlossen'&&s.colleagueRoster?.some(c=>c.id===i.owner)).map(i=>i.owner));
 const available=s.colleagueRoster.filter(c=>!assigned.has(c.id));
 const chosen=pending.find(i=>i.age>=3&&i.id!==window.LDWorkstation?.active?.()&&!s.colleagueRoster.some(c=>c.id===i.owner));
 if(chosen&&pending.length>=2&&available.length&&s.minute-s.teamAI23.lastAutoTake>=2){
 const c=available.find(c=>/Notruf/.test(c.id))||available[0];if(window.LDColleagueControl?.delegate?.(s,chosen.id,c.id)){s.teamAI23.lastAutoTake=s.minute;teamMessage(s,c.name,`Ich übernehme den wartenden Notruf #${chosen.id}.`,chosen.id);}}
 for(const c of s.colleagueRoster){const i=s.incidents.find(i=>i.owner===c.id&&i.phase!=='Abgeschlossen');if(!i)continue;
 if(i.phase==='Unversorgt'){logic.accept(s,i.id,()=>{},c.id);teamMessage(s,c.name,`Ich habe den wartenden Notruf #${i.id} angenommen.`,i.id);continue;}
 if(!['Anruf','Unversorgt'].includes(i.phase)&&s.minute-c.ai23.lastProgress>=3){c.ai23.lastProgress=s.minute;
 const keys=['where','what','howmany','safety','who'];const key=keys.find(k=>!i.intake?.[k]);
 if(key&&!i.callEnded){const answered=window.LDProcedures?.ask?.(s,i.id,key,()=>{});if(answered){c.ai23.questions++;i.history??=[];i.history.unshift({minute:s.minute,text:`${c.name}: Rückfrage ${key} dokumentiert`});if(i.transcript?.length>=2)i.transcript[i.transcript.length-2]=`${clock(s.minute)} · ${c.name.toUpperCase()}: ${answered.question}`;}}
 if(i.need?.length&&!s.vehicles.some(v=>v.status==='frei'&&i.need.includes(v.type))&&!i.ai23Warned){i.ai23Warned=true;teamMessage(s,c.name,`Für Vorgang #${i.id} fehlt aktuell ein geeignetes freies Einsatzmittel.`,i.id);}
 }}
 for(const i of s.incidents)callerUpdate(s,i,()=>{});
}
logic.converse=converse;
const oldTick=logic.tick;logic.tick=function(s,...args){const result=oldTick.call(this,s,...args);teamTick(s);return result};
const root=document.getElementById('elsdesk');const css=document.createElement('style');css.textContent=`#elsdesk .ld-ai23{border:1px solid #397b87;background:#0f2d3d;border-radius:7px;padding:12px;margin:12px 0}#elsdesk .ld-ai23 strong{color:#9ce4e6}#elsdesk .ld-ai23-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}#elsdesk .ld-ai23-actions button{min-height:42px}#elsdesk .ld-ai23-status{font-size:12px;color:#a9c6d6;margin-top:6px}#elsdesk .ld-ai23 .ld-ai23-teamrow{padding:5px 0;border-bottom:1px solid #38576a}#elsdesk .ld-ai23 .ld-ai23-teamrow:last-child{border:0}`;document.head.append(css);
function inject(){if(!root?.classList.contains('open'))return;const s=ops.getState?.();if(!s)return;ensureTeam(s);
 const call=root.querySelector('[data-panel="call"]');if(call&&!call.querySelector('.ld-ai23')){
 const el=document.createElement('section');el.className='ld-ai23';el.innerHTML=`<strong>Erweiterte Notruf-KI</strong><p class="ld-ai23-status">Antworten richten sich nach Einsatzart, Gesprächsverlauf und bekannten Lageangaben. Regelbasierte Offline-Simulation.</p><div class="ld-ai23-actions"><button type="button" data-ai23="where">Einsatzort prüfen</button><button type="button" data-ai23="breathing">Atmung erfragen</button><button type="button" data-ai23="responsive">Bewusstsein erfragen</button><button type="button" data-ai23="hazard">Gefahren erfragen</button><button type="button" data-ai23="change">Neue Lage erfragen</button><button type="button" data-ai23="repeat">Letzte Antwort wiederholen</button></div>`;
 call.querySelector('#free-question')?.closest('.panel')?.after(el);
 }
 const resources=root.querySelector('[data-panel="resources"]');if(resources&&!resources.querySelector('.ld-ai23')){
 const div=document.createElement('section');div.className='ld-ai23';const members=s.colleagueRoster||[];div.innerHTML=`<strong>KI-Leitplätze · interne Abstimmung</strong><div class="ld-ai23-status">Alle Kollegen arbeiten mit derselben Einsatz- und Fahrzeugliste.</div>${members.map(c=>`<div class="ld-ai23-teamrow">${safe(c.name)} – ${safe(c.state||'Dienstbereit')} ${c.focus?'· Einsatz #'+c.focus:''}</div>`).join('')}<div class="ld-ai23-actions"><button type="button" data-ai23="team">Einsatz an Kollegen übergeben</button><button type="button" data-ai23="report">Kollegenmeldungen anzeigen</button></div>`;resources.append(div);
 }
}
let updatePending=false;const obs=new MutationObserver(()=>{if(updatePending)return;updatePending=true;queueMicrotask(()=>{updatePending=false;inject()})});if(root)obs.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
const topics={where:'Wo genau ist der Einsatzort?',breathing:'Atmet die Person normal?',responsive:'Ist die Person ansprechbar?',hazard:'Welche Gefahren bestehen?',change:'Hat sich der Zustand verändert?',repeat:'Bitte wiederholen Sie die letzte Angabe.'};
document.addEventListener('click',e=>{const btn=e.target.closest('[data-ai23]');if(!btn||!root?.contains(btn))return;const action=btn.dataset.ai23;if(action==='team'){window.LDColleagueControl?.open?.();return}if(action==='report'){
 const s=ops.getState?.();if(!s)return;const latest=(s.teamAI23?.messages||[]).slice(0,6).map(m=>`${clock(m.minute)} ${m.from}: ${m.text}`).join('\n')||'Noch keine Kollegenmeldungen.';
 const dlg=document.createElement('dialog');dlg.style.cssText='background:#112d40;color:#fff;border:1px solid #78b4bd;padding:17px;max-width:90vw;max-height:75vh;overflow:auto';dlg.innerHTML=`<h3>Kollegenmeldungen</h3><pre style="white-space:pre-wrap;font:inherit">${safe(latest)}</pre><button type="button">Schließen</button>`;document.body.append(dlg);dlg.querySelector('button').onclick=()=>{dlg.close();dlg.remove()};dlg.showModal();return;
 }
 const s=ops.getState?.(),id=window.LDWorkstation?.active?.();if(!s||!id)return;const result=converse(s,id,topics[action],msg=>ops.log?.(msg));if(result){ops.save?.();window.refreshWorkstation?.();speak(result.answer,id);}
});
// Erstes "Hallo" beim wirklichen Annehmen der Verbindung, ohne automatisches Hintergrundaudio.
document.addEventListener('click',e=>{if(!e.target.closest('#elsdesk [data-action="accept"]'))return;const s=ops.getState?.(),id=window.LDWorkstation?.active?.();const i=s?.incidents.find(i=>i.id===id);if(!i||i.phase!=='Disponierung'||i.owner!=='Eigenplatz')return;const p=state(i);if(!p.spokeIntro){p.spokeIntro=true;speak(i.intro||'Hallo, ich brauche dringend Hilfe.',id)}},false);
window.LDAI23={intents,state,response,converse,teamTick,teamMessage,ensureTeam,inject};inject();
})();