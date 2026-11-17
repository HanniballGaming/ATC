/* LEITSTELLE DEUTSCHLAND – independent vehicle motion and road navigation.
 * World axes: X east, Z south; heading 0 points north (-Z).
 * All distances in metres, velocities m/s and angles in radians.
 * No network, DOM, or global timers; caller advances at fixed timesteps.
 */
(function(root){"use strict";
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const norm=a=>Math.atan2(Math.sin(a),Math.cos(a));
function create(options={}){
 const cfg={wheelbase:2.7,maxForward:22.22,maxReverse:4.17,acceleration:3.1,braking:7.0,drag:0.018,rolling:0.18,maxSteer:0.55,steerSpeed:2.5,...options};
 if(cfg.wheelbase<=0||cfg.maxForward<=0||cfg.maxSteer<=0)throw Error("Invalid vehicle configuration");
 let state={x:0,z:0,heading:0,speed:0,steering:0,gear:"D",handbrake:true};
 function snapshot(){return {...state};}
 function reset(next={}){
  for(const k of ["x","z","heading","speed","steering"])if(next[k]!==undefined&&!Number.isFinite(next[k]))throw Error("Invalid "+k);
  state={...state,...next};return snapshot();
 }
 function step(dt,controls={}){
  if(!Number.isFinite(dt)||dt<=0||dt>0.25)throw Error("Expected 0 < dt <= 0.25");
  const throttle=clamp(Number(controls.throttle)||0,0,1);
  const brake=clamp(Number(controls.brake)||0,0,1);
  const steer=clamp(Number(controls.steer)||0,-1,1);
  const gear=controls.gear||state.gear;
  if(!["D","R","N","P"].includes(gear))throw Error("Invalid gear");
  state.gear=gear;
  if(typeof controls.handbrake==="boolean")state.handbrake=controls.handbrake;
  const target=steer*cfg.maxSteer;
  state.steering+=clamp(target-state.steering,-cfg.steerSpeed*dt,cfg.steerSpeed*dt);
  const v=state.speed;
  let a=0;
  if(gear==="D")a=throttle*cfg.acceleration;
  if(gear==="R")a=-throttle*cfg.acceleration*0.65;
  if(brake>0)a-=Math.sign(v)*brake*cfg.braking;
  if(Math.abs(v)>0.001)a-=Math.sign(v)*(cfg.rolling+cfg.drag*v*v);
  if(state.handbrake||gear==="P")a-=Math.sign(v)*Math.min(Math.abs(v)/dt,cfg.braking*2);
  let nv=clamp(v+a*dt,-cfg.maxReverse,cfg.maxForward);
  if(gear==="D"&&nv<0)nv=0;
  if(gear==="R"&&nv>0)nv=0;
  if(gear==="N"&&Math.abs(nv)<0.04)nv=0;
  if((state.handbrake||gear==="P")&&Math.abs(nv)<0.05)nv=0;
  state.speed=nv;
  const avg=(v+nv)/2;
  state.heading=norm(state.heading+avg*Math.tan(state.steering)/cfg.wheelbase*dt);
  state.x+=Math.sin(state.heading)*avg*dt;
  state.z-=Math.cos(state.heading)*avg*dt;
  return snapshot();
 }
 return {step,reset,snapshot,config:Object.freeze({...cfg})};
}
function nearestSegment(point,roadModel){
 if(!roadModel||!Array.isArray(roadModel.roads))throw Error("Expected loaded road model");
 let best=null;
 for(let roadIndex=0;roadIndex<roadModel.roads.length;roadIndex++){
  const pts=roadModel.roads[roadIndex].points;
  for(let i=1;i<pts.length;i++){
   const a=pts[i-1],b=pts[i],dx=b.x-a.x,dz=b.z-a.z,len2=dx*dx+dz*dz;
   if(len2<1e-10)continue;
   const t=clamp(((point.x-a.x)*dx+(point.z-a.z)*dz)/len2,0,1);
   const x=a.x+dx*t,z=a.z+dz*t,distance=Math.hypot(point.x-x,point.z-z);
   if(!best||distance<best.distance)best={x,z,distance,roadIndex,segmentIndex:i-1,t,heading:Math.atan2(dx,-dz)};
  }
 }
 return best;
}
root.LDOpenWorldVehicle=Object.freeze({create,nearestSegment});
})(typeof window!=="undefined"?window:globalThis);
