/* LEITSTELLE DEUTSCHLAND – Open World integration runtime.
 * Depends on geo-core, three-city, vehicle-core, vehicle-interaction,
 * collision-core, walker-core, life-core, road-graph, touch-controls.
 * OSM loader is optional when GeoJSON is supplied.
 * Explicit mount only: no changes to the existing dispatcher interface.
 */
(function(root){"use strict";
function create({THREE,host,geojson,origin,osmBounds,fetchOSM=false,onStatus=()=>{}}={}){
 if(!THREE||!host||!host.appendChild)throw Error("THREE and host required");
 const required=["LDOpenWorldGeo","LDOpenWorldRenderer","LDOpenWorldVehicle","LDOpenWorldInteraction","LDOpenWorldCollision","LDOpenWorldWalker","LDOpenWorldLife","LDOpenWorldRoadGraph"];
 for(const key of required)if(!root[key])throw Error("Missing module: "+key);
 if(!origin||!Number.isFinite(origin.lon)||!Number.isFinite(origin.lat))throw Error("WGS84 origin required");
 let model=null,view=null,graph=null,interaction=null,disposed=false,raf=0,last=0,accumulator=0;
 let touch=null,keyboard=null;
 const life=root.LDOpenWorldLife.create();
 const walker=root.LDOpenWorldWalker.create();
 const car=root.LDOpenWorldVehicle.create();
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x9cc9e7);
 const camera=new THREE.PerspectiveCamera(70,1,0.1,1500);
 const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:"low-power"});
 renderer.setPixelRatio(Math.min(root.devicePixelRatio||1,1.5));
 renderer.domElement.style.cssText="display:block;width:100%;height:100%;touch-action:none";
 const oldPosition=host.style.position;if(!oldPosition)host.style.position="relative";
 host.appendChild(renderer.domElement);
 const ambient=new THREE.HemisphereLight(0xffffff,0x677d58,2);scene.add(ambient);
 const sun=new THREE.DirectionalLight(0xffffff,1.3);sun.position.set(80,140,50);scene.add(sun);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(5000,5000),new THREE.MeshStandardMaterial({color:0x718d66,roughness:1}));
 ground.rotation.x=-Math.PI/2;ground.position.y=-0.04;scene.add(ground);
 const vehicleVisual=new THREE.Group();
 const body=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.2,4.5),new THREE.MeshStandardMaterial({color:0x285c88}));
 body.position.y=0.85;vehicleVisual.add(body);scene.add(vehicleVisual);
 let frameInput={forward:0,strafe:0,lookX:0,lookY:0,run:false};
 const status=()=>({walking:walker.snapshot(),vehicle:car.snapshot(),driving:interaction?.driving||false,life:life.snapshot(),loadedTiles:view?.loadedTiles||0});
 function resize(){
  const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);
  camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);
 }
 const resizeObserver=typeof root.ResizeObserver==="function"?new root.ResizeObserver(resize):null;
 if(resizeObserver)resizeObserver.observe(host);
 else root.addEventListener?.("resize",resize);
 function readInput(){
  const k=keyboard?.read()||{};
  const t=touch?.read()||{};
  return {forward:Math.max(-1,Math.min(1,(k.forward||0)+(t.forward||0))),
   strafe:Math.max(-1,Math.min(1,(k.strafe||0)+(t.strafe||0))),
   lookX:t.lookX||0,lookY:t.lookY||0,run:!!(k.run||t.run)};
 }
 function interact(){
  if(!interaction)return;
  try{
   if(interaction.driving){
    interaction.exit(p=>!root.LDOpenWorldCollision.collides(p,model,0.4));
    const p=interaction.snapshot().player;walker.teleport(p.x,p.z);
   }else{
    const p=walker.snapshot();interactionPlayer.x=p.x;interactionPlayer.z=p.z;interactionPlayer.heading=p.heading;
    interaction.enter();
   }
   onStatus(status());
  }catch(e){onStatus({...status(),message:e.message});}
 }
 const interactionPlayer={x:0,z:0,heading:0};
 function fixedStep(dt){
  const input=readInput();
  if(interaction.driving){
   interaction.update(dt,{throttle:Math.max(0,input.forward),brake:Math.max(0,-input.forward),steer:input.strafe,handbrake:false});
  }else{
   walker.update(dt,input,model);
   const p=walker.snapshot();interactionPlayer.x=p.x;interactionPlayer.z=p.z;interactionPlayer.heading=p.heading;
  }
  frameInput=input;
 }
 function frame(time){
  if(disposed)return;
  const dt=last?Math.min((time-last)/1000,0.1):0;last=time;
  accumulator=Math.min(accumulator+dt,0.2);
  while(accumulator>=1/60){fixedStep(1/60);accumulator-=1/60;}
  const driving=interaction.driving;
  const p=driving?car.snapshot():walker.snapshot();
  camera.position.set(p.x,driving?1.65:1.7,p.z);
  camera.rotation.order="YXZ";camera.rotation.y=-p.heading;camera.rotation.x=driving?0:p.pitch;
  const c=car.snapshot();vehicleVisual.position.set(c.x,0,c.z);vehicleVisual.rotation.y=-c.heading;
  vehicleVisual.visible=!driving;
  view.update(p.x,p.z);
  renderer.render(scene,camera);
  raf=root.requestAnimationFrame(frame);
 }
 async function start(){
  if(!geojson){
   if(!fetchOSM||!osmBounds||!root.LDOpenWorldOSM)throw Error("Supply GeoJSON or enable bounded OSM import");
   geojson=await root.LDOpenWorldOSM.fetchBounds(osmBounds);
  }
  if(disposed)throw Error("Runtime disposed");
  model=root.LDOpenWorldGeo.loadGeoJSON(geojson,origin);
  graph=root.LDOpenWorldRoadGraph.create(model);
  view=root.LDOpenWorldRenderer.create(THREE,scene);
  view.setModel(model);
  const firstRoad=model.roads[0]?.points[0];
  if(firstRoad){walker.teleport(firstRoad.x,firstRoad.z);car.reset({x:firstRoad.x+1.5,z:firstRoad.z+1.5});}
  else car.reset({x:2,z:2});
  interaction=root.LDOpenWorldInteraction.create({vehicle:car,player:interactionPlayer});
  keyboard=root.LDOpenWorldWalker.keyboard(root);
  if(root.LDOpenWorldTouch&&("ontouchstart" in root||root.navigator?.maxTouchPoints>0))
   touch=root.LDOpenWorldTouch.mount(host,{onInteract:interact});
  resize();onStatus(status());raf=root.requestAnimationFrame(frame);
  return api;
 }
 function routeTo(x,z){
  if(!graph)throw Error("World not loaded");
  const p=interaction.driving?car.snapshot():walker.snapshot();
  return graph.route(p,{x,z});
 }
 function dispose(){
  if(disposed)return;disposed=true;
  if(raf)root.cancelAnimationFrame(raf);
  resizeObserver?.disconnect();if(!resizeObserver)root.removeEventListener?.("resize",resize);
  keyboard?.dispose();touch?.dispose();view?.dispose();
  body.geometry.dispose();body.material.dispose();ground.geometry.dispose();ground.material.dispose();
  renderer.dispose();renderer.domElement.remove();
  if(!oldPosition)host.style.position="";
 }
 const api={start,dispose,interact,routeTo,status,life,walker,car,scene,camera,renderer};
 return api;
}
root.LDOpenWorldRuntime=Object.freeze({create});
})(typeof window!=="undefined"?window:globalThis);
