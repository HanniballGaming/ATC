/* LEITSTELLE DEUTSCHLAND v0.22 – Ego-Spielmodus, Touch-Steuerung, Schichtübernahme. */
(()=>{'use strict';
const KEY='ld22-einweisung-v1';
const CSS=`
/* Nach dem Hauptmenü ist ausschließlich die Ego-Ansicht sichtbar. */
body.ld22-playing{overflow:hidden;background:#070e18}
body.ld22-playing #app{height:100dvh;min-height:0;overflow:hidden}
body.ld22-playing .game{position:fixed!important;inset:0!important;margin:0!important;padding:0!important;max-width:none!important;height:100dvh!important;width:100vw!important;overflow:hidden!important}
body.ld22-playing .game>.layout,body.ld22-playing .game>.status,body.ld22-playing .game>.roomcontrols,body.ld22-playing #app>.top,body.ld22-playing #app>footer,body.ld22-playing .game .roomcontrols,body.ld22-playing #open-workstation,body.ld22-playing #colleague-panel,body.ld22-playing #ld-immersion,body.ld22-playing #ld-gis-floating{display:none!important}
body.ld22-playing .game>.room{position:absolute!important;inset:0!important;width:100%!important;height:100dvh!important;min-height:0!important;max-height:none!important;border:0!important;border-radius:0!important;box-shadow:none!important;touch-action:none}
body.ld22-playing .room>.hint{display:none!important}
#ld22-hud{position:fixed;inset:0;z-index:870;pointer-events:none;color:#ebf8fc;font-family:system-ui,-apple-system,Segoe UI,sans-serif;display:none}
body.ld22-playing #ld22-hud{display:block}
#ld22-hud button{pointer-events:auto;background:#071728d9;color:#eefcff;border:1px solid #477588;min-height:44px;padding:10px 13px;border-radius:11px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);font-size:13px}
#ld22-hud button:active{background:#16576a}
.ld22-head{position:absolute;top:max(10px,env(safe-area-inset-top));left:max(12px,env(safe-area-inset-left));right:max(12px,env(safe-area-inset-right));display:flex;align-items:center;gap:8px;max-width:100%;pointer-events:none}
.ld22-head .label{background:#0a2132d7;border:1px solid #26495c;border-radius:10px;padding:7px 10px;font-size:12px;max-width:min(66vw,490px)}
.ld22-head .label strong{display:block;font-size:12px;letter-spacing:.04em}
.ld22-head .label small{color:#aac8d6;display:block;font-size:10px}
.ld22-head .right{margin-left:auto;display:flex;gap:5px;pointer-events:auto}
#ld22-hud .ld22-head button{padding:8px 10px;min-width:43px}
.ld22-bottom{position:absolute;bottom:max(14px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:90%;pointer-events:auto}
#ld22-notice{position:absolute;top:calc(max(10px,env(safe-area-inset-top)) + 64px);left:50%;transform:translateX(-50%);padding:7px 12px;border:1px solid #478f96;background:#092c37e8;border-radius:10px;font-size:12px;display:none;max-width:86vw;text-align:center}
#ld22-notice.shown{display:block}
.ld22-touch{position:absolute;bottom:max(90px,calc(env(safe-area-inset-bottom) + 84px));left:max(16px,env(safe-area-inset-left));display:none;align-items:center;gap:12px}
.ld22-pad{width:117px;height:117px;border:2px solid #84acbf8c;border-radius:50%;background:#102b3bb8;position:relative;pointer-events:auto;touch-action:none;box-shadow:0 2px 20px #0009}
.ld22-knob{position:absolute;width:46px;height:46px;top:33px;left:33px;border-radius:50%;border:1px solid #b2dce8;background:#4a8ca6ca;pointer-events:none;transform:translate(0,0)}
.ld22-touch-label{font-size:11px;background:#102739d0;border-radius:6px;padding:5px 7px}
#ld22-look{left:auto;right:max(16px,env(safe-area-inset-right))}
#ld22-briefing{position:fixed;inset:0;z-index:20001;display:none;align-items:center;justify-content:center;padding:clamp(10px,3vw,30px);background:#020810a8;backdrop-filter:blur(4px)}
#ld22-briefing.open{display:flex}
#ld22-briefing .ld22-board{width:min(720px,100%);max-height:min(90dvh,860px);overflow:auto;background:#0d2232;border:5px solid #283b46;border-radius:15px;box-shadow:0 0 0 12px #0d1a24,0 25px 90px #000b;color:#e7f5f7;padding:clamp(14px,3vw,26px);font-size:14px}
#ld22-briefing h2{margin:0 0 8px;font-size:clamp(20px,4vw,29px);color:#a8ebf3}
#ld22-briefing h3{font-size:15px;margin:14px 0 6px}
#ld22-briefing p{color:#d1e4ed;line-height:1.45}
#ld22-briefing .ld22-brief-top{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:16px;color:#81b5c2;font-size:11px;text-transform:uppercase;letter-spacing:.08em}
#ld22-briefing .ld22-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
#ld22-briefing .ld22-stat{background:#173247;border:1px solid #345b6d;border-radius:8px;padding:9px 7px;text-align:center}
#ld22-briefing .ld22-stat b{display:block;font-size:21px}
#ld22-briefing .ld22-stat small{color:#c4dbe4;font-size:10px}
#ld22-briefing label{display:flex;align-items:flex-start;gap:10px;background:#153144;border:1px solid #3a667b;border-radius:9px;padding:11px 9px;margin:7px 0;cursor:pointer;color:#e5f1f7}
#ld22-briefing input[type=checkbox]{width:22px;height:22px;flex:0 0 22px;accent-color:#1c9b9d}
#ld22-briefing .ld22-actions{display:flex;gap:9px;justify-content:end;flex-wrap:wrap;margin-top:14px}
#ld22-briefing button{padding:12px 17px;border-radius:8px;background:#1a5666;border:1px solid #66a2b2;color:#fff;font:inherit}
#ld22-briefing button:disabled{opacity:.4}
#ld22-briefing .ld22-disclaimer{font-size:11px;color:#91b5c1}
/* Ein aufgeklappter Bildschirm ist ein naher Blick auf einen Monitor, keine zusätzliche Spielebene. */
body.ld22-playing #elsdesk{inset:clamp(10px,3vh,34px) clamp(8px,4vw,64px) clamp(12px,4vh,38px)!important;border:8px solid #1f2e3d!important;border-radius:16px!important;background:#071422!important;box-shadow:0 0 0 100vmax #0008,0 20px 75px #000c!important}
body.ld22-playing #ld16-panel,body.ld22-playing #ld21-voice-panel,body.ld22-playing [id^="ld-voice"]{box-shadow:0 0 0 100vmax #0008!important}
@media (pointer:coarse){.ld22-touch{display:flex}}
@media (max-width:650px){#ld22-hud button{font-size:12px;min-height:41px;padding:8px}.ld22-head .label{font-size:10px;max-width:54vw}.ld22-head .label strong{font-size:11px}.ld22-touch{bottom:max(90px,calc(env(safe-area-inset-bottom) + 76px))}.ld22-pad{width:95px;height:95px}.ld22-knob{width:38px;height:38px;left:27px;top:27px}.ld22-touch-label{display:none}.ld22-bottom{bottom:max(8px,env(safe-area-inset-bottom));gap:5px;max-width:98vw}#ld22-briefing .ld22-board{max-height:94dvh;padding:12px}body.ld22-playing #elsdesk{inset:3px!important;border-width:4px!important;border-radius:7px!important}}
`;const stylesheet=document.createElement('style');stylesheet.textContent=CSS;document.head.append(stylesheet);
const hud=document.createElement('section');hud.id='ld22-hud';hud.setAttribute('aria-label','Ego-Steuerung');hud.innerHTML=`<div class="ld22-head"><div class="label"><strong>LEITSTELLE DEUTSCHLAND</strong><small id="ld22-time">Leitstelle · Schichtvorbereitung</small></div><div class="right"><button type="button" data-ld22="brief" title="Dienstübergabe">Schicht</button><button type="button" data-ld22="pause" title="Simulation pausieren">Ⅱ</button><button type="button" data-ld22="menu" title="Hauptmenü">Menü</button></div></div><div id="ld22-notice" role="status" aria-live="polite"></div><div class="ld22-touch" id="ld22-walk"><div class="ld22-pad" aria-label="Virtueller Joystick zum Gehen"><div class="ld22-knob"></div></div><div class="ld22-touch-label">Bewegen</div></div><div class="ld22-touch" id="ld22-look"><div class="ld22-touch-label">Umsehen</div><div class="ld22-pad" aria-label="Virtueller Joystick zum Umsehen"><div class="ld22-knob"></div></div></div><div class="ld22-bottom"><button data-ld22="mode" type="button" id="ld22-mode">Aufstehen</button><button data-ld22="monitor" data-screen="call" type="button">Telefon</button><button data-ld22="monitor" data-screen="case" type="button">Einsatzakte</button><button data-ld22="monitor" data-screen="resources" type="button">Funk / Kräfte</button></div>`;document.body.append(hud);
const brief=document.createElement('section');brief.id='ld22-briefing';brief.setAttribute('role','dialog');brief.setAttribute('aria-modal','true');brief.setAttribute('aria-label','Schichtübernahme am Leitplatz');document.body.append(brief);
let last=null,noticeTimer=0,menuHandled=false;
const S=()=>window.LDOperations?.getState?.()||window.getGame?.()?.s;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function announce(msg){const el=hud.querySelector('#ld22-notice');el.textContent=msg;el.classList.add('shown');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>el.classList.remove('shown'),2800)}
function renderBrief(){const s=S();if(!s)return;const ready=s.ld22Checks||{},open=s.incidents.filter(i=>i.phase!=='Abgeschlossen').length,free=s.vehicles.filter(v=>v.status==='frei').length,clock=String(Math.floor(s.minute/60)%24).padStart(2,'0')+':'+String(s.minute%60).padStart(2,'0');
brief.innerHTML=`<div class="ld22-board"><div class="ld22-brief-top"><span>Leitplatz 01 · Dienstübergabe</span><span>${clock} Uhr · Simulation</span></div><h2>Schichtübernahme</h2><p>Du hast deinen Leitplatz betreten. Vor dem Dienstbeginn sichtest du die Lage, prüfst Telefon und Funk und übernimmst die Zuständigkeit für die laufenden Einsätze.</p><div class="ld22-stats"><div class="ld22-stat"><b>${open}</b><small>Laufende Vorgänge</small></div><div class="ld22-stat"><b>${free}</b><small>Freie Einsatzmittel</small></div><div class="ld22-stat"><b>${s.incidents.filter(i=>i.phase==='Anruf').length}</b><small>Wartende Notrufe</small></div></div><h3>Übergabe durch den vorherigen Leitplatz</h3><p>${open?'In der Lageübersicht befinden sich bereits offene Vorgänge. Prüfe deren Prioritäten und übernimm die Einsatzbearbeitung.':'Aktuell sind keine offenen Vorgänge gemeldet.'} Wetter, Ausrückzeiten und Fahrzeugbelegungen beruhen teilweise auf Simulationsmodellen.</p><h3>Arbeitsplatzprüfung</h3>${[
 ['login','Einsatzleitsystem kontrolliert: Leitstellengebiet und Schichtlage gelesen'],
 ['phone','Telefonanlage und Sprechgarnitur geprüft: Notrufannahme bereit'],
 ['radio','Digitalfunk-Konsole geprüft: Funkrufnamen und Statusmeldungen sichtbar'],
 ['handover','Laufende Einsätze und freie Kräfte bei der Übergabe übernommen']
].map(([key,text])=>`<label><input type="checkbox" data-check="${key}" ${ready[key]?'checked':''}/><span>${text}</span></label>`).join('')}<div class="ld22-actions"><button type="button" data-brief="begin" ${['login','phone','radio','handover'].every(k=>ready[k])?'':'disabled'}>Leitplatz übernehmen und Dienst beginnen</button></div><p class="ld22-disclaimer">Training: Alle Anrufe und Personen sind fiktiv. Im echten Notfall 112 wählen.</p></div>`;
}
function startBrief(){const s=S();if(!s)return;if(!s.ld22Completed){s.ld22Checks??={};if(!s.ld22Init){s.ld22Init=true;s.ld22WasPaused=!!s.paused;s.paused=true;window.LDOperations?.save?.()}renderBrief();brief.classList.add('open');window.closeWorkstation?.();}else{announce('Deine Schicht ist bereits übernommen.');window.openWorkstation?.('case')}}
brief.addEventListener('change',e=>{const key=e.target.dataset.check;if(!key)return;const s=S();if(!s)return;s.ld22Checks??={};s.ld22Checks[key]=e.target.checked;window.LDOperations?.save?.();renderBrief()});
brief.addEventListener('click',e=>{if(!e.target.matches('[data-brief="begin"]'))return;const s=S();if(!s||!['login','phone','radio','handover'].every(k=>s.ld22Checks?.[k]))return;s.ld22Completed=true;s.ld22StartedAt=s.minute;s.paused=!!s.ld22WasPaused;s.logs.unshift(`${String(Math.floor(s.minute/60)%24).padStart(2,'0')}:${String(s.minute%60).padStart(2,'0')} · Leitplatz 01: Arbeitsplatzprüfung abgeschlossen, Schicht offiziell übernommen.`);window.LDOperations?.save?.();brief.classList.remove('open');announce('Dienstübernahme bestätigt – Einsatzleitsystem bereit');window.openWorkstation?.('call');});
function invoke(action){const button=document.querySelector('#app [data-action="'+action+'"]');if(button)button.click();}
hud.addEventListener('click',e=>{const b=e.target.closest('[data-ld22]');if(!b)return;const op=b.dataset.ld22;if(op==='brief')return startBrief();if(op==='menu'){window.closeWorkstation?.();invoke('menu');return}if(op==='pause'){invoke('pause');return}if(op==='mode'){invoke('mode');return}if(op==='monitor'){if(!S()?.ld22Completed){startBrief();return}window.openWorkstation?.(b.dataset.screen)}});
// Joysticks: links Bewegung, rechts Blickrichtung. Direkte Kamerabewegung ohne wiederholten DOM-Neuaufbau.
function setupPad(id,kind){const el=hud.querySelector('#'+id+' .ld22-pad'),knob=el.querySelector('.ld22-knob');let pointer=null,x=0,y=0;const update=e=>{const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,limit=r.width*.35;let dx=e.clientX-cx,dy=e.clientY-cy;const len=Math.hypot(dx,dy);if(len>limit){dx*=limit/len;dy*=limit/len}x=dx/limit;y=dy/limit;knob.style.transform=`translate(${dx}px,${dy}px)`};const stop=()=>{pointer=null;x=0;y=0;knob.style.transform='translate(0,0)'};
el.addEventListener('pointerdown',e=>{if(!S()?.ld22Completed||window.LDWorkstation?.isOpen?.())return;pointer=e.pointerId;el.setPointerCapture(pointer);update(e);e.preventDefault()});el.addEventListener('pointermove',e=>{if(e.pointerId!==pointer)return;update(e);e.preventDefault()});el.addEventListener('pointerup',stop);el.addEventListener('pointercancel',stop);setInterval(()=>{if(pointer===null||!document.body.classList.contains('ld22-playing')||!S()?.ld22Completed||S()?.paused||window.LDWorkstation?.isOpen?.())return;const room=window.LDRoom3D;if(!room)return;if(kind==='look'){if(Math.abs(x)>.1)room.turn(x*2.7);return;}if(Math.abs(y)>.1)room.nudge(-y*.24);if(Math.abs(x)>.12)room.turn(x*1.9)},55)}
setupPad('ld22-walk','walk');setupPad('ld22-look','look');
function update(){const s=S(),inGame=!!s&&!!document.querySelector('#app .game')&&!document.querySelector('#app .menu');document.body.classList.toggle('ld22-playing',inGame);document.body.classList.remove('ld-immersive');if(!inGame){last=null;brief.classList.remove('open');menuHandled=false;return}
// Auf einer übernommenen Schicht bleibt der Spieler im Ego-Raum, während Daten weiter simuliert werden.
if(!s.ld22Init&&!s.ld22Completed){s.ld22Init=true;s.ld22WasPaused=!!s.paused;s.paused=true;window.LDOperations?.save?.();renderBrief();brief.classList.add('open')}
if(s!==last){last=s;if(!s.ld22Completed){renderBrief();brief.classList.add('open')}}
const g=window.getGame?.(),area=g?.areas?.[s.area]?.name||'Leitstelle',time=String(Math.floor(s.minute/60)%24).padStart(2,'0')+':'+String(s.minute%60).padStart(2,'0');hud.querySelector('#ld22-time').textContent=`${area} · ${time} Uhr · ${!s.ld22Completed?'Schichtübergabe':s.paused?'Pause':'Im Dienst'}`;hud.querySelector('#ld22-mode').textContent=g?.mode==='free'?'Hinsetzen':'Aufstehen';hud.querySelector('[data-ld22="pause"]').textContent=s.paused?'▶':'Ⅱ';const walk=hud.querySelector('#ld22-walk');walk.style.display=g?.mode==='free'?'flex':'none';}
// Bestehendes SPA aktualisiert Teile bei jedem Simulationstakt.
new MutationObserver(()=>{if(!menuHandled&&document.querySelector('.menu')){menuHandled=true;}queueMicrotask(update)}).observe(document.getElementById('app'),{childList:true,subtree:false});
setInterval(update,500);
window.LDFirstPerson22={update,openBrief:startBrief,getActive:()=>document.body.classList.contains('ld22-playing')};
update();
})();