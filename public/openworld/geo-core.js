/* LEITSTELLE DEUTSCHLAND – Open World geodata core (independent module).
 * Input: GeoJSON FeatureCollection in WGS84. Coordinates in meters, no fake roads.
 * The module never touches the dispatch simulator or existing DOM.
 */
(function(global){
  "use strict";
  const R=6378137, DEG=Math.PI/180;
  function project(lon,lat,origin){
    if(!Number.isFinite(lon)||!Number.isFinite(lat))throw Error("Invalid coordinate");
    const cos=Math.cos(origin.lat*DEG);
    return {x:R*(lon-origin.lon)*DEG*cos,z:-R*(lat-origin.lat)*DEG};
  }
  function unproject(x,z,origin){
    return {lon:origin.lon+x/(R*DEG*Math.cos(origin.lat*DEG)),lat:origin.lat-z/(R*DEG)};
  }
  function validOrigin(o){return o&&Number.isFinite(o.lon)&&Number.isFinite(o.lat)&&Math.abs(o.lat)<85;}
  function featureGeometry(f,origin){
    if(!f||!f.geometry)return null;
    const g=f.geometry,p=f.properties||{},type=g.type;
    const line=coords=>coords.map(c=>project(c[0],c[1],origin));
    if(type==="LineString")return {type:"road",points:line(g.coordinates),properties:p};
    if(type==="MultiLineString")return {type:"roads",parts:g.coordinates.map(line),properties:p};
    if(type==="Polygon")return {type:"building",rings:g.coordinates.map(line),properties:p};
    if(type==="MultiPolygon")return {type:"buildings",polygons:g.coordinates.map(poly=>poly.map(line)),properties:p};
    return null;
  }
  function loadGeoJSON(collection,origin){
    if(!validOrigin(origin))throw Error("A valid WGS84 origin is required");
    if(!collection||collection.type!=="FeatureCollection"||!Array.isArray(collection.features))throw Error("Expected GeoJSON FeatureCollection");
    const roads=[],buildings=[];
    for(const f of collection.features){
      const item=featureGeometry(f,origin);if(!item)continue;
      if(item.type==="road")roads.push(item);
      else if(item.type==="roads")for(const part of item.parts)roads.push({type:"road",points:part,properties:item.properties});
      else if(item.type==="building")buildings.push(item);
      else if(item.type==="buildings")for(const rings of item.polygons)buildings.push({type:"building",rings,properties:item.properties});
    }
    return {origin:{...origin},roads,buildings,metadata:{source:"GeoJSON",featureCount:collection.features.length,scaleMetersPerUnit:1}};
  }
  function tileKey(x,z,size=256){if(!Number.isFinite(size)||size<=0)throw Error("Invalid tile size");return Math.floor(x/size)+":"+Math.floor(z/size);}
  function tilesFor(model,size=256){
    if(!Number.isFinite(size)||size<=0)throw Error("Invalid tile size");
    const map=new Map();
    const add=(item,points,kind)=>{
      if(!points.length)return;
      let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
      for(const p of points){
        if(!Number.isFinite(p.x)||!Number.isFinite(p.z))continue;
        minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);
        minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);
      }
      if(!Number.isFinite(minX))return;
      const left=Math.floor(minX/size),right=Math.floor(maxX/size);
      const top=Math.floor(minZ/size),bottom=Math.floor(maxZ/size);
      // Prevent malicious/invalid geometries from generating millions of tiles.
      if((right-left+1)*(bottom-top+1)>4096)throw Error("Feature spans too many tiles");
      for(let x=left;x<=right;x++)for(let z=top;z<=bottom;z++){
        const key=x+":"+z;
        if(!map.has(key))map.set(key,{roads:[],buildings:[]});
        map.get(key)[kind].push(item);
      }
    };
    for(const road of model.roads)add(road,road.points,"roads");
    for(const building of model.buildings)add(building,building.rings.flat(),"buildings");
    return map;
  }
  function nearbyTiles(tiles,x,z,radius=2,size=256){
    const cx=Math.floor(x/size),cz=Math.floor(z/size),out=[];
    for(let i=-radius;i<=radius;i++)for(let j=-radius;j<=radius;j++){
      const key=(cx+i)+":"+(cz+j);if(tiles.has(key))out.push({key,...tiles.get(key)});
    }
    return out;
  }
  global.LDOpenWorldGeo=Object.freeze({project,unproject,loadGeoJSON,tileKey,tilesFor,nearbyTiles});
})(typeof window!=="undefined"?window:globalThis);
