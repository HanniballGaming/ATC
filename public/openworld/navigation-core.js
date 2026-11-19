/* FUNKSPRUCH – route destinations from mapped OpenStreetMap road names only.
 * No synthetic addresses, guessed route metrics, or live navigation promises.
 */
(function(root){"use strict";
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function destinations(model,{limit=100,radius=1100,center={x:0,z:0}}={}){
 const byName=new Map();
 if(!model||!Array.isArray(model.roads))return [];
 for(const road of model.roads){
  const name=typeof road.properties?.name==="string"?road.properties.name.trim():"";
  const points=road.points;
  if(!name||name.length>90||!Array.isArray(points)||points.length<2)continue;
  if(!root.LDOpenWorldRoadGraph?.canTravel?.(road.properties,"walk"))continue;
  const middle=points[Math.floor(points.length/2)];
  if(!Number.isFinite(middle.x)||!Number.isFinite(middle.z))continue;
  const meters=distance(middle,center);
  if(meters>radius)continue;
  const known=byName.get(name);
  if(!known||meters<known.distance)byName.set(name,{name,x:middle.x,z:middle.z,distance:meters});
 }
 return Array.from(byName.values()).sort((a,b)=>a.name.localeCompare(b.name,"de")||a.distance-b.distance).slice(0,Math.max(0,Math.min(250,limit)));
}
function estimate(route){
 if(!route||!Number.isFinite(route.meters)||!Number.isFinite(route.secondsEstimated)||route.meters<0||route.secondsEstimated<0)return null;
 return {meters:Math.round(route.meters),minutes:Math.max(1,Math.ceil(route.secondsEstimated/60)),mode:route.mode==="walk"?"Zu Fuß":"Fahrzeug"};
}
function nearestWaypoint(position,route){
 if(!route||!Array.isArray(route.path)||!route.path.length)return null;
 let index=0,best=Infinity;
 for(let i=0;i<route.path.length;i++){
  const p=route.path[i],d=distance(p,position);
  if(d<best){best=d;index=i;}
 }
 const next=route.path[Math.min(index+1,route.path.length-1)];
 return {x:next.x,z:next.z,distance:best,index};
}
root.LDFunkspruchNavigation=Object.freeze({destinations,estimate,nearestWaypoint});
})(typeof window!=="undefined"?window:globalThis);
