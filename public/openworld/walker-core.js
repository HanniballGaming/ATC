/* LEITSTELLE DEUTSCHLAND – first-person walking and touch/keyboard input.
 * Pure state controller; optional DOM input adapter, no game DOM mutations.
 * Coordinates x east / z south, heading zero north.
 */
(function(root){"use strict";
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function create(options={}){
 const speed=options.walkSpeed??1.45,runSpeed=options.runSpeed??3.5,radius=options.radius??0.35;
 let state={x:options.x??0,z:options.z??0,heading:options.heading??0,pitch:0};
 function snapshot(){return {...state};}
 function teleport(x,z){if(!Number.isFinite(x)||!Number.isFinite(z))throw Error("Invalid destination");state.x=x;state.z=z;return snapshot();}
 function update(dt,input={},model){
  if(!Number.isFinite(dt)||dt<=0||dt>0.25)throw Error("Invalid timestep");
  const forward=clamp(Number(input.forward)||0,-1,1),strafe=clamp(Number(input.strafe)||0,-1,1);
  const magnitude=Math.max(1,Math.hypot(forward,strafe));
  const step=(input.run?runSpeed:speed)*dt;
  state.heading+=clamp(Number(input.lookX)||0,-10,10);
  state.pitch=clamp(state.pitch+clamp(Number(input.lookY)||0,-10,10),-Math.PI*0.46,Math.PI*0.46);
  const dx=(Math.sin(state.heading)*forward+Math.cos(state.heading)*strafe)*step/magnitude;
  const dz=(-Math.cos(state.heading)*forward+Math.sin(state.heading)*strafe)*step/magnitude;
  const coll=root.LDOpenWorldCollision;
  if(model&&coll){
   const moved=coll.moveWithCollision(state,{x:state.x+dx,z:state.z+dz},model,radius);
   state.x=moved.x;state.z=moved.z;
   // Basic axis sliding when diagonal movement hits a wall.
   if(moved.blocked){
    const xOnly=coll.moveWithCollision(state,{x:state.x+dx,z:state.z},model,radius);
    state.x=xOnly.x;
    const zOnly=coll.moveWithCollision(state,{x:state.x,z:state.z+dz},model,radius);
    state.z=zOnly.z;
   }
  }else{state.x+=dx;state.z+=dz;}
  return snapshot();
 }
 return {snapshot,teleport,update};
}
function keyboard(target){
 if(!target||!target.addEventListener)throw Error("Event target required");
 const keys=new Set();
 const down=e=>{if(["KeyW","KeyA","KeyS","KeyD","ShiftLeft","ShiftRight","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))keys.add(e.code);};
 const up=e=>keys.delete(e.code);
 const blur=()=>keys.clear();
 target.addEventListener("keydown",down);target.addEventListener("keyup",up);target.addEventListener("blur",blur);
 return {
  read(){return {forward:Number(keys.has("KeyW")||keys.has("ArrowUp"))-Number(keys.has("KeyS")||keys.has("ArrowDown")),strafe:Number(keys.has("KeyD")||keys.has("ArrowRight"))-Number(keys.has("KeyA")||keys.has("ArrowLeft")),run:keys.has("ShiftLeft")||keys.has("ShiftRight")};},
  dispose(){target.removeEventListener("keydown",down);target.removeEventListener("keyup",up);target.removeEventListener("blur",blur);keys.clear();}
 };
}
root.LDOpenWorldWalker=Object.freeze({create,keyboard});
})(typeof window!=="undefined"?window:globalThis);
