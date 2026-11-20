/* LEITSTELLE DEUTSCHLAND – road graph for city travel estimates.
 * Graph uses projected road polylines, preserving metres. No invented travel times.
 * Routing is graph-only and cannot infer missing junctions at line crossings.
 */
(function(root){"use strict";
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const invalidCar=new Set(["footway","path","steps","cycleway","pedestrian","bridleway","corridor","construction","proposed","raceway","bus_guideway"]);
const invalidWalk=new Set(["motorway","motorway_link","trunk","trunk_link","construction","proposed","raceway"]);
const closed=new Set(["no","private","agricultural","forestry"]);
function canTravel(p={},mode="car"){
 if(!p.highway||p.area==="yes"||closed.has(p.access))return false;
 if(mode==="walk")return !invalidWalk.has(p.highway)&&!closed.has(p.foot);
 if(mode!=="car")throw Error("Unbekannter Routingmodus");
 return !invalidCar.has(p.highway)&&!closed.has(p.motor_vehicle)&&!closed.has(p.vehicle);
}
function speed(p={},mode="car"){
 if(mode==="walk")return p.highway==="steps"?0.75:1.3;
 const raw=String(p.maxspeed||""),match=raw.match(/(\d+(?:\.\d+)?)/);
 let kmh=match?Number(match[1]):["living_street","service"].includes(p.highway)?20:30;
 if(/mph/i.test(raw))kmh*=1.609344;
 return Math.max(5,Math.min(80,kmh))*(.72/3.6);
}
function create(model,{precision=0.5,mode="car"}={}){
 if(!["car","walk"].includes(mode))throw Error("Ungültiger Routingmodus");
 if(!model||!Array.isArray(model.roads))throw Error("Road model required");
 const nodes=new Map(),edges=new Map();
 const key=p=>Math.round(p.x/precision)+":"+Math.round(p.z/precision);
 function add(p){
  const k=key(p);
  if(!nodes.has(k)){nodes.set(k,{x:p.x,z:p.z});edges.set(k,[]);}
  return k;
 }
 function link(a,b,meters,oneway,props){
  const seconds=meters/speed(props,mode);
  edges.get(a).push({to:b,meters,seconds});
  if(!oneway)edges.get(b).push({to:a,meters,seconds});
 }
 for(const road of model.roads){
  const pts=road.points||[],props=road.properties||{};
  if(!canTravel(props,mode))continue;
  const reverse=mode==="car"&&props.oneway==="-1";
  const oneway=mode==="car"&&(reverse||["yes","1","true"].includes(String(props.oneway).toLowerCase())||props.junction==="roundabout"&&props.oneway!=="no");
  for(let i=1;i<pts.length;i++){
   const d=dist(pts[i-1],pts[i]);if(d<=0)continue;
   const a=add(pts[i-1]),b=add(pts[i]);
   link(reverse?b:a,reverse?a:b,d,oneway,props);
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
  const pending=[],scores=new Map([[from.key,0]]),previous=new Map(),done=new Set();
  function push(key,cost){
   const item={key,cost};let i=pending.length;pending.push(item);
   while(i>0){
    const p=(i-1)>>1;
    if(pending[p].cost<=cost)break;
    pending[i]=pending[p];i=p;
   }
   pending[i]=item;
  }
  function pop(){
   const first=pending[0],last=pending.pop();
   if(pending.length){
    let i=0;
    while(2*i+1<pending.length){
     let c=2*i+1;
     if(c+1<pending.length&&pending[c+1].cost<pending[c].cost)c++;
     if(pending[c].cost>=last.cost)break;
     pending[i]=pending[c];i=c;
    }
    pending[i]=last;
   }
   return first;
  }
  push(from.key,0);
  while(pending.length){
   const {key:current,cost}=pop();
   if(cost!==(scores.get(current)??Infinity))continue;
   if(current===to.key)break;
   if(done.has(current))continue;done.add(current);
   for(const edge of edges.get(current)){
    const next=cost+edge.seconds;
    if(next<(scores.get(edge.to)??Infinity)){
     scores.set(edge.to,next);previous.set(edge.to,{key:current,edge});push(edge.to,next);
    }
   }
  }
  if(!scores.has(to.key))return null;
  const path=[];let k=to.key,routeMeters=0;
  while(k!==undefined){
   path.push({...nodes.get(k)});
   const prev=previous.get(k);
   if(!prev)break;
   routeMeters+=prev.edge.meters;k=prev.key;
  }
  path.reverse();
  return {path,meters:routeMeters,secondsEstimated:scores.get(to.key),mode,
    snapStartMeters:from.distance,snapEndMeters:to.distance};
 }
 return {route,nearest,nodeCount:nodes.size,mode,edgeCount:Array.from(edges.values()).reduce((n,v)=>n+v.length,0)};
}
root.LDOpenWorldRoadGraph=Object.freeze({create,canTravel,speed});
})(typeof window!=="undefined"?window:globalThis);
