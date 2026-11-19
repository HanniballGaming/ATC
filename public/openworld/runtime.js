/* LEITSTELLE DEUTSCHLAND – Open World integration runtime.
 * Depends on geo-core, three-city, vehicle-core, vehicle-interaction,
 * collision-core, walker-core, life-core, road-graph, touch-controls.
 * OSM loader is optional when GeoJSON is supplied.
 * Explicit mount only: no changes to the existing dispatcher interface.
 */
(function(root){"use strict";
function create({THREE,host,geojson,origin,osmBounds,fetchOSM=false,graphics={},onStatus=()=>{}}={}){
 if(!THREE||!host||!host.appendChild)throw Error("THREE and host required");
 const required=["LDOpenWorldGeo","LDOpenWorldRenderer","LDOpenWorldVehicle","LDOpenWorldInteraction","LDOpenWorldCollision","LDOpenWorldWalker","LDOpenWorldLife","LDOpenWorldRoadGraph"];
 for(const key of required)if(!root[key])throw Error("Missing module: "+key);
 if(!origin||!Number.isFinite(origin.lon)||!Number.isFinite(origin.lat))throw Error("WGS84 origin required");
 let model=null,view=null,graph=null,walkingGraph=null,interaction=null,disposed=false,raf=0,last=0,accumulator=0,paused=true;
 let touch=null,keyboard=null,lookInput={x:0,y:0},worldUpgrade=null,traffic=null;
 let streetDestinations=[],activeRoute=null,routeVisual=null;
 const performance=root.LDFunkspruchPerformance?.create?.()||null;
 let adaptiveGraphics=false,lowGraphics=graphics.renderRadius===1,lookSensitivity=1;
 let indoor=false,entryPoint=null,doorPoint=null,chipPoint=null,office=null,officePieces=[],exterior=null,deskPoint={x:1,z:-1.3},atDesk=false,screenTexture=null,screenCanvas=null,screenContext=null,screenMaterialRef=null;
 const life=root.LDOpenWorldLife.create();
 const journal=root.LDFunkspruchShiftJournal?.create?.()||null;
 const walker=root.LDOpenWorldWalker.create();
 const indoorCollisions=root.LDFunkspruchIndoor?.model?.()||{buildings:[]};
 const car=root.LDOpenWorldVehicle.create();
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x9cc9e7);
 // Fiktives Trainingsgebäude: keine Behauptung über reale Rettungsleitstellenstandorte.
 function makeStationExterior(position){
  const g=new THREE.Group();g.name="FUNKSPRUCH Trainingsleitstelle";g.position.set(position.x,0,position.z);
  const mats=[],geoms=[],textures=[];
  function cuboid(name,x,y,z,w,h,d,color){
   const geo=new THREE.BoxGeometry(w,h,d),mat=new THREE.MeshStandardMaterial({color,roughness:.84});
   const mesh=new THREE.Mesh(geo,mat);mesh.name=name;mesh.position.set(x,y,z);g.add(mesh);mats.push(mat);geoms.push(geo);return mesh;
  }
  cuboid("Hauptgebäude",0,4,-9,18,8,12,0x7d8c98);
  cuboid("Dachrand",0,8.12,-9,18.6,.38,12.6,0x2e4857);
  cuboid("Sockel",0,.28,-9,18,.55,12,0x435768);
  cuboid("Eingangstür",0,1.5,-2.94,1.9,2.9,.13,0x1b445e);
  cuboid("Türglas",0,1.7,-2.85,1.62,2.2,.06,0x4d8eaa);
  cuboid("Türgriff",.66,1.4,-2.78,.09,.35,.12,0xcfdde3);
  cuboid("Vordach",0,3.1,-2.25,5,.23,2.1,0x2c4557);
  cuboid("Fußweg",0,.022,-1.5,2.5,.05,3.1,0x9eaeb5);
  for(const floor of [1.5,5.2]){
   for(const x of [-7,-4.6,4.6,7]){
    cuboid("Fenster",x,floor,-2.94,1.35,1.55,.09,0x286581);
    cuboid("Fensterrahmen",x,floor,-2.87,1.42,.08,.13,0xc5d9e2);
   }
  }
  const canvas=root.document?.createElement?.("canvas");
  if(canvas){
   canvas.width=1024;canvas.height=180;
   const ctx=canvas.getContext("2d");
   if(ctx){
    ctx.fillStyle="#10314a";ctx.fillRect(0,0,1024,180);
    ctx.fillStyle="#9ee9ee";ctx.font="bold 80px Arial";ctx.fillText("FUNKSPRUCH",32,104);
    ctx.fillStyle="#e4f6f8";ctx.font="34px Arial";ctx.fillText("FIKTIVE TRAININGSLEITSTELLE",34,153);
    const tex=new THREE.CanvasTexture(canvas),mat=new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide});
    const geo=new THREE.PlaneGeometry(8.8,1.6),sign=new THREE.Mesh(geo,mat);
    sign.name="Eingangsschild";sign.position.set(0,5.85,-2.915);g.add(sign);
    textures.push(tex);mats.push(mat);geoms.push(geo);
   }
  }
  scene.add(g);
  g.userData.dispose=()=>{for(const geom of geoms)geom.dispose();for(const mat of mats)mat.dispose();for(const tex of textures)tex.dispose();scene.remove(g);};
  return g;
 }

 const camera=new THREE.PerspectiveCamera(70,1,0.1,1500);
 const renderer=new THREE.WebGLRenderer({antialias:graphics.antialias!==false,powerPreference:graphics.powerPreference==="low-power"?"low-power":"high-performance"});
 renderer.outputEncoding=THREE.sRGBEncoding;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.05;
 renderer.setPixelRatio(Math.min(root.devicePixelRatio||1,graphics.pixelRatio===1?1:1.5));
 renderer.domElement.style.cssText="display:block;width:100%;height:100%;touch-action:none";
 const oldPosition=host.style.position;
 const needsPosition=(root.getComputedStyle?.(host)?.position||"static")==="static";
 if(needsPosition)host.style.position="relative";
 host.appendChild(renderer.domElement);
 const ambient=new THREE.HemisphereLight(0xffffff,0x677d58,2);scene.add(ambient);
 const sun=new THREE.DirectionalLight(0xfff3de,1.15);sun.position.set(80,140,50);scene.add(sun);
 const indoorSky=new THREE.Color(0x1c2835),outdoorSky=new THREE.Color(0x9cc9e7),nightSky=new THREE.Color(0x102138),daySky=new THREE.Color(0x9cc9e7);
 let lastLightMinute=-1,lastLightIndoors=null;
 function updateLighting(indoors){
  const minute=((Math.floor(life.snapshot().minutes)%1440)+1440)%1440;
  if(minute===lastLightMinute&&indoors===lastLightIndoors)return;
  lastLightMinute=minute;lastLightIndoors=indoors;
  const amount=root.LDFunkspruchWorld?.daylight?.(minute)??1;
  const brightness=Math.min(1,Math.pow(amount,.48));
  outdoorSky.copy(nightSky).lerp(daySky,brightness);
  ambient.intensity=indoors?1.8:.45+1.55*amount;
  sun.intensity=indoors?0:.1+1.25*amount;
  sun.position.set(90*Math.cos(minute/1440*Math.PI*2),20+130*amount,50);
 }

 const ground=new THREE.Mesh(new THREE.PlaneGeometry(5000,5000),new THREE.MeshStandardMaterial({color:0x718d66,roughness:1}));
 ground.rotation.x=-Math.PI/2;ground.position.y=-0.04;scene.add(ground);
 const vehicleVisual=new THREE.Group();vehicleVisual.name="FUNKSPRUCH Dienstfahrzeug";
 const vehicleParts=[];
 function carPart(geometry,color,x,y,z,roughness=.65){
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness,metalness:.06}));
  mesh.position.set(x,y,z);vehicleVisual.add(mesh);vehicleParts.push(mesh);return mesh;
 }
 // Lizenzfreie, ressourcenschonende 3D-Geometrie: kein austauschbarer Platzhalter-Kubus.
 carPart(new THREE.BoxGeometry(1.88,.62,4.25),0x285c88,0,.82,0);
 carPart(new THREE.BoxGeometry(1.57,.61,2.34),0x365d78,0,1.37,-.27);
 carPart(new THREE.BoxGeometry(1.43,.48,.035),0x182e3f,0,1.42,-1.455,.22);
 carPart(new THREE.BoxGeometry(1.43,.43,.035),0x223a49,0,1.45,.928,.22);
 for(const side of [-1,1]){
  carPart(new THREE.BoxGeometry(.038,.38,1.62),0x152e3e,side*.808,1.47,-.3,.2);
  carPart(new THREE.BoxGeometry(.25,.12,.28),0x152733,side*1.02,1.26,-1.1);
  carPart(new THREE.BoxGeometry(.25,.16,.12),0xffefcf,side*.65,.9,-2.13,.3);
  carPart(new THREE.BoxGeometry(.24,.14,.12),0x9d1b20,side*.67,.91,2.13,.3);
  for(const z of [-1.38,1.38]){
   const wheel=carPart(new THREE.CylinderGeometry(.36,.36,.2,12),0x171d24,side*1.0,.36,z,.97);
   wheel.rotation.z=Math.PI/2;
   const hub=carPart(new THREE.CylinderGeometry(.19,.19,.21,12),0x9ba4a8,side*1.01,.36,z,.42);
   hub.rotation.z=Math.PI/2;
  }
 }
 carPart(new THREE.BoxGeometry(1.4,.16,.13),0x151b24,0,.52,-2.15,.95);
 carPart(new THREE.BoxGeometry(1.4,.16,.13),0x151b24,0,.52,2.15,.95);
 scene.add(vehicleVisual);
 let frameInput={forward:0,strafe:0,lookX:0,lookY:0,run:false},dispatchSummary=null,clockAccumulator=0,wallClockTexture=null,wallClockCanvas=null;
 const status=()=>({indoor,atDesk,nearDoor:!interaction?.driving&&!!doorPoint&&Math.hypot(walker.snapshot().x-doorPoint.x,walker.snapshot().z-doorPoint.z)<2.6,nearDesk:indoor&&!interaction?.driving&&Math.hypot(walker.snapshot().x-deskPoint.x,walker.snapshot().z-deskPoint.z)<2.4,nearChip:indoor&&!!chipPoint&&!interaction?.driving&&Math.hypot(walker.snapshot().x-chipPoint.x,walker.snapshot().z-chipPoint.z)<2.5,walking:walker.snapshot(),vehicle:car.snapshot(),driving:interaction?.driving||false,life:life.snapshot(),loadedTiles:view?.loadedTiles||0,dispatch:dispatchSummary?{...dispatchSummary}:null});
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
   lookX:(t.lookX||0)*lookSensitivity+lookInput.x,lookY:(t.lookY||0)*lookSensitivity+lookInput.y,run:!!(k.run||t.run)};
 }
 function interact(){
  if(!interaction)return;
  if(atDesk){leaveDesk();return;}
  if(indoor&&!interaction.driving&&Math.hypot(walker.snapshot().x-deskPoint.x,walker.snapshot().z-deskPoint.z)<2.4){try{sitDesk()}catch(e){onStatus({...status(),message:e.message})}return;}
  if(!interaction.driving&&doorPoint){const p=walker.snapshot();if(Math.hypot(p.x-doorPoint.x,p.z-doorPoint.z)<2.6){try{toggleDoor()}catch(e){onStatus({...status(),message:e.message})}return;}}
  if(indoor&&!interaction.driving&&worldUpgrade?.interact(walker.snapshot()))return;
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
   if(indoor){walker.update(dt,input,indoorCollisions);const p=walker.snapshot();walker.teleport(Math.max(-7.1,Math.min(7.1,p.x)),Math.max(-5.1,Math.min(5.1,p.z)));}
   else walker.update(dt,input,model);
   const p=walker.snapshot();interactionPlayer.x=p.x;interactionPlayer.z=p.z;interactionPlayer.heading=p.heading;
  }
  lookInput.x=0;lookInput.y=0;
  frameInput=input;
 }
 function frame(time){
  if(disposed)return;
  if(paused){last=time;raf=root.requestAnimationFrame(frame);return;}
  const rawDt=last?Math.max(0,Math.min((time-last)/1000,.6)):0;
  const dt=Math.min(rawDt,.1);last=time;
  const requested=performance?.sample(rawDt,adaptiveGraphics&&!atDesk);
  if(requested!==null&&requested!==undefined)setGraphicsProfile(requested,true);
  accumulator=Math.min(accumulator+dt,0.2);
  while(accumulator>=1/60){fixedStep(1/60);accumulator-=1/60;}
  if(!dispatchSummary&&!atDesk){
   clockAccumulator+=dt;
   if(clockAccumulator>=20){
    life.advance(Math.floor(clockAccumulator/20));
    clockAccumulator%=20;drawWallClock();
   }
  }
  worldUpgrade?.update(dt,{indoor,onDuty:life.snapshot().onDuty});
  traffic?.update(dt,indoor);
  const driving=interaction.driving;
  const p=driving?car.snapshot():walker.snapshot();
  camera.position.set(atDesk?1:p.x,atDesk?1.3:driving?1.65:1.7,atDesk?-1.05:p.z);
  camera.rotation.order="YXZ";camera.rotation.y=atDesk?0:-p.heading;camera.rotation.x=atDesk?-.04:driving?0:p.pitch;
  const c=car.snapshot();vehicleVisual.position.set(c.x,0,c.z);vehicleVisual.rotation.y=-c.heading;
  vehicleVisual.visible=!driving;
  view.update(indoor?entryPoint.x:p.x,indoor?entryPoint.z:p.z);
  if(office)office.visible=indoor;
   if(routeVisual)routeVisual.visible=!indoor&&!atDesk;
   if(activeRoute&&!indoor&&!atDesk){
    const target=activeRoute.destination;
    if(Math.hypot(p.x-target.x,p.z-target.z)<12){
     const label=activeRoute.name;clearRoute();onStatus({...status(),message:"Navigationsziel "+label+" erreicht"});
    }
   }
  if(exterior)exterior.visible=!indoor;
  ground.visible=!indoor;
  vehicleVisual.visible=!driving&&!indoor;
  updateLighting(indoor);
  scene.background.copy(indoor?indoorSky:outdoorSky);
  if(!atDesk)renderer.render(scene,camera); // Der ELS-Bildschirm verdeckt die Szene vollständig.
  raf=root.requestAnimationFrame(frame);
 }
 async function start(){
  if(!geojson){
   if(!fetchOSM||!osmBounds||!root.LDOpenWorldOSM)throw Error("Supply GeoJSON or enable bounded OSM import");
   geojson=await root.LDOpenWorldOSM.fetchBounds(osmBounds);
  }
  if(disposed)throw Error("Runtime disposed");
  model=root.LDOpenWorldGeo.loadGeoJSON(geojson,origin);
   streetDestinations=root.LDFunkspruchNavigation?.destinations?.(model,{limit:120})||[];
  if(root.LDFunkspruchTraffic)traffic=root.LDFunkspruchTraffic.create({THREE,scene,model,low:graphics.renderRadius===1});
  graph=root.LDOpenWorldRoadGraph.create(model,{mode:"car"});
  walkingGraph=root.LDOpenWorldRoadGraph.create(model,{mode:"walk"});
  view=root.LDOpenWorldRenderer.create(THREE,scene,{radius:graphics.renderRadius===1?1:2});
  view.setModel(model);
  const firstRoad=model.roads[0]?.points[0];
  const spawn=graph.nearest({x:0,z:0})?.point||firstRoad||{x:0,z:0};
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
  entryPoint={...pedestrianSpawn};doorPoint={x:entryPoint.x,z:entryPoint.z-1.7};
  exterior=makeStationExterior(entryPoint);
  office=new THREE.Group();scene.add(office);office.visible=false;
  if(root.LDFunkspruchWorld){worldUpgrade=root.LDFunkspruchWorld.install({THREE,scene,camera,life,model,stationPosition:entryPoint,onMessage:message=>onStatus({...status(),message})});worldUpgrade.addIndoor(office);}
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
  wallClockCanvas=root.document.createElement("canvas");wallClockCanvas.width=512;wallClockCanvas.height=150;
  wallClockTexture=new THREE.CanvasTexture(wallClockCanvas);
  const clockPanel=new THREE.Mesh(new THREE.PlaneGeometry(2.25,.65),new THREE.MeshBasicMaterial({map:wallClockTexture}));
  clockPanel.position.set(-4,2.65,-5.87);clockPanel.name="Schichtuhr";
  office.add(clockPanel);officePieces.push(clockPanel);drawWallClock();
  addBox(.5,.8,.2,-5.5,1.25,-4.5,0x1e777c);
  addBox(.38,.24,.035,-5.5,1.45,-4.38,0x8fe3cb);
  for(const x of [-6,-3.8,-1.6,4.5,6.5]){addBox(.95,.72,.85,x,.44,3.9,0x344c5d);addBox(.85,.08,.8,x,.88,3.9,0x192c3d);}
  addBox(1.6,.9,.06,-3.5,2,-5.87,0x24415a);
  addBox(2,.14,.55,5.5,1.05,-5.5,0x647987);
  addBox(2.1,2.6,.15,0,1.3,5.9,0x624a37);
  chipPoint={x:-5.5,z:-4.5};
  // Beim Spielstart befindet sich der Spieler draußen. Erst nach dem Betreten
  // wechselt der Tür-Interaktionspunkt auf die Position der Innentür.
  keyboard=root.LDOpenWorldWalker.keyboard(root);
  renderer.domElement.addEventListener("click",requestPointerLock);
  root.document?.addEventListener("mousemove",pointerMove);
  if(root.LDOpenWorldTouch&&("ontouchstart" in root||root.navigator?.maxTouchPoints>0))
   touch=root.LDOpenWorldTouch.mount(host,{onInteract:interact,onMenu:()=>root.dispatchEvent?.(new root.Event("funkspruch:toggle-menu"))});
  resize();onStatus(status());raf=root.requestAnimationFrame(frame);
  return api;
 }
 function drawWallClock(){
  if(!wallClockCanvas)return;
  const ctx=wallClockCanvas.getContext("2d");if(!ctx)return;
  const now=Math.round(life.snapshot().minutes);
  const time=String(Math.floor(now/60)%24).padStart(2,"0")+":"+String(now%60).padStart(2,"0");
  ctx.fillStyle="#071b29";ctx.fillRect(0,0,512,150);
  ctx.fillStyle="#a1e3e7";ctx.font="bold 61px monospace";ctx.fillText(time,20,83);
  ctx.font="23px system-ui";ctx.fillStyle="#d4e6ef";ctx.fillText("LEITPLATZ · SCHICHTUHR",21,122);
  wallClockTexture.needsUpdate=true;
 }
 function drawScreens(){
  if(!screenContext)return;
  const ctx=screenContext,w=screenCanvas.width,h=screenCanvas.height;
  ctx.fillStyle="#081a2b";ctx.fillRect(0,0,w,h);
  ctx.fillStyle="#123b52";ctx.fillRect(0,0,w,43);
  ctx.fillStyle="#a7e4f0";ctx.font="bold 21px system-ui";ctx.fillText("FUNKSPRUCH",16,29);
  ctx.font="17px system-ui";ctx.fillStyle="#e6f3fc";
  ctx.fillText("EINSATZLEITSYSTEM  |  FUNK  |  NOTRUF",16,86);
  ctx.fillStyle="#1c5b70";ctx.fillRect(16,106,480,52);
  ctx.fillStyle="#fff";ctx.fillText(life.snapshot().onDuty?"DIENST AKTIV":"NICHT EINGESTEMPELT",29,139);
  ctx.fillStyle="#91d4e6";if(dispatchSummary){
   ctx.font="bold 19px system-ui";
   ctx.fillStyle="#a3eeea";ctx.fillText("OFFENE EINSÄTZE: "+dispatchSummary.open,16,200);
   ctx.fillStyle=dispatchSummary.waiting?"#ffcc8d":"#c1dce9";
   ctx.fillText("WARTENDE NOTRUFE: "+dispatchSummary.waiting,16,235);
   ctx.fillStyle="#b8d8e7";ctx.fillText("FREIE FAHRZEUGE: "+dispatchSummary.free+"/"+dispatchSummary.total,16,270);
  }else{
   ctx.fillText("Zum Bedienen am Schreibtisch Platz nehmen",16,210);
   ctx.fillText("E: Arbeitsplatz öffnen",16,250);
  }
  screenTexture.needsUpdate=true;
 }
 function sitDesk(){
  if(!indoor)throw Error("Der Arbeitsplatz befindet sich in der Leitstelle");
  if(!life.snapshot().onDuty)throw Error("Bitte vor dem Dienst an der Stechuhr einstempeln");
  if(Math.hypot(walker.snapshot().x-deskPoint.x,walker.snapshot().z-deskPoint.z)>2.4)throw Error("Bitte zum Disponentenarbeitsplatz gehen");
  if(root.document?.pointerLockElement===renderer.domElement)root.document.exitPointerLock?.();
  atDesk=true;drawScreens();onStatus({...status(),message:"Am Disponentenarbeitsplatz – Monitore aktiv"});
 }
 function leaveDesk(){atDesk=false;onStatus({...status(),message:"Vom Arbeitsplatz aufgestanden"});}
 function toggleDoor(){
  if(!interaction||interaction.driving)throw Error("Zum Betreten müssen Sie aussteigen");
  if(atDesk)throw Error("Bitte vor dem Verlassen der Leitstelle aufstehen");
  if(indoor){indoor=false;walker.teleport(entryPoint.x,entryPoint.z);doorPoint={x:entryPoint.x,z:entryPoint.z-1.7};life.moveTo("stadt");}
  else{indoor=true;walker.teleport(0,3.8);doorPoint={x:0,z:4.3};life.moveTo("leitstelle");}
  try{life.save()}catch(e){console.warn(e)}
  onStatus({...status(),message:indoor?"Leitstelle betreten – zur Stechuhr gehen":"Leitstelle zu Fuß verlassen"});
 }
 function stamp(){
  if(!indoor)throw Error("Die Stechuhr befindet sich in der Leitstelle");
  const p=walker.snapshot();if(Math.hypot(p.x-chipPoint.x,p.z-chipPoint.z)>2.5)throw Error("Bitte direkt zur Stechuhr gehen");
  const next=life.snapshot().onDuty?"dienstende":"dienstbeginn";
  if(next==="dienstende"&&atDesk)throw Error("Bitte zuerst den Arbeitsplatz verlassen");
  life.action(next);
  if(next==="dienstbeginn")journal?.begin(status());
  else if(next==="dienstende")journal?.finish(status());
  drawScreens();drawWallClock();try{life.save()}catch(e){console.warn(e)}
  onStatus({...status(),message:next==="dienstbeginn"?"Eingestempelt – Dienst begonnen":"Ausgestempelt – Dienst beendet"});
  return next;
 }
 function clearRoute(){
  if(routeVisual){scene.remove(routeVisual);routeVisual.geometry.dispose();routeVisual.material.dispose();routeVisual=null;}
  activeRoute=null;
 }
 function planStreetRoute(name){
  if(!model)throw Error("Karte noch nicht geladen");
  const destination=streetDestinations.find(x=>x.name===name);
  if(!destination)throw Error("Diese Straße ist nicht in den geladenen OSM-Daten enthalten.");
  const result=routeTo(destination.x,destination.z);
  const summary=root.LDFunkspruchNavigation?.estimate?.(result);
  if(!result||!summary||result.path.length<2)throw Error("Keine durchgehend kartierte Verbindung zu dieser Straße gefunden.");
  clearRoute();
  const geometry=new THREE.BufferGeometry().setFromPoints(result.path.map(p=>new THREE.Vector3(p.x,.13,p.z)));
  const material=new THREE.LineBasicMaterial({color:0x63dcf0,depthTest:false,transparent:true,opacity:.88});
  routeVisual=new THREE.Line(geometry,material);routeVisual.name="FUNKSPRUCH OSM-Navigationsroute";
  scene.add(routeVisual);
  activeRoute={name,destination,result,summary};
  onStatus({...status(),message:"OSM-Route zur "+name+": "+summary.meters+" m · ca. "+summary.minutes+" Min. ("+summary.mode+")"});
  return {name,...summary};
 }
 function routeStatus(){
  if(!activeRoute)return null;
  const p=indoor?entryPoint:interaction?.driving?car.snapshot():walker.snapshot();
  const d=activeRoute.destination;
  const waypoint=root.LDFunkspruchNavigation?.nearestWaypoint?.(p,activeRoute.result);
  return {name:activeRoute.name,...activeRoute.summary,airMeters:Math.round(Math.hypot(p.x-d.x,p.z-d.z)),waypoint};
 }
 function routeTo(x,z){
  if(!graph)throw Error("World not loaded");
  const p=indoor?entryPoint:interaction.driving?car.snapshot():walker.snapshot();
  return (interaction.driving?graph:walkingGraph||graph).route(p,{x,z});
 }
 function requestPointerLock(){
  if(!interaction?.driving&&renderer.domElement.requestPointerLock)renderer.domElement.requestPointerLock();
 }
 function pointerMove(event){
  if(root.document?.pointerLockElement!==renderer.domElement||interaction?.driving)return;
  lookInput.x+=(event.movementX||0)*0.002*lookSensitivity;
  lookInput.y-=(event.movementY||0)*0.002*lookSensitivity;
 }
 function dispose(){
  if(disposed)return;disposed=true;
  if(raf)root.cancelAnimationFrame(raf);
  resizeObserver?.disconnect();if(!resizeObserver)root.removeEventListener?.("resize",resize);
  renderer.domElement.removeEventListener("click",requestPointerLock);
  root.document?.removeEventListener("mousemove",pointerMove);
  if(root.document?.pointerLockElement===renderer.domElement)root.document.exitPointerLock?.();
  keyboard?.dispose();touch?.dispose();view?.dispose();traffic?.dispose();worldUpgrade?.dispose();exterior?.userData?.dispose?.();clearRoute();
  officePieces.forEach(mesh=>{mesh.geometry?.dispose();if(mesh.material&&mesh.material!==screenMaterialRef)mesh.material.dispose()});
  screenTexture?.dispose();screenMaterialRef?.dispose();wallClockTexture?.dispose();
  for(const part of vehicleParts){part.geometry.dispose();part.material.dispose();}ground.geometry.dispose();ground.material.dispose();
  renderer.dispose();renderer.domElement.remove();
  if(needsPosition)host.style.position=oldPosition;
 }
 function setPaused(value){paused=!!value;return paused;}
 function setInputProfile(sensitivity=1,fov=70){
  if(Number.isFinite(sensitivity))lookSensitivity=Math.max(.5,Math.min(2,sensitivity));
  if(Number.isFinite(fov)){
   camera.fov=Math.max(60,Math.min(95,fov));
   camera.updateProjectionMatrix();
  }
  return {sensitivity:lookSensitivity,fov:camera.fov};
 }
 function setGraphicsProfile(low,adaptive=false){
  lowGraphics=!!low;adaptiveGraphics=!!adaptive;
  renderer.setPixelRatio(Math.min(root.devicePixelRatio||1,lowGraphics?1:1.5));
  view?.setRadius?.(lowGraphics?1:2);
  performance?.reset(lowGraphics);
  resize();return lowGraphics;
 }
 function setDispatchSummary(raw){
  if(!raw||!["open","waiting","free","total"].every(k=>Number.isSafeInteger(raw[k])&&raw[k]>=0&&raw[k]<=100000))return false;
  if(raw.waiting>raw.open||raw.free>raw.total)return false;
  dispatchSummary={
   open:raw.open,waiting:raw.waiting,free:raw.free,total:raw.total,
   minute:Number.isFinite(raw.minute)?Math.max(0,Math.min(1439,Math.round(raw.minute))):null
  };
  if(dispatchSummary.minute!==null)life.syncClock(dispatchSummary.minute);
  worldUpgrade?.setDispatchSummary?.(dispatchSummary);
  journal?.record(status());
  drawScreens();drawWallClock();return true;
 }
 function saveWorld(){
  if(!model)return null;
  return {version:2,indoor,player:walker.snapshot(),vehicle:car.snapshot(),onDuty:!!life.snapshot().onDuty,life:life.snapshot(),destinationStreet:activeRoute?.name||null};
 }
 function restoreWorld(saved){
  if(!model||!entryPoint||!saved||![1,2].includes(saved.version)||!saved.player)return false;
  const p=saved.player,c=saved.vehicle;
  if(![p.x,p.z,p.heading,p.pitch].every(Number.isFinite))return false;
  if(Math.abs(p.x)>100000||Math.abs(p.z)>100000)return false;
  // World and life snapshots from version 2 must match before restoring either.
  if(saved.version===2){
   const l=saved.life,limits={minutes:[0,10000000],money:[0,100000000],hunger:[0,100],thirst:[0,100],fatigue:[0,100],hygiene:[0,100],shiftStart:[0,1439],shiftEnd:[0,1439]};
   if(!l||typeof l!=="object"||Array.isArray(l)||typeof l.onDuty!=="boolean"||l.onDuty!==saved.onDuty||
      !["wohnung","leitstelle","restaurant","stadt"].includes(l.location))return false;
   for(const [key,[min,max]] of Object.entries(limits))
    if(!Number.isFinite(l[key])||l[key]<min||l[key]>max)return false;
  }
  if(saved.indoor){
   if(p.x < -7.1||p.x>7.1||p.z < -5.1||p.z>5.1)return false;
   indoor=true;doorPoint={x:0,z:4.3};
   walker.teleport(p.x,p.z,p.heading,p.pitch);
   life.moveTo("leitstelle");
  }else{
   if(Math.hypot(p.x-entryPoint.x,p.z-entryPoint.z)>1000||root.LDOpenWorldCollision.collides(p,model,.35))return false;
   indoor=false;doorPoint={x:entryPoint.x,z:entryPoint.z-1.7};
   walker.teleport(p.x,p.z,p.heading,p.pitch);
   life.moveTo("stadt");
  }
  if(saved.version===2){life.load({getItem:()=>JSON.stringify(saved.life)});life.moveTo(indoor?"leitstelle":"stadt");}
  atDesk=false;
  if(c&&[c.x,c.z,c.heading].every(Number.isFinite)&&Math.hypot(c.x-entryPoint.x,c.z-entryPoint.z)<1000)
   car.reset({x:c.x,z:c.z,heading:c.heading,speed:0,handbrake:true});
  if(typeof saved.destinationStreet==="string"&&saved.destinationStreet.length<=90){
    try{planStreetRoute(saved.destinationStreet);}catch(error){console.warn("Gespeicherte Navigation nicht verfügbar",error);}
   }
   drawScreens();onStatus({...status(),message:"Gespeicherter Spielstand geladen"});
  return true;
 }
 const api={start,dispose,interact,toggleDoor,stamp,sitDesk,leaveDesk,routeTo,planStreetRoute,routeStatus,clearRoute,listStreets:()=>streetDestinations.map(x=>x.name),status,setDispatchSummary,setPaused,setGraphicsProfile,setInputProfile,saveWorld,restoreWorld,life,walker,car,scene,camera,renderer,getShift:()=>worldUpgrade?.shift(),getShiftJournal:()=>journal?{...journal.snapshot(),format:journal.format,summarize:journal.summarize}:null,reconcileShiftJournal:()=>journal?.reconcile(status()),recordDispatchEvent:event=>journal?.recordEvent(event)||false};
 return api;
}
root.LDOpenWorldRuntime=Object.freeze({create});
})(typeof window!=="undefined"?window:globalThis);
