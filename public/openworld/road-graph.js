/* LEITSTELLE DEUTSCHLAND – road graph for city travel estimates.
 * Graph uses projected road polylines, preserving metres. No invented travel times.
 * Routing is graph-only and cannot infer missing junctions at line crossings.
 */
(function(root){"use strict";
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function create(model,{precision=0.5}={}){
 if(!model||!Array.isArray(model.roads))throw Error("Road model required");
 const nodes=new Map(),edges=new Map();
 const key=p=>Math.round(p.x/precision)+":"+Math.round(p.z/precision);
 function add(p){
  const k=key(p);
  if(!nodes.has(k)){nodes.set(k,{x:p.x,z:p.z});edges.set(k,[]);}
  return k;
 }
 function link(a,b,meters,oneway){
  edges.get(a).push({to:b,meters});
  if(!oneway)edges.get(b).push({to:a,meters});
 }
 for(const road of model.roads){
  const pts=road.points||[],props=road.properties||{},oneway=props.oneway==="yes"||props.oneway==="1";
  const reverse=props.oneway==="-1";
  for(let i=1;i<pts.length;i++){
   const d=dist(pts[i-1],pts[i]);if(d<=0)continue;
   const a=add(pts[i-1]),b=add(pts[i]);
   link(reverse?b:a,reverse?a:b,d,oneway||reverse);
  }
 }
 function nearest(point){
  let best=null;
  for(const [k,p] of nodes){const d=dist(point,p);if(!best||d<best.distance)best={key:k,distance:d,point:p};}
  return best;
 }
 function route(start,end){
  const from=nearest(start),to=nearest(end);
  if(!from||!to)return null;
  const pending=new Map([[from.key,0]]),scores=new Map([[from.key,0]]),previous=new Map(),done=new Set();
  while(pending.size){
   let current=null,cost=Infinity;
   for(const [k,v] of pending)if(v<cost){current=k;cost=v;}
   pending.delete(current);
   if(current===to.key)break;
   if(done.has(current))continue;done.add(current);
   for(const edge of edges.get(current)){
    const next=cost+edge.meters;
    if(next<(scores.get(edge.to)??Infinity)){
     scores.set(edge.to,next);previous.set(edge.to,current);pending.set(edge.to,next);
    }
   }
  }
  if(!scores.has(to.key))return null;
  const path=[];let k=to.key;
  while(k!==undefined){path.push({...nodes.get(k)});k=previous.get(k);}
  path.reverse();
  return {path,meters:scores.get(to.key),snapStartMeters:from.distance,snapEndMeters:to.distance};
 }
 return {route,nearest,nodeCount:nodes.size};
}
root.LDOpenWorldRoadGraph=Object.freeze({create});
})(typeof window!=="undefined"?window:globalThis);
