/* Self-contained checks for LDOpenWorldVehicle (browser console or Node VM).
 * Load vehicle-core.js before this script; run LDOpenWorldVehicleTests.run().
 */
(function(root){"use strict";
function assert(ok,msg){if(!ok)throw Error(msg);}
function run(){
 const V=root.LDOpenWorldVehicle;
 assert(V&&typeof V.create==="function","Vehicle module not loaded");
 const car=V.create(),start=car.snapshot();
 assert(start.handbrake===true,"Initial parking brake");
 car.step(0.1,{throttle:1,handbrake:false});
 for(let i=0;i<100;i++)car.step(0.1,{throttle:1});
 let s=car.snapshot();assert(s.speed>0&&s.speed<=22.22,"Forward speed limit");
 assert(s.z<0,"Heading north");
 const before=s.speed;
 for(let i=0;i<20;i++)car.step(0.1,{brake:1});
 s=car.snapshot();assert(s.speed<before,"Braking");
 car.reset({x:0,z:0,speed:0,heading:0,steering:0,handbrake:false});
 for(let i=0;i<50;i++)car.step(0.1,{gear:"R",throttle:1});
 assert(car.snapshot().speed<0&&car.snapshot().z>0,"Reverse gear");
 car.reset({speed:0,heading:0,x:0,z:0,steering:0,gear:"D",handbrake:false});
 for(let i=0;i<60;i++)car.step(0.1,{throttle:1,steer:1});
 assert(car.snapshot().heading>0,"Steering changes heading");
 const road={roads:[{points:[{x:0,z:0},{x:0,z:-100}]}]};
 const hit=V.nearestSegment({x:5,z:-40},road);
 assert(hit&&Math.abs(hit.distance-5)<1e-9&&Math.abs(hit.z+40)<1e-9,"Nearest road segment");
 let threw=false;try{car.step(10,{})}catch(e){threw=true}assert(threw,"Reject huge time step");
 return {passed:8,vehicle:car.snapshot(),nearest:hit};
}
root.LDOpenWorldVehicleTests={run};
})(typeof window!=="undefined"?window:globalThis);
