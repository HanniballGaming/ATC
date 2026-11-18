/* FUNKSPRUCH – ziviler Verkehr auf vorhandener GeoJSON-Straßengeometrie.
 * KI-Fahrzeuge sind simuliert; keine echten BOS-Bewegungsdaten.
 */
(function(root){"use strict";
const prohibited=new Set(["footway","path","steps","cycleway","pedestrian","bridleway"]);
function distance(points){
 let n=0;for(let i=1;i<points.length;i++)n+=Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z);return n;
}
function position(points,meters){
 let m=Math.max(0,meters);
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
  if(length<.01)continue;
  if(m<=length||i===points.length-1){
   const t=Math.min(1,m/length);
   return {x:a.x+t*dx,z:a.z+t*dz,yaw:Math.atan2(dx,-dz),nx:-dz/length,nz:dx/length};
  }
  m-=length;
 }
 return {x:points[0]?.x||0,z:points[0]?.z||0,yaw:0,nx:1,nz:0};
}
function generate(model,{cars=6,walkers=8}={}){
 const all=(model?.roads||[]).filter(r=>r.points?.length>=2&&!prohibited.has(r.properties?.highway)&&r.properties?.oneway!=="yes"&&distance(r.points)>25);
 const near=all.filter(r=>r.points.some(p=>Math.hypot(p.x,p.z)<350));
 const paths=(near.length?near:all).slice(0,200);
 const result=[];
 if(!paths.length)return result;
 for(const [kind,count] of [["car",Math.min(cars,paths.length,12)],["walker",Math.min(walkers,paths.length*2,18)]]){
  for(let i=0;i<count;i++){
   const path=paths[Math.floor(i*paths.length/count)],length=distance(path.points);
   const max=Number.parseFloat(path.properties?.maxspeed)||30;
   const speed=kind==="car"?Math.min(12,Math.max(2,max/3.6*.7)):1.15+(i%3)*.13;
   result.push({kind,path,length,speed,progress:length*(.08+((i*.29)% .84)),direction:i%2?1:-1,lane:kind==="car"?2:(i%2?4.2:-4.2)});
  }
 }
 return result;
}
function create({THREE,scene,model,low=false}={}){
 if(!THREE||!scene||!model)throw Error("Straßenverkehr benötigt die geladene Szene");
 const agents=generate(model,{cars:low?3:6,walkers:low?4:8}),group=new THREE.Group();
 group.name="FUNKSPRUCH Stadtverkehr";scene.add(group);
 const geos=[new THREE.BoxGeometry(1.7,.6,3.2),new THREE.BoxGeometry(1.35,.52,1.8),new THREE.CylinderGeometry(.32,.32,.2,10),new THREE.CylinderGeometry(.18,.21,.77,7),new THREE.SphereGeometry(.18,7,5)];
 const paints=[0x3a6c88,0xb8c2c5,0x7c5a58,0x4c6960,0x9f8e71].map(color=>new THREE.MeshStandardMaterial({color,roughness:.8}));
 const tires=new THREE.MeshStandardMaterial({color:0x22272b,roughness:1}),skin=new THREE.MeshStandardMaterial({color:0xc39c82,roughness:1});
 function box(parent,geo,mat,x,y,z){const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
 agents.forEach((a,i)=>{
  a.object=new THREE.Group();group.add(a.object);
  const paint=paints[i%paints.length];
  if(a.kind==="car"){
   box(a.object,geos[0],paint,0,.8,0);box(a.object,geos[1],paint,0,1.27,-.23);
   for(const x of [-.9,.9])for(const z of [-1.08,1.08])box(a.object,geos[2],tires,x,.33,z).rotation.z=Math.PI/2;
  }else{
   box(a.object,geos[3],paint,0,.94,0);box(a.object,geos[4],skin,0,1.53,0);
  }
 });
 function update(dt,indoor=false){
  group.visible=!indoor;if(indoor)return;
  const delta=Math.max(0,Math.min(.12,Number.isFinite(dt)?dt:0));
  for(const a of agents){
   a.progress+=a.direction*a.speed*delta;
   if(a.progress>=a.length){a.progress=a.length;a.direction=-1;}
   if(a.progress<=0){a.progress=0;a.direction=1;}
   const p=position(a.path.points,a.progress);
   const offset=a.kind==="car"?a.lane*a.direction:a.lane;
   a.object.position.set(p.x+p.nx*offset,0,p.z+p.nz*offset);
   a.object.rotation.y=-(p.yaw+(a.direction===-1?Math.PI:0));
  }
 }
 update(0);
 return {update,count:agents.length,dispose(){
  group.parent?.remove(group);geos.forEach(g=>g.dispose());[...paints,tires,skin].forEach(m=>m.dispose());
 }};
}
root.LDFunkspruchTraffic=Object.freeze({generate,position,distance,create});
})(typeof window!=="undefined"?window:globalThis);
