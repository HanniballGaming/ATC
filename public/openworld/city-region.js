/* FUNKSPRUCH – expandable ILS city catalog.
 * Official Bavarian ILS city names, not claimed to be precise office addresses.
 * Coordinates are approximate playable city-center origins (not ILS buildings).
 * A city is NEVER represented as fully covered until its real OSM data are loaded.
 * Sources: https://www.bayernportal.de/ ; https://www.notruf112.bayern.de/ils/
 */
(function(root){"use strict";
const TILES_AUGSBURG=Object.freeze([
 {id:"suedwest",bounds:{south:48.364,west:10.888,north:48.3705,east:10.8985},bundledUrl:"./data/augsburg-suedwest.geojson"},
 {id:"suedost",bounds:{south:48.364,west:10.8985,north:48.3705,east:10.909},bundledUrl:"./data/augsburg-suedost.geojson"},
 {id:"nordwest",bounds:{south:48.3705,west:10.888,north:48.377,east:10.8985},bundledUrl:"./data/augsburg-nordwest.geojson"},
 {id:"nordost",bounds:{south:48.3705,west:10.8985,north:48.377,east:10.909},bundledUrl:"./data/augsburg-nordost.geojson"}
].map(t=>Object.freeze(t)));
function cityTiles(id,lon,lat){
 const halfLat=.0065,halfLon=.0105,steps=["suedwest","suedost","nordwest","nordost"];
 return Object.freeze(steps.map((name,i)=>{
  const row=i>=2?1:0,col=i%2;
  const south=lat-halfLat+row*halfLat,west=lon-halfLon+col*halfLon;
  return Object.freeze({id:name,bounds:{south,west,north:south+halfLat,east:west+halfLon},bundledUrl:null});
 }));
}
const cities=Object.freeze([
 {id:"augsburg",label:"ILS Augsburg",city:"Augsburg",state:"Bayern",origin:{lon:10.8985,lat:48.3705},tiles:TILES_AUGSBURG,offline:true},
 {id:"muenchen",label:"ILS München",city:"München",state:"Bayern",origin:{lon:11.5755,lat:48.1375},tiles:cityTiles("muenchen",11.5755,48.1375),offline:false},
 {id:"nuernberg",label:"ILS Nürnberg",city:"Nürnberg",state:"Bayern",origin:{lon:11.0767,lat:49.4521},tiles:cityTiles("nuernberg",11.0767,49.4521),offline:false},
 {id:"regensburg",label:"ILS Regensburg",city:"Regensburg",state:"Bayern",origin:{lon:12.0967,lat:49.0179},tiles:cityTiles("regensburg",12.0967,49.0179),offline:false},
 {id:"ingolstadt",label:"ILS Region Ingolstadt",city:"Ingolstadt",state:"Bayern",origin:{lon:11.4289,lat:48.7665},tiles:cityTiles("ingolstadt",11.4289,48.7665),offline:false}
].map(c=>Object.freeze(c)));
const byId=Object.freeze(Object.fromEntries(cities.map(c=>[c.id,c])));
const SELECTED_KEY="funkspruch-ils-city-v1";
function get(id){return byId[id]||byId.augsburg;}
function list(){return cities.slice();}
function selected(storage=root.localStorage){
 try{return get(storage?.getItem(SELECTED_KEY));}catch{return get("augsburg");}
}
function setSelected(id,storage=root.localStorage){
 if(!Object.prototype.hasOwnProperty.call(byId,id))throw Error("Dieser ILS-Standort ist nicht im 3D-Städtekatalog verfügbar");
 storage?.setItem(SELECTED_KEY,id);
 return get(id);
}
root.LDFunkspruchRegion=Object.freeze({
 id:"augsburg",label:"Augsburg",origin:byId.augsburg.origin,tiles:byId.augsburg.tiles,
 locations:cities,get,list,selected,setSelected,selectedKey:SELECTED_KEY
});
})(typeof window!=="undefined"?window:globalThis);
