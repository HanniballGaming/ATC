/* LEITSTELLE DEUTSCHLAND – deterministic personal-life simulation.
 * Independent of dispatch operations. Time advances only when caller invokes advance().
 * Local persistence is opt-in via save/load. No background timers.
 */
(function(root){"use strict";
const KEY="ld-openworld-life-v1";
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function create(initial={}){
 const defaults={minutes:6*60,money:1500,hunger:15,thirst:10,fatigue:15,hygiene:100,location:"wohnung",onDuty:false,shiftStart:7*60,shiftEnd:15*60};
 let s={...defaults,...initial};
 function snapshot(){return {...s};}
 function advance(minutes){
  if(!Number.isFinite(minutes)||minutes<0||minutes>1440)throw Error("Invalid minutes");
  s.minutes+=minutes;
  s.hunger=clamp(s.hunger+minutes*0.035,0,100);
  s.thirst=clamp(s.thirst+minutes*0.055,0,100);
  s.fatigue=clamp(s.fatigue+minutes*(s.onDuty?0.055:0.035),0,100);
  s.hygiene=clamp(s.hygiene-minutes*0.013,0,100);
  return snapshot();
 }
 function syncClock(minute){
  if(!Number.isFinite(minute)||minute<0)return snapshot();
  const normalized=((Math.round(minute)%1440)+1440)%1440;
  const current=((Math.round(s.minutes)%1440)+1440)%1440;
  const advanceBy=(normalized-current+1440)%1440;
  // Die Spielzeit darf nicht rückwärts springen und übernimmt nur plausible Schritte.
  if(advanceBy>0&&advanceBy<=240)advance(advanceBy);
  return snapshot();
 }
 function action(name){
  const actions={
   essen:{place:["wohnung","restaurant"],duration:20,cost:5,apply:()=>{s.hunger=clamp(s.hunger-55,0,100);}},
   trinken:{place:["wohnung","restaurant","leitstelle"],duration:2,cost:1,apply:()=>{s.thirst=clamp(s.thirst-55,0,100);}},
   duschen:{place:["wohnung"],duration:12,cost:0.5,apply:()=>{s.hygiene=100;}},
   schlafen:{place:["wohnung"],duration:480,cost:0,apply:()=>{s.fatigue=0;}},
   dienstbeginn:{place:["leitstelle"],duration:0,cost:0,apply:()=>{if(s.onDuty)throw Error("Already on duty");s.onDuty=true;}},
   dienstende:{place:["leitstelle"],duration:0,cost:0,apply:()=>{if(!s.onDuty)throw Error("Not on duty");s.onDuty=false;}}
  };
  const a=actions[name];if(!a)throw Error("Unknown action");
  if(!a.place.includes(s.location))throw Error("Action unavailable here");
  if(s.money<a.cost)throw Error("Insufficient money");
  if(s.onDuty&&["schlafen","duschen","essen"].includes(name))throw Error("Not available during duty");
  // Validate first; mutate only after all preconditions pass.
  if(name==="dienstbeginn"&&s.onDuty)throw Error("Already on duty");
  if(name==="dienstende"&&!s.onDuty)throw Error("Not on duty");
  s.money=Math.round((s.money-a.cost)*100)/100;
  advance(a.duration);a.apply();return snapshot();
 }
 function moveTo(location){if(!["wohnung","leitstelle","restaurant","stadt"].includes(location))throw Error("Unknown location");s.location=location;return snapshot();}
 function save(storage=root.localStorage){storage.setItem(KEY,JSON.stringify(s));return snapshot();}
 function load(storage=root.localStorage){
  const raw=storage.getItem(KEY);if(!raw)return snapshot();
  const data=JSON.parse(raw);
  for(const key of Object.keys(defaults))if(Object.prototype.hasOwnProperty.call(data,key)&&typeof data[key]===typeof defaults[key])s[key]=data[key];
  return snapshot();
 }
 return {snapshot,advance,syncClock,action,moveTo,save,load};
}
root.LDOpenWorldLife=Object.freeze({create});
})(typeof window!=="undefined"?window:globalThis);
