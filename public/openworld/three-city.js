/* LEITSTELLE DEUTSCHLAND: optional Three.js city mesh renderer.
 * Requires THREE and LDOpenWorldGeo. No automatic DOM changes.
 * Usage: const view = LDOpenWorldRenderer.create(THREE, scene);
 *        view.setModel(LDOpenWorldGeo.loadGeoJSON(featureCollection, origin));
 *        view.update(player.position.x, player.position.z); view.dispose();
 */
(function(root){"use strict";
// Fahrbahnbreite: tatsächliche OSM-width-Angaben bevorzugen, andernfalls
// als Schätzwert anhand der OSM-Straßenklasse ableiten (kein amtlicher Messwert).
function roadWidth(properties={},fallback=5){
 const raw=String(properties.width||"").replace(",",".").match(/^\s*(\d+(?:\.\d+)?)/);
 if(raw){
  const measured=Number(raw[1]);
  if(measured>=.5&&measured<=35)return measured;
 }
 const highway=properties.highway;
 const defaults={
  motorway:11,trunk:10,primary:8,secondary:7.4,tertiary:6.5,
  residential:5.3,living_street:4.5,unclassified:5.3,service:3.5,
  motorway_link:5,trunk_link:4.8,primary_link:4.5,secondary_link:4.3,
  pedestrian:4,footway:1.8,cycleway:2,steps:1.4,path:2,track:3
 };
 const lanes=Number.parseInt(properties.lanes,10);
 if(Number.isInteger(lanes)&&lanes>=1&&lanes<=6&&
  !["footway","cycleway","path","steps","track","pedestrian"].includes(highway))
  return Math.max(3,Math.min(30,lanes*3.1+.65));
 return defaults[highway]||fallback;
}
const roadWidthByClass=roadWidth;
// OSM gibt Höhen als Meter oder gelegentlich in Fuß an. Nur aus Tags
// abgeleitete Höhen verwenden; fehlen Tags, bleibt der Wert eine Schätzung.
function readMeters(value){
 const text=String(value??"").trim().replace(",",".");
 const hit=text.match(/^(\d+(?:\.\d+)?)\s*(m|meter|metres?|ft|feet|foot|'|cm)?$/i);
 if(!hit)return null;
 let m=Number(hit[1]),unit=(hit[2]||"m").toLowerCase();
 if(unit==="ft"||unit==="feet"||unit==="foot"||unit==="'")m*=.3048;
 else if(unit==="cm")m/=100;
 return Number.isFinite(m)&&m>=0&&m<500?m:null;
}
function buildingHeight(props={},fallback=9){
 const tagged=readMeters(props.height);
 if(tagged!==null&&tagged>.25)return tagged;
 const levels=Number(String(props["building:levels"]||"").replace(",","."));
 if(Number.isFinite(levels)&&levels>0&&levels<150)return levels*3;
 return fallback;
}
function buildingBaseHeight(props={}){
 const tagged=readMeters(props.min_height);
 if(tagged!==null)return tagged;
 const levels=Number(String(props["building:min_level"]||"").replace(",","."));
 return Number.isFinite(levels)&&levels>=0&&levels<150?levels*3:0;
}
function create(THREE,scene,options={}){
 if(!THREE||!scene)throw Error("THREE and scene required");
 const tileSize=options.tileSize||256;let radius=options.radius??2;
 const roadWidth=options.roadWidth||5, defaultHeight=options.defaultBuildingHeight||9;
 const roadWidthFor=roadWidthByClass;
 const roadMat=new THREE.MeshStandardMaterial({color:0x404953,roughness:1,side:THREE.DoubleSide});
 const footMat=new THREE.MeshStandardMaterial({color:0x91918b,roughness:1,side:THREE.DoubleSide});
 const bikeMat=new THREE.MeshStandardMaterial({color:0x785b50,roughness:1,side:THREE.DoubleSide});
 const gravelMat=new THREE.MeshStandardMaterial({color:0x777367,roughness:1,side:THREE.DoubleSide});
 const wallMat=new THREE.MeshStandardMaterial({color:0xa6a9a4,roughness:0.9});
 const roofMat=new THREE.MeshStandardMaterial({color:0x555c61,roughness:1});
 let model=null,tiles=null,active=new Map();
 function height(props){return buildingHeight(props,defaultHeight);}
 function ringShape(ring){
  if(ring.length<3)return null;
  const s=new THREE.Shape();s.moveTo(ring[0].x,-ring[0].z);
  for(let i=1;i<ring.length;i++)s.lineTo(ring[i].x,-ring[i].z);
  s.closePath();return s;
 }
 function makeBuilding(item){
  const outer=ringShape(item.rings[0]);if(!outer)return null;
  for(const hole of item.rings.slice(1)){if(hole.length<3)continue;
   const path=new THREE.Path();path.moveTo(hole[0].x,-hole[0].z);
   for(let i=1;i<hole.length;i++)path.lineTo(hole[i].x,-hole[i].z);
   path.closePath();outer.holes.push(path);
  }
  const totalHeight=height(item.properties),baseHeight=Math.min(Math.max(0,buildingBaseHeight(item.properties)),totalHeight-.3);
  const geom=new THREE.ExtrudeGeometry(outer,{depth:Math.max(.3,totalHeight-baseHeight),bevelEnabled:false,steps:1});
  // Shape lies in XY; extrude local Z into world Y, local Y becomes world -Z.
  geom.rotateX(-Math.PI/2);
  const mesh=new THREE.Mesh(geom,[roofMat,wallMat]);mesh.position.y=baseHeight;mesh.receiveShadow=true;return mesh;
 }
 function makeRoad(item){
  const points=item.points;if(points.length<2)return null;
  const props=item.properties||{},kind=props.highway||"",width=roadWidthFor(props,roadWidth);
  const verts=[],indices=[],half=width/2;
  for(let i=0;i<points.length;i++){
   const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
   const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1;
   const nx=-dz/len*half,nz=dx/len*half,p=points[i];
   verts.push(p.x+nx,0.025,p.z+nz,p.x-nx,0.025,p.z-nz);
   if(i){const j=i*2;indices.push(j-2,j-1,j,j-1,j+1,j);}
  }
  const geom=new THREE.BufferGeometry();
  geom.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
  geom.setIndex(indices);geom.computeVertexNormals();
  const mat=kind==="footway"||kind==="pedestrian"||kind==="steps"?footMat:
    kind==="cycleway"?bikeMat:
    kind==="track"||props.surface==="gravel"||props.surface==="unpaved"?gravelMat:roadMat;
  const mesh=new THREE.Mesh(geom,mat);
  mesh.userData.osmStreetName=typeof props.name==="string"?props.name:"";
  mesh.userData.osmRoadClass=kind;
  mesh.userData.roadWidthMeters=width;
  return mesh;
 }
 const featureMeshes=new Map();
 function clear(){
  for(const mesh of featureMeshes.values()){
   scene.remove(mesh);
   if(mesh.geometry)mesh.geometry.dispose();
  }
  featureMeshes.clear();active.clear();
 }
 function setModel(next){clear();model=next;tiles=root.LDOpenWorldGeo.tilesFor(next,tileSize);}
 function update(x,z){
  if(!tiles)return;
  const wanted=root.LDOpenWorldGeo.nearbyTiles(tiles,x,z,radius,tileSize);
  const visible=new Set();
  for(const tile of wanted){
   for(const item of tile.roads)visible.add(item);
   for(const item of tile.buildings)visible.add(item);
  }
  for(const [item,mesh] of featureMeshes){
   if(!visible.has(item)){scene.remove(mesh);mesh.geometry.dispose();featureMeshes.delete(item);}
  }
  for(const item of visible){
   if(featureMeshes.has(item))continue;
   const mesh=item.type==="road"?makeRoad(item):makeBuilding(item);
   if(mesh){scene.add(mesh);featureMeshes.set(item,mesh);}
  }
  active.clear();
  for(const tile of wanted)active.set(tile.key,true);
 }
 function dispose(){clear();roadMat.dispose();footMat.dispose();bikeMat.dispose();gravelMat.dispose();wallMat.dispose();roofMat.dispose();model=null;tiles=null;}
 return {setModel,update,dispose,
  setRadius(next){if(!Number.isInteger(next)||next<1||next>5)throw Error("Ungültiger Sichtradius");radius=next;},
  get loadedTiles(){return active.size;}
 };
}
root.LDOpenWorldRenderer=Object.freeze({create,roadWidth,readMeters,buildingHeight,buildingBaseHeight});
})(typeof window!=="undefined"?window:globalThis);
