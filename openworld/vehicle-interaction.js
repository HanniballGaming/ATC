/* LEITSTELLE DEUTSCHLAND – vehicle enter/exit and first-person integration.
 * Adapter-based: does not change existing dispatch UI or camera until explicitly enabled.
 */
(function(root){"use strict";
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function create(options={}){
 const vehicle=options.vehicle;
 if(!vehicle||typeof vehicle.step!=="function"||typeof vehicle.snapshot!=="function")throw Error("Vehicle instance required");
 const maxEnterDistance=options.maxEnterDistance??2.8;
 const maxExitSpeed=options.maxExitSpeed??0.5;
 const doorOffset=options.doorOffset??1.4;
 const player=options.player||{x:0,z:0,heading:0};
 let driving=false;
 function snapshot(){return {driving,player:{...player},vehicle:vehicle.snapshot()};}
 function enter(){
  if(driving)return snapshot();
  const car=vehicle.snapshot();
  if(dist(player,car)>maxEnterDistance)throw Error("Fahrzeug ist zu weit entfernt");
  if(Math.abs(car.speed)>maxExitSpeed)throw Error("Fahrzeug bewegt sich");
  driving=true;
  if(options.onEnter)options.onEnter(snapshot());
  return snapshot();
 }
 function exit(isFree){
  if(!driving)return snapshot();
  const car=vehicle.snapshot();
  if(Math.abs(car.speed)>maxExitSpeed)throw Error("Zum Aussteigen anhalten");
  const right={x:Math.cos(car.heading),z:Math.sin(car.heading)};
  const candidates=[1,-1].map(side=>({x:car.x+right.x*doorOffset*side,z:car.z+right.z*doorOffset*side,heading:car.heading}));
  const target=candidates.find(p=>!isFree||isFree(p));
  if(!target)throw Error("Kein freier Ausstiegspunkt");
  driving=false;Object.assign(player,target);
  if(options.onExit)options.onExit(snapshot());
  return snapshot();
 }
 function update(dt,input={}){
  if(!driving)return snapshot();
  const s=vehicle.step(dt,input);
  player.x=s.x;player.z=s.z;player.heading=s.heading;
  if(options.onDrive)options.onDrive(snapshot());
  return snapshot();
 }
 return {enter,exit,update,snapshot,get driving(){return driving;}};
}
root.LDOpenWorldInteraction=Object.freeze({create});
})(typeof window!=="undefined"?window:globalThis);
