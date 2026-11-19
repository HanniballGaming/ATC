/* FUNKSPRUCH: modellierter Stadtverkehr ausschließlich auf realen OSM-Ways.
 * In Deutschland gilt Rechtsverkehr. Fahrbahnen, Einbahnstraßen und Kreisverkehre
 * werden anhand tatsächlicher OSM-Tags berücksichtigt; Fahrzeuge, Personen,
 * Fahrzeiten und Verhalten bleiben ausdrücklich simuliert.
 */
(function(root){"use strict";
const nonMotor=new Set(["footway","path","pedestrian","steps","cycleway","bridleway","corridor","construction","proposed"]);
const noFoot=new Set(["motorway","motorway_link","trunk","trunk_link","construction","proposed"]);
const dedicatedFoot=new Set(["footway","path","pedestrian","steps","living_street"]);
const privateAccess=new Set(["private","no","delivery","agricultural","forestry"]);
const finite=n=>typeof n==="number"&&Number.isFinite(n);
const length=(a,b)=>Math.hypot(b.x-a.x,b.z-a.z);
function distance(points){
 let meters=0;
 for(let i=1;i<points.length;i++)meters+=length(points[i-1],points[i]);
 return meters;
}
function position(points,meters){
 let rest=Math.max(0,meters);
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);
  if(d<.01)continue;
  if(rest<=d||i===points.length-1){
   const ratio=Math.min(1,rest/d);
   return {x:a.x+dx*ratio,z:a.z+dz*ratio,yaw:Math.atan2(dx,-dz),nx:-dz/d,nz:dx/d};
  }
  rest-=d;
 }
 return {x:points[0]?.x||0,z:points[0]?.z||0,yaw:0,nx:1,nz:0};
}
function speedFor(props={},kind="car"){
 if(kind==="walker")return props.highway==="steps" ? 0.7 : 1.17;
 const match=String(props.maxspeed||"").match(/(\d+(?:\.\d+)?)/);
 let speed=match?Number(match[1]):(["living_street","service"].includes(props.highway)?20:30);
 if(/mph/i.test(String(props.maxspeed)))speed*=1.609344;
 return Math.max(6,Math.min(45,speed))*(.68/3.6);
}
function allowed(properties,kind){
 const p=properties||{},h=p.highway||"";
 if(!h||p.area==="yes"||privateAccess.has(p.access))return false;
 if(kind==="car"){
  if(nonMotor.has(h)||privateAccess.has(p.motor_vehicle)||privateAccess.has(p.vehicle))return false;
  return h!=="raceway"&&h!=="bus_guideway";
 }
 if(noFoot.has(h)||p.foot==="no"||p.foot==="private")return false;
 return true;
}
function laneOffset(edge,index,kind){
 if(kind==="walker"){
  if(dedicatedFoot.has(edge.props.highway))return index%2?.35:-.35;
  const w=root.LDOpenWorldRenderer?.roadWidth?.(edge.props)||5;
  return (index%2?1:-1)*(w/2+.75);
 }
 if(edge.oneway)return 0;
 const width=root.LDOpenWorldRenderer?.roadWidth?.(edge.props)||5;
 return Math.max(.6,Math.min(2.3,width*.23));
}
function buildNetwork(model,{precision=.35,range=650}={}){
 if(!model||!Array.isArray(model.roads))throw Error("Reale Straßengeometrie erforderlich");
 const graph={car:{adj:new Map(),edges:[]},walker:{adj:new Map(),edges:[]}};
 const key=p=>Math.round(p.x/precision)+":"+Math.round(p.z/precision);
 for(const road of model.roads){
  const p=road.properties||{},points=road.points||[];
  if(points.length<2||!points.every(v=>finite(v.x)&&finite(v.z)))continue;
  if(!points.some(v=>Math.hypot(v.x,v.z)<=range))continue;
  for(const kind of ["car","walker"]){
   if(!allowed(p,kind))continue;
   const network=graph[kind];
   const reversed=p.oneway==="-1",forwardOnly=kind==="car"&&(reversed||["yes","1","true"].includes(String(p.oneway).toLowerCase())||p.junction==="roundabout");
   function attach(a,b,oneway){
    const meters=length(a,b);
    if(meters<.4)return;
    const from=key(a),to=key(b);
    if(from===to)return;
    const edge={from,to,points:[a,b],a,b,length:meters,props:p,road,oneway,speed:speedFor(p,kind)};
    network.edges.push(edge);
    if(!network.adj.has(from))network.adj.set(from,[]);
    network.adj.get(from).push(edge);
   }
   for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    if(kind==="walker"||!forwardOnly){attach(a,b,false);attach(b,a,false);}
    else if(reversed)attach(b,a,true);
    else attach(a,b,true);
   }
  }
 }
 return graph;
}
function chooseNext(agent,graph){
 const exits=graph.adj.get(agent.edge.to)||[];
 if(!exits.length)return null;
 // Wendemanöver nur dort, wo keine andere tatsächlich erfasste Verbindung existiert.
 const forwards=exits.filter(e=>e.to!==agent.edge.from);
 const eligible=forwards.length?forwards:exits;
 const current=agent.edge;
 const dx=current.b.x-current.a.x,dz=current.b.z-current.a.z,d=Math.hypot(dx,dz)||1;
 const scored=eligible.map(e=>{
  const ex=(e.b.x-e.a.x)/e.length,ez=(e.b.z-e.a.z)/e.length;
  const straightness=(dx/d)*ex+(dz/d)*ez;
  return {e,score:straightness*.8+((agent.seed*17+agent.transitions*29+e.length*13)%11)*.012};
 });
 scored.sort((a,b)=>b.score-a.score);
 return scored[0].e;
}
function advance(agent,meters,graph){
 if(!graph||!agent?.edge||!finite(meters))return;
 let rest=Math.max(0,meters),turns=0;
 while(rest>0&&turns<14){
  const left=agent.edge.length-agent.progress;
  if(rest<left){agent.progress+=rest;return;}
  rest-=left;agent.progress=agent.edge.length;
  const next=chooseNext(agent,graph);agent.transitions++;turns++;
  if(!next){
   // Am Endpunkt einer Einbahnstraße niemals unerlaubt rückwärts fahren.
   const list=graph.edges;
   if(!list.length)return;
   agent.edge=list[(agent.seed*41+agent.transitions*19)%list.length];
   agent.progress=0;agent.repositioned=(agent.repositioned||0)+1;
  }else{agent.edge=next;agent.progress=0;}
 }
}
function generate(model,{cars=6,walkers=8,range=650}={}){
 const network=buildNetwork(model,{range}),result=[];
 const countCar=Math.min(Math.max(0,Math.floor(cars)),12);
 const countWalk=Math.min(Math.max(0,Math.floor(walkers)),18);
 for(const [kind,count] of [["car",countCar],["walker",countWalk]]){
  const graph=network[kind];
  if(!graph.edges.length)continue;
  const usable=kind==="walker"?
   graph.edges.filter(e=>dedicatedFoot.has(e.props.highway)):
   graph.edges.filter(e=>!["motorway","trunk"].includes(e.props.highway));
  const edges=usable.length?usable:graph.edges;
  for(let i=0;i<count;i++){
   const seed=i+(kind==="walker"?100:1),edge=edges[(seed*71+23)%edges.length];
   const progress=edge.length*(.15+((i*.193)% .7));
   result.push({kind,edge,graph,seed,progress,transitions:0,speed:edge.speed,
    lane:laneOffset(edge,i,kind),repositioned:0});
  }
 }
 return result;
}
function create({THREE,scene,model,low=false}={}){
 if(!THREE||!scene||!model)throw Error("Three.js, Szene und reale Straßen erforderlich");
 const agents=generate(model,{cars:low?3:6,walkers:low?4:8}),group=new THREE.Group();
 group.name="Simulierter ziviler Straßenverkehr auf OSM-Wegen";scene.add(group);
 const geos=[new THREE.BoxGeometry(1.7,.6,3.2),new THREE.BoxGeometry(1.35,.52,1.8),
  new THREE.CylinderGeometry(.32,.32,.2,10),new THREE.CylinderGeometry(.18,.21,.77,7),
  new THREE.SphereGeometry(.18,7,5)];
 const paints=[0x3a6c88,0xb8c2c5,0x7c5a58,0x4c6960,0x9f8e71]
  .map(color=>new THREE.MeshStandardMaterial({color,roughness:.8}));
 const tires=new THREE.MeshStandardMaterial({color:0x22272b,roughness:1});
 const skin=new THREE.MeshStandardMaterial({color:0xc39c82,roughness:1});
 function part(parent,geo,mat,x,y,z){
  const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
 }
 agents.forEach((a,i)=>{
  a.object=new THREE.Group();group.add(a.object);
  const paint=paints[i%paints.length];
  if(a.kind==="car"){
   part(a.object,geos[0],paint,0,.8,0);part(a.object,geos[1],paint,0,1.27,-.23);
   for(const x of [-.9,.9])for(const z of [-1.08,1.08])
    part(a.object,geos[2],tires,x,.33,z).rotation.z=Math.PI/2;
  }else{
   part(a.object,geos[3],paint,0,.94,0);
   part(a.object,geos[4],skin,0,1.53,0);
  }
 });
 function update(dt,indoor=false){
  group.visible=!indoor;if(indoor)return;
  const delta=Math.max(0,Math.min(.12,finite(dt)?dt:0));
  for(const a of agents){
   // Einfahrten und Knoten vorsichtiger passieren; ohne erfundene Ampelphasen.
   const remain=a.edge.length-a.progress;
   const slow=a.kind==="car"&&remain<9 ? 0.62 : 1;
   advance(a,delta*a.speed*slow,a.graph);
   a.speed=a.edge.speed;
   a.lane=laneOffset(a.edge,a.seed,a.kind);
   const p=position(a.edge.points,a.progress);
   a.object.position.set(p.x+p.nx*a.lane,0,p.z+p.nz*a.lane);
   a.object.rotation.y=-p.yaw;
  }
 }
 update(0);
 return {update,count:agents.length,dispose(){
  group.parent?.remove(group);
  geos.forEach(g=>g.dispose());[...paints,tires,skin].forEach(m=>m.dispose());
 }};
}
root.LDFunkspruchTraffic=Object.freeze({distance,position,speedFor,allowed,buildNetwork,chooseNext,advance,generate,create});
})(typeof window!=="undefined"?window:globalThis);
