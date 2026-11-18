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
function install({THREE,scene,camera,life,onMessage=()=>{}}){
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
 }
 function addOutdoor(){
  const g=new THREE.Group();scene.add(g);owned.push(g);
  // Street props stay outside the office and use inexpensive primitive geometry.
  for(let i=-4;i<=4;i++){
   const z=i*18;
   box(g,"Straßenlaterne",12,2.5,z,.15,5,.15,0x69777c);
   box(g,"Leuchtkopf",11.65,4.96,z,.8,.15,.3,0xffedbb);
   if(i%2===0){box(g,"Baumstamm",-12,1.25,z,.42,2.5,.42,0x6a4c35);
    const tree=new THREE.Mesh(new THREE.ConeGeometry(1.9,4,7),material(0x346d43));tree.position.set(-12,4,z);g.add(tree);owned.push(tree);}
  }
  for(let i=0;i<7;i++){
   const z=-55+i*17;
   box(g,"Parkendes Fahrzeug",18,.8,z,1.75,1.2,3.5,i%2?0x475b6b:0x9eaaa9);
  }
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
root.LDFunkspruchWorld=Object.freeze({install,colleagueResponse,daylight});
})(typeof window!=="undefined"?window:globalThis);
