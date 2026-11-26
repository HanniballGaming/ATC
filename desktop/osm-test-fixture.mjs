/* TEST-ONLY: synthetic Overpass server fixture for automated UI tests.
 * Deliberately not part of the shipped game or desktop/web assets.
 * Real players get OSM exclusively: no mocked city data in production.
 */
export function osmResponse(center={lon:10.8985,lat:48.3705},idOffset=0){
 const nodes=[],ways=[],lookup=new Map();
 let nodeId=1+idOffset,wayId=10000+idOffset;
 function node(lon,lat){
  const key=lon.toFixed(7)+":"+lat.toFixed(7);
  if(lookup.has(key))return lookup.get(key);
  const id=nodeId++;
  nodes.push({type:"node",id,lon,lat});lookup.set(key,id);return id;
 }
 function way(coords,tags){
  ways.push({type:"way",id:wayId++,nodes:coords.map(([lon,lat])=>node(lon,lat)),tags});
 }

 for(let i=-4;i<=4;i++){
  const lon=center.lon+i*.00075;
  way(Array.from({length:9},(_,j)=>[lon,center.lat+(j-4)*.0005]),{highway:"residential",name:"TEST: Querstraße"});
 }
 for(let i=-4;i<=4;i++){
  const lat=center.lat+i*.0005;
  way(Array.from({length:9},(_,j)=>[center.lon+(j-4)*.00075,lat]),{highway:"residential",name:"TEST: Längsstraße"});
 }
 for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++){
  const lon=center.lon+(i+.3)*.00075,lat=center.lat+(j+.3)*.0005;
  const x=.00020,y=.00013;
  way([[lon,lat],[lon+x,lat],[lon+x,lat+y],[lon,lat+y],[lon,lat]],{building:"yes","building:levels":"3"});
 }
 return {version:0.6,generator:"Automatisierter UI-Test – NICHT echte OSM-Daten",elements:[...nodes,...ways]};
}
export function mockOsmRoute(route){
 if(route.request().url().startsWith("https://overpass.private.coffee/api/interpreter"))
  return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(osmResponse())});
 return route.abort();
}

/* City-switch acceptance only: generates isolated synthetic Overpass responses
 * for the requested test tile. Never shipped as real OpenStreetMap geography. */
export function mockCityOsmRoute(route){
 const url=route.request().url();
 if(!url.startsWith("https://overpass.private.coffee/api/interpreter"))return route.abort();
 const query=new URLSearchParams(route.request().postData()||"").get("data")||"";
 const match=query.match(/\((-?[0-9.]+),(-?[0-9.]+),(-?[0-9.]+),(-?[0-9.]+)\)/);
 if(!match)throw Error("Overpass-Kachelkoordinaten fehlen im Browser-Test");
 const [,south,west,north,east]=match.map(Number);
 const center={lon:(west+east)/2,lat:(south+north)/2};
 const idOffset=Math.abs(Math.round(center.lat*100000))*100000+Math.abs(Math.round(center.lon*100000));
 return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(osmResponse(center,idOffset))});
}
