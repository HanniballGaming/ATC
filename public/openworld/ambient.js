/* FUNKSPRUCH – lokale, original erzeugte Umgebungsgeräusche für die 3D-Leitstelle. */
(function(root){"use strict";
function alertTransitions(previous,current){
 if(!previous||!current)return {ring:false,radio:false};
 if(!Number.isInteger(previous.waiting)||!Number.isInteger(previous.free)||!Number.isInteger(current.waiting)||!Number.isInteger(current.free))
  return {ring:false,radio:false};
 return {ring:current.waiting>previous.waiting,radio:current.free<previous.free};
}
function create(){
 const Audio=root.AudioContext||root.webkitAudioContext;
 let ctx=null,master=null,vent=null,wind=null,source=null,enabled=true,lastDuty=false,lastDesk=false,lastDispatch=null;
 function init(){
  if(ctx||!Audio)return;
  ctx=new Audio();
  master=ctx.createGain();master.gain.value=0.12;master.connect(ctx.destination);
  const frames=Math.round(ctx.sampleRate*1.2),buffer=ctx.createBuffer(1,frames,ctx.sampleRate);
  const data=buffer.getChannelData(0);let running=0;
  for(let i=0;i<frames;i++){running=running*.985+(Math.random()*2-1)*.015;data[i]=running*.7;}
  source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;
  const ventilator=ctx.createBiquadFilter();ventilator.type="lowpass";ventilator.frequency.value=290;
  vent=ctx.createGain();vent.gain.value=0.05;
  source.connect(ventilator);ventilator.connect(vent);vent.connect(master);
  const outdoors=ctx.createBiquadFilter();outdoors.type="highpass";outdoors.frequency.value=520;
  wind=ctx.createGain();wind.gain.value=0;
  source.connect(outdoors);outdoors.connect(wind);wind.connect(master);
  source.start();
 }
 function chirp(){
  if(!ctx||ctx.state!=="running"||!enabled)return;
  const osc=ctx.createOscillator(),gain=ctx.createGain(),now=ctx.currentTime;
  osc.type="sine";osc.frequency.setValueAtTime(850,now);osc.frequency.exponentialRampToValueAtTime(600,now+.13);
  gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.06,now+.01);gain.gain.exponentialRampToValueAtTime(.001,now+.16);
  osc.connect(gain);gain.connect(master);osc.start(now);osc.stop(now+.17);
  osc.onended=()=>{osc.disconnect();gain.disconnect();};
 }
 function beep(frequency,begin,duration,volume){
  if(!ctx||ctx.state!=="running"||!enabled)return;
  const now=ctx.currentTime+begin,osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type="sine";osc.frequency.value=frequency;
  gain.gain.setValueAtTime(.0001,now);
  gain.gain.exponentialRampToValueAtTime(volume,now+.012);
  gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
  osc.connect(gain);gain.connect(master);
  osc.start(now);osc.stop(now+duration+.025);
  osc.onended=()=>{osc.disconnect();gain.disconnect();};
 }
 function incomingCall(){beep(425,.0,.24,.07);beep(425,.38,.24,.07);}
 function radioAlert(){beep(950,0,.09,.04);beep(700,.11,.13,.035);}
 return {
  start(){try{init();return ctx?.resume?.()||Promise.resolve();}catch(e){console.warn("Audio nicht verfügbar",e);return Promise.resolve();}},
  setEnabled(value){enabled=!!value;if(master)master.gain.setTargetAtTime(enabled ? 0.12 : 0,ctx.currentTime,.1);},
  update(s){
   if(!ctx||!s)return;
   const t=ctx.currentTime;
   vent.gain.setTargetAtTime(s.indoor?.055:.006,t,.9);
   wind.gain.setTargetAtTime(s.indoor?.002:.075,t,.9);
   if((!lastDesk&&s.atDesk)||(!lastDuty&&s.life?.onDuty))chirp();
   if(s.dispatch&&s.life?.onDuty){
    const next={waiting:s.dispatch.waiting,free:s.dispatch.free};
    const changes=alertTransitions(lastDispatch,next);
    if(changes.ring)incomingCall();
    else if(changes.radio)radioAlert();
    lastDispatch=next;
   }
   if(!s.life?.onDuty)lastDispatch=null;
   lastDesk=!!s.atDesk;lastDuty=!!s.life?.onDuty;
  },
  dispose(){try{source?.stop();ctx?.close();}catch{}}
 };
}
root.LDFunkspruchAmbient=Object.freeze({create,alertTransitions});
})(typeof window!=="undefined"?window:globalThis);
