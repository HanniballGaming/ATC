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
 let touch=null,keyboard=null,lookInput={x:0,y:0};
 let indoor=false,entryPoint=null,doorPoint=null,chipPoint=null,office=null,officePieces=[],deskPoint={x:1,z:-1.3},atDesk=false,screenTexture=null,screenCanvas=null,screenContext=null,screenMaterialRef=null;
 const life=root.LDOpenWorldLife.create();
 const walker=root.LDOpenWorldWalker.create();
 const car=root.LDOpenWorldVehicle.create();
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x9cc9e7);
 const camera=new THREE.PerspectiveCamera(70,1,0.1,1500);
 const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"low-power"});
 renderer.outputEncoding=THREE.sRGBEncoding;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.05;
 renderer.setPixelRatio(Math.min(root.devicePixelRatio||1,1.5));
 renderer.domElement.style.cssText="display:block;width:100%;height:100%;touch-action:none";
 const oldPosition=host.style.position;
 const needsPosition=(root.getComputedStyle?.(host)?.position||"static")==="static";
 if(needsPosition)host.style.position="relative";
 host.appendChild(renderer.domElement);
 const ambient=new THREE.HemisphereLight(0xffffff,0x677d58,2);scene.add(ambient);
 const sun=new THREE.DirectionalLight(0xfff3de,1.15);sun.position.set(80,140,50);scene.add(sun);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(5000,5000),new THREE.MeshStandardMaterial({color:0x718d66,roughness:1}));
 ground.rotation.x=-Math.PI/2;ground.position.y=-0.04;scene.add(ground);
 const vehicleVisual=new THREE.Group();
 const body=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.2,4.5),new THREE.MeshStandardMaterial({color:0x285c88}));
 body.position.y=0.85;vehicleVisual.add(body);scene.add(vehicleVisual);
 let frameInput={forward:0,strafe:0,lookX:0,lookY:0,run:false};
 const status=()=>({indoor,atDesk,nearDesk:indoor&&!interaction?.driving&&Math.hypot(walker.snapshot().x-deskPoint.x,walker.snapshot().z-deskPoint.z)<2.4,nearChip:indoor&&!!chipPoint&&!interaction?.driving&&Math.hypot(walker.snapshot().x-chipPoint.x,walker.snapshot().z-chipPoint.z)<2.5,walking:walker.snapshot(),vehicle:car.snapshot(),driving:interaction?.driving||false,life:life.snapshot(),loadedTiles:view?.loadedTiles||0});
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
   lookX:(t.lookX||0)+lookInput.x,lookY:(t.lookY||0)+lookInput.y,run:!!(k.run||t.run)};
 }
 function interact(){
  if(!interaction)return;
  if(atDesk){leaveDesk();return;}
  if(indoor&&!interaction.driving&&Math.hypot(walker.snapshot().x-deskPoint.x,walker.snapshot().z-deskPoint.z)<2.4){try{sitDesk()}catch(e){onStatus({...status(),message:e.message})}return;}
  if(!interaction.driving&&doorPoint){const p=walker.snapshot();if(Math.hypot(p.x-doorPoint.x,p.z-doorPoint.z)<2.6){try{toggleDoor()}catch(e){onStatus({...status(),message:e.message})}return;}}
  if(indoor&&!interaction.driving&&chipPoint){const p=walker.snapshot();if(Math.hypot(p.x-chipPoint.x,p.z-chipPoint.z)<2.5){try{stamp()}catch(e){onStatus({...status(),message:e.message})}return;}}
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
  if(atDesk){lookInput.x=0;lookInput.y=0;return;}
  const input=readInput();
  if(interaction.driving){
   const previous=car.snapshot();
   interaction.update(dt,{throttle:Math.max(0,input.forward),brake:Math.max(0,-input.forward),steer:input.strafe,handbrake:false});
   const current=car.snapshot();
   if(root.LDOpenWorldCollision.collides(current,model,1.1)){
     car.reset({...previous,speed:0,handbrake:true});
   }
  }else{
   if(indoor){walker.update(dt,input,{buildings:[]});const p=walker.snapshot();walker.teleport(Math.max(-7.1,Math.min(7.1,p.x)),Math.max(-5.1,Math.min(5.1,p.z)));}
   else walker.update(dt,input,model);
   const p=walker.snapshot();interactionPlayer.x=p.x;interactionPlayer.z=p.z;interactionPlayer.heading=p.heading;
  }
  lookInput.x=0;lookInput.y=0;
  frameInput=input;
 }
 function frame(time){
  if(disposed)return;
  const dt=last?Math.min((time-last)/1000,0.1):0;last=time;
  accumulator=Math.min(accumulator+dt,0.2);
  while(accumulator>=1/60){fixedStep(1/60);accumulator-=1/60;}
  const driving=interaction.driving;
  const p=driving?car.snapshot():walker.snapshot();
  camera.position.set(atDesk?1:p.x,atDesk?1.3:driving?1.65:1.7,atDesk?-1.05:p.z);
  camera.rotation.order="YXZ";camera.rotation.y=-p.heading;camera.rotation.x=driving?0:p.pitch;
  const c=car.snapshot();vehicleVisual.position.set(c.x,0,c.z);vehicleVisual.rotation.y=-c.heading;
  vehicleVisual.visible=!driving;
  view.update(indoor?entryPoint.x:p.x,indoor?entryPoint.z:p.z);
  if(office)office.visible=indoor;
  ground.visible=!indoor;
  vehicleVisual.visible=!driving&&!indoor;
  scene.background.setHex(indoor?0x1c2835:0x9cc9e7);
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
  const spawn=firstRoad||{x:0,z:0};
  const safe=(p,r)=>!root.LDOpenWorldCollision.collides(p,model,r);
  const findSpawn=(base,r)=>{
   if(safe(base,r))return base;
   for(let d=2;d<=40;d+=2)for(let a=0;a<16;a++){
    const angle=a*Math.PI/8,p={x:base.x+Math.cos(angle)*d,z:base.z+Math.sin(angle)*d};
    if(safe(p,r))return p;
   }
   throw Error("Kein freier Startpunkt in der Nähe");
  };
  const pedestrianSpawn=findSpawn(spawn,0.4);
  const vehicleSpawn=findSpawn({x:pedestrianSpawn.x+1.8,z:pedestrianSpawn.z+1.8},1.1);
  walker.teleport(pedestrianSpawn.x,pedestrianSpawn.z);
  car.reset({x:vehicleSpawn.x,z:vehicleSpawn.z,handbrake:true});
  interaction=root.LDOpenWorldInteraction.create({vehicle:car,player:interactionPlayer});
  entryPoint={...pedestrianSpawn};doorPoint={...pedestrianSpawn};
  office=new THREE.Group();scene.add(office);office.visible=false;
  const addBox=(w,h,d,x,y,z,color)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color}));mesh.position.set(x,y,z);office.add(mesh);officePieces.push(mesh);return mesh;};
  addBox(16,.2,12,0,-.1,0,0x56606b);
  addBox(16,.16,12,0,3.55,0,0xe5e9ec);
  for(const z of [-3.6,0,3.6]){const light=new THREE.PointLight(0xe9f6ff,.85,12,2);light.position.set(0,3.2,z);office.add(light);officePieces.push(light);addBox(3,.06,.4,0,3.43,z,0xe4f4fa);}
  for(const x of [-6.5,6.5])addBox(.16,.16,11.6,x,2.95,0,0x324c60);
  addBox(4,.07,1.4,1,1.28,-2,0x435769);
  addBox(16,3.5,.2,0,1.75,-6,0x8596a2);addBox(.2,3.5,12,-8,1.75,0,0x8596a2);addBox(.2,3.5,12,8,1.75,0,0x8596a2);
  addBox(16,3.5,.2,0,1.75,6,0x8596a2);
  addBox(3,.85,1.2,1,.75,-2,0x2e4052);
  addBox(.7,.6,.7,1,.42,-.7,0x2c3542);
  screenCanvas=root.document.createElement("canvas");screenCanvas.width=512;screenCanvas.height=320;screenContext=screenCanvas.getContext("2d");
  screenTexture=new THREE.CanvasTexture(screenCanvas);
  const screenMaterial=new THREE.MeshBasicMaterial({map:screenTexture});screenMaterialRef=screenMaterial;
  for(const x of [.35,1.8]){
   const bezel=addBox(1.48,.99,.13,x,1.58,-2.36,0x08111b);
   const panel=new THREE.Mesh(new THREE.PlaneGeometry(1.35,.84),screenMaterial);
   panel.position.set(x,1.58,-2.281);office.add(panel);officePieces.push(panel);
  }
  drawScreens();
  addBox(.5,.8,.2,-5.5,1.25,-4.5,0x1e777c);
  addBox(.38,.24,.035,-5.5,1.45,-4.38,0x8fe3cb);
  for(const x of [-6,-3.8,-1.6,4.5,6.5]){addBox(.95,.72,.85,x,.44,3.9,0x344c5d);addBox(.85,.08,.8,x,.88,3.9,0x192c3d);}
  addBox(1.6,.9,.06,-3.5,2,-5.87,0x24415a);
  addBox(2,.14,.55,5.5,1.05,-5.5,0x647987);
  addBox(2.1,2.6,.15,0,1.3,5.9,0x624a37);
  chipPoint={x:-5.5,z:-4.5};
  doorPoint={x:0,z:4.3};
  keyboard=root.LDOpenWorldWalker.keyboard(root);
  renderer.domElement.addEventListener("click",requestPointerLock);
  root.document?.addEventListener("mousemove",pointerMove);
  if(root.LDOpenWorldTouch&&("ontouchstart" in root||root.navigator?.maxTouchPoints>0))
   touch=root.LDOpenWorldTouch.mount(host,{onInteract:interact});
  resize();onStatus(status());raf=root.requestAnimationFrame(frame);
  return api;
 }
 function drawScreens(){
  if(!screenContext)return;
  const ctx=screenContext,w=screenCanvas.width,h=screenCanvas.height;
  ctx.fillStyle="#081a2b";ctx.fillRect(0,0,w,h);
  ctx.fillStyle="#123b52";ctx.fillRect(0,0,w,43);
  ctx.fillStyle="#a7e4f0";ctx.font="bold 21px system-ui";ctx.fillText("LEITSTELLE DEUTSCHLAND",16,29);
  ctx.font="17px system-ui";ctx.fillStyle="#e6f3fc";
  ctx.fillText("EINSATZLEITSYSTEM  |  FUNK  |  NOTRUF",16,86);
  ctx.fillStyle="#1c5b70";ctx.fillRect(16,106,480,52);
  ctx.fillStyle="#fff";ctx.fillText(life.snapshot().onDuty?"DIENST AKTIV":"NICHT EINGESTEMPELT",29,139);
  ctx.fillStyle="#91d4e6";ctx.fillText("Zum Bedienen am Schreibtisch Platz nehmen",16,210);
  ctx.fillText("E: Arbeitsplatz öffnen",16,250);
  screenTexture.needsUpdate=true;
 }
 function sitDesk(){
  if(!indoor)throw Error("Der Arbeitsplatz befindet sich in der Leitstelle");
  if(!life.snapshot().onDuty)throw Error("Bitte vor dem Dienst an der Stechuhr einstempeln");
  atDesk=true;drawScreens();onStatus({...status(),message:"Am Disponentenarbeitsplatz – Monitore aktiv"});
 }
 function leaveDesk(){atDesk=false;onStatus({...status(),message:"Vom Arbeitsplatz aufgestanden"});}
 function toggleDoor(){
  if(!interaction||interaction.driving)throw Error("Zum Betreten müssen Sie aussteigen");
  if(indoor){indoor=false;walker.teleport(entryPoint.x,entryPoint.z);doorPoint={...entryPoint};life.moveTo("stadt");}
  else{indoor=true;walker.teleport(0,3.8);doorPoint={x:0,z:4.3};life.moveTo("leitstelle");}
  try{life.save()}catch(e){console.warn(e)}
  onStatus({...status(),message:indoor?"Leitstelle betreten – zur Stechuhr gehen":"Leitstelle zu Fuß verlassen"});
 }
 function stamp(){
  if(!indoor)throw Error("Die Stechuhr befindet sich in der Leitstelle");
  const p=walker.snapshot();if(Math.hypot(p.x-chipPoint.x,p.z-chipPoint.z)>2.5)throw Error("Bitte direkt zur Stechuhr gehen");
  const next=life.snapshot().onDuty?"dienstende":"dienstbeginn";
  life.action(next);drawScreens();try{life.save()}catch(e){console.warn(e)}
  onStatus({...status(),message:next==="dienstbeginn"?"Eingestempelt – Dienst begonnen":"Ausgestempelt – Dienst beendet"});
  return next;
 }
 function routeTo(x,z){
  if(!graph)throw Error("World not loaded");
  const p=interaction.driving?car.snapshot():walker.snapshot();
  return graph.route(p,{x,z});
 }
 function requestPointerLock(){
  if(!interaction?.driving&&renderer.domElement.requestPointerLock)renderer.domElement.requestPointerLock();
 }
 function pointerMove(event){
  if(root.document?.pointerLockElement!==renderer.domElement||interaction?.driving)return;
  lookInput.x+=(event.movementX||0)*0.002;
  lookInput.y-=(event.movementY||0)*0.002;
 }
 function dispose(){
  if(disposed)return;disposed=true;
  if(raf)root.cancelAnimationFrame(raf);
  resizeObserver?.disconnect();if(!resizeObserver)root.removeEventListener?.("resize",resize);
  renderer.domElement.removeEventListener("click",requestPointerLock);
  root.document?.removeEventListener("mousemove",pointerMove);
  if(root.document?.pointerLockElement===renderer.domElement)root.document.exitPointerLock?.();
  keyboard?.dispose();touch?.dispose();view?.dispose();
  officePieces.forEach(mesh=>{mesh.geometry?.dispose();if(mesh.material&&mesh.material!==screenMaterialRef)mesh.material.dispose()});
  screenTexture?.dispose();screenMaterialRef?.dispose();
  body.geometry.dispose();body.material.dispose();ground.geometry.dispose();ground.material.dispose();
  renderer.dispose();renderer.domElement.remove();
  if(needsPosition)host.style.position=oldPosition;
 }
 const api={start,dispose,interact,toggleDoor,stamp,sitDesk,leaveDesk,routeTo,status,life,walker,car,scene,camera,renderer};
 return api;
}
root.LDOpenWorldRuntime=Object.freeze({create});
})(typeof window!=="undefined"?window:globalThis);
