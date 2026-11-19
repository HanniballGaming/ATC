/* FUNKSPRUCH open-world extensions: modular, no external assets. */
(function(root){"use strict";
function daylight(minutes){
 if(!Number.isFinite(minutes))return 0;
 const normalized=((minutes%1440)+1440)%1440;
 return Math.max(0,Math.sin((normalized-360)*Math.PI/720));
}
function colleagueResponse(name,summary,onDuty){
 const who=name||"Kollege";
 if(!onDuty)return who+": Guten Tag. Melden Sie sich bitte erst zum Dienst an.";
 if(!summary)return who+": Die Einsatzlage ist noch nicht mit dem Leitplatz verbunden. Prüfen Sie die Lageübersicht am Bildschirm.";
 if(summary.waiting>0)return who+": Wir haben "+summary.waiting+" wartende "+(summary.waiting===1?"Notruf":"Notrufe")+". Bitte übernehmen Sie einen im Telefonmonitor.";
 if(summary.open>0)return who+": Derzeit laufen "+summary.open+" "+(summary.open===1?"Einsatz":"Einsätze")+". Von "+summary.total+" Einsatzmitteln sind "+summary.free+" frei. Prüfen Sie die offenen Vorgänge.";
 return who+": Die aktuelle Lage ist ruhig. "+summary.free+" von "+summary.total+" Fahrzeugen sind einsatzbereit.";
}
function streetFurnitureSpots(model,{limit=16,radius=420,exclude=null}={}){
 const spots=[];
 for(const road of model?.roads||[]){
  const p=road.properties||{},pts=road.points||[];
  if(!["residential","tertiary","secondary","primary","living_street","unclassified"].includes(p.highway))continue;
  if(p.area==="yes"||pts.length<2)continue;
  for(let i=1;i<pts.length;i++){
   const a=pts[i-1],b=pts[i],dx=b.x-a.x,dz=b.z-a.z,meters=Math.hypot(dx,dz);
   if(!Number.isFinite(meters)||meters<8)continue;
   const half=(root.LDOpenWorldRenderer?.roadWidth?.(p)||5)/2+1.4;
   const side=(i+spots.length)%2?1:-1;
   const point={x:(a.x+b.x)/2-side*dz/meters*half,z:(a.z+b.z)/2+side*dx/meters*half};
   if(Math.hypot(point.x,point.z)>radius)continue;
   if(exclude&&Math.hypot(point.x-exclude.x,point.z-exclude.z)<24)continue;
   if(spots.some(v=>Math.hypot(v.x-point.x,v.z-point.z)<23))continue;
   if(root.LDOpenWorldCollision?.collides(point,model,.5))continue;
   spots.push(point);
   if(spots.length>=limit)return spots;
  }
 }
 return spots;
}
function install({THREE,scene,camera,life,model,stationPosition,onMessage=()=>{}}){
 const owned=[],actors=[],interactables=[];let elapsed=0,shiftSeconds=0,ambientPhase=0,dispatchSummary=null;
 const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.78,...extra});
 function box(parent,name,x,y,z,w,h,d,color){
  const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color));o.position.set(x,y,z);o.name=name;parent.add(o);owned.push(o);return o;
 }
 function light(parent,x,y,z,color,intensity,range){const o=new THREE.PointLight(color,intensity,range,2);o.position.set(x,y,z);parent.add(o);owned.push(o);return o;}
 function addIndoor(group){
  // Room dividers, hallway, accessible work zones and realistic furniture.
  for(const x of [-3.3,3.3]){box(group,"Flurtrennwand",x,1.7,1.5,.12,3.3,5.3,0x637584);}
  for(const x of [-5.6,-3.8,3.8,5.6]){
   box(group,"Disponententisch",x,1.06,-2.3,1.5,.14,.9,0x42586a);
   box(group,"Bürostuhl",x,.5,-.8,.68,.2,.65,0x1e3447);
   box(group,"Stuhllehne",x,.91,-.49,.68,.8,.13,0x233c4e);
   box(group,"Monitor",x,1.52,-2.4,.78,.55,.08,0x0d1c2c);
   box(group,"Bildschirm",x,1.52,-2.347,.68,.45,.012,0x1b7994);
   box(group,"Telefon",x+.48,1.19,-1.97,.22,.08,.16,0x152a39);
  }
  box(group,"Pausentisch",-5.3,.72,2.65,1.8,.12,1.1,0x637480);
  box(group,"Getränkeautomat",-7.2,1.05,1.9,.7,2.1,.65,0x23566b);
  box(group,"Dienstplan",4.8,1.85,5.84,2,.95,.06,0x213d51);
  box(group,"Funkserver",7.4,1.5,-3.4,.65,2.5,1,0x253b49);
  for(let i=0;i<5;i++)box(group,"Statusanzeige",7.02,.7+i*.34,-2.97,.04,.08,.1,0x31a8a1);
  light(group,-4,2.9,-2,0xd6efff,.6,9);light(group,4,2.9,-2,0xd6efff,.6,9);
  const positions=[[-5.6,-.8],[-3.8,-.8],[3.8,-.8],[5.6,-.8]];
  for(let i=0;i<positions.length;i++){
   const [x,z]=positions[i],person=new THREE.Group();person.position.set(x,0,z);
   box(person,"Körper",0,1.08,0,.44,.65,.3,i%2?0x244960:0x304c5b);
   box(person,"Kopf",0,1.55,0,.29,.32,.28,0xc59c81);
   box(person,"Beine",0,.58,0,.36,.5,.26,0x202b39);
   group.add(person);const name=["Kollegin Meyer","Kollege Weber","Kollegin Schulz","Kollege Braun"][i];actors.push({person,x,z,phase:i*1.6,name});interactables.push({id:"kollege"+i,kind:"colleague",label:name,x,z});
  }
  interactables.push({id:"funk",label:"Funkgerät",x:1,z:-1.2});
  interactables.push({id:"telefon",label:"Notruftelefon",x:1.7,z:-1.2});
  interactables.push({id:"dienstplan",label:"Dienstplan",x:4.8,z:4.8});
  interactables.push({id:"pause",label:"Pausenraum",x:-5.3,z:2.65});
  interactables.push({id:"automat",label:"Getränkeautomat",x:-7.1,z:1.9});
 }
 function addOutdoor(){
  const g=new THREE.Group();scene.add(g);owned.push(g);
  // Requisiten ausschließlich an echten OSM-Straßen, nie auf erfundenen
  // geraden Parkplatzreihen oder in kartierten Häusern.
  streetFurnitureSpots(model,{exclude:stationPosition}).forEach((p,i)=>{
   if(i%3===2){
    box(g,"Baumstamm",p.x,1.1,p.z,.35,2.2,.35,0x67503c);
    const tree=new THREE.Mesh(new THREE.ConeGeometry(1.5,3.3,7),material(0x365d40));
    tree.position.set(p.x,3.65,p.z);g.add(tree);owned.push(tree);
   }else{
    box(g,"Straßenlaterne",p.x,2.45,p.z,.14,4.9,.14,0x69777c);
    box(g,"Leuchtkopf",p.x,4.9,p.z,.63,.14,.28,0xffe7b2);
   }
  });
  return g;
 }
 const outdoor=addOutdoor();
 function update(dt,{indoor=false,onDuty=false}={}){
  elapsed+=dt;ambientPhase+=dt;
  if(onDuty)shiftSeconds+=dt;
  outdoor.visible=!indoor;
  if(indoor)for(const a of actors){
   // Subtle idle movements, deterministic and low cost.
   a.person.rotation.y=Math.sin(elapsed*.23+a.phase)*.13;
   a.person.position.y=Math.sin(elapsed*1.1+a.phase)*.012;
  }
 }
 function nearest(p,maxDistance=2){
  let closest=null,distance=maxDistance;
  for(const obj of interactables){const d=Math.hypot(obj.x-p.x,obj.z-p.z);if(d<distance){distance=d;closest=obj;}}
  return closest;
 }
 function interact(p){
  const obj=nearest(p);if(!obj)return false;
  if(obj.id==="pause"||obj.id==="automat"){
   try{
    const before=life.snapshot(),action=obj.id==="pause"?"ruhepause":"trinken";
    if(obj.id==="automat"&&!before.onDuty)throw Error("Bitte vor dem Dienst zuerst einstempeln.");
    life.action(action);
    try{life.save();}catch(error){console.warn("Dienststand konnte nicht gespeichert werden",error);}
    onMessage(obj.id==="pause"?"10 Minuten Dienstpause beendet – Müdigkeit verringert.":"Getränk geholt – Durst verringert, 1 € bezahlt.");
   }catch(error){onMessage(error.message||"Diese Aktion ist hier nicht verfügbar.");}
   return true;
  }
  if(obj.kind==="colleague"){
   const message=colleagueResponse(obj.label,dispatchSummary,life.snapshot().onDuty);
   onMessage(message);
   const voice=root.speechSynthesis;
   if(root.document?.getElementById("voiceEnabled")?.checked&&voice&&typeof root.SpeechSynthesisUtterance==="function"){
    try{
     voice.cancel();
     const utterance=new root.SpeechSynthesisUtterance(message.replace(/^.*?: /,""));
     utterance.lang="de-DE";utterance.rate=1.02;utterance.pitch=.98;utterance.volume=.75;
     voice.speak(utterance);
    }catch(e){console.warn("Kollegenstimme nicht verfügbar",e);}
   }
   return true;
  }
  const messages={funk:"Funkgerät: Am Arbeitsplatz ist der Funkverkehr verfügbar.",telefon:"Notruftelefon: Am Arbeitsplatz können Sie Notrufe annehmen.",dienstplan:"Dienstplan: "+(life.snapshot().onDuty?"Dienst läuft":"Noch nicht eingestempelt")+".",pause:"Pausenraum: Hier können Sie sich während der Schicht erholen."};
  onMessage(messages[obj.id]);return true;
 }
 function shift(){return {onDuty:!!life.snapshot().onDuty,seconds:Math.floor(shiftSeconds),colleagues:actors.map(a=>a.name)};}
 function dispose(){for(const o of owned.reverse()){o.parent?.remove(o);o.geometry?.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}}}
 return {addIndoor,update,nearest,interact,shift,dispose,setDispatchSummary(s){dispatchSummary=s&&Number.isInteger(s.open)&&Number.isInteger(s.waiting)?{...s}:null;}};
}
root.LDFunkspruchWorld=Object.freeze({install,colleagueResponse,daylight,streetFurnitureSpots});
})(typeof window!=="undefined"?window:globalThis);
