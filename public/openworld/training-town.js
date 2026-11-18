/* FUNKSPRUCH – begehbare Offline-Trainingsstadt.
 * Ausschließlich fiktive Straßen und Gebäude, deutlich von echten OSM-Daten getrennt.
 * Realistische Karten können weiterhin unabhängig über Overpass geladen werden.
 */
(function(root){"use strict";
function create({origin,extent=360,step=90}={}){
 if(!origin||!Number.isFinite(origin.lon)||!Number.isFinite(origin.lat))throw Error("Trainingskarte benötigt einen geografischen Ursprung");
 if(!Number.isFinite(extent)||extent<180||extent>600||!Number.isFinite(step)||step<60||step>150)throw Error("Ungültige Stadtgröße");
 const geo=root.LDOpenWorldGeo;
 if(!geo?.unproject)throw Error("Geokonverter fehlt");
 const count=Math.floor(extent/step),ticks=Array.from({length:count*2+1},(_,i)=>(i-count)*step);
 const features=[];
 const coordinates=(x,z)=>{const p=geo.unproject(x,z,origin);return [p.lon,p.lat];};
 function street(points,name,type="residential"){
  features.push({type:"Feature",properties:{highway:type,name,maxspeed:type==="living_street"?"20":"30",synthetic:true},geometry:{type:"LineString",coordinates:points.map(p=>coordinates(p[0],p[1]))}});
 }
 // Erste Straße führt direkt am fiktiven Leitstellengebäude entlang.
 street([[0,0],...ticks.filter(x=>x<0).reverse().map(x=>[x,0])],"Leitstellenstraße");
 street([[0,0],...ticks.filter(x=>x>0).map(x=>[x,0])],"Leitstellenstraße");
 for(const z of ticks){
  if(z===0)continue;
  street(ticks.map(x=>[x,z]),"Ringstraße "+Math.round((z+extent)/step+1),z%180===0?"residential":"living_street");
 }
 for(const x of ticks){
  street(ticks.map(z=>[x,z]),"Querstraße "+Math.round((x+extent)/step+1));
 }
 // Blockweise Häuser, um die Zentrale eine freie Zufahrt und einen Hof.
 function rectangle(x,z,width,depth,levels,type){
  const left=x-width/2,right=x+width/2,top=z-depth/2,bottom=z+depth/2;
  const points=[[left,top],[right,top],[right,bottom],[left,bottom],[left,top]].map(p=>coordinates(p[0],p[1]));
  features.push({type:"Feature",properties:{building:type,"building:levels":String(levels),synthetic:true},geometry:{type:"Polygon",coordinates:[points]}});
 }
 for(let xi=0;xi<ticks.length-1;xi++)for(let zi=0;zi<ticks.length-1;zi++){
  const x0=ticks[xi],z0=ticks[zi],cx=x0+step/2,cz=z0+step/2;
  // Spielwelt-Zentrum für die Trainingsleitstelle und den Vorplatz freihalten.
  if(Math.abs(cx)<step&&Math.abs(cz)<step)continue;
  const seed=((xi*37+zi*53+11)%19);
  rectangle(x0+step*.27,z0+step*.34,16+seed%8,18+(seed*3)%9,1+seed%4,seed%8===0?"commercial":"yes");
  if((xi+zi)%3!==0)
   rectangle(x0+step*.70,z0+step*.69,17+(seed*7)%9,17+(seed*5)%8,1+(seed+2)%3,"yes");
 }
 return {type:"FeatureCollection",features,metadata:{
  source:"Fiktive Trainingsstadt",real:false,attribution:"Fiktive Spielgeometrie – keine realen Straßen oder Gebäude",
  squareMeters:(extent*2)**2
 }};
}
root.LDFunkspruchTrainingTown=Object.freeze({create});
})(typeof window!=="undefined"?window:globalThis);
