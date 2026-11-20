/* FUNKSPRUCH – expandable ILS city catalog.
 * City-level training locations, not verified center names, buildings or jurisdiction polygons.
 * Coordinates are approximate playable city-center origins (not ILS buildings).
 * A city is NEVER represented as fully covered until its real OSM data are loaded.
 * Initial Bavaria ILS locations and selectable city-level training centers nationwide.
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
 {id:"ingolstadt",label:"ILS Region Ingolstadt",city:"Ingolstadt",state:"Bayern",origin:{lon:11.4289,lat:48.7665},tiles:cityTiles("ingolstadt",11.4289,48.7665),offline:false},
 {id:"berlin",label:"Leitstellenstadt Berlin",city:"Berlin",state:"Berlin",origin:{lon:13.405,lat:52.52},tiles:cityTiles("berlin",13.405,52.52),offline:false},
 {id:"hamburg",label:"Leitstellenstadt Hamburg",city:"Hamburg",state:"Hamburg",origin:{lon:9.9937,lat:53.5511},tiles:cityTiles("hamburg",9.9937,53.5511),offline:false},
 {id:"bremen",label:"Leitstellenstadt Bremen",city:"Bremen",state:"Bremen",origin:{lon:8.8017,lat:53.0793},tiles:cityTiles("bremen",8.8017,53.0793),offline:false},
 {id:"hannover",label:"Leitstellenstadt Hannover",city:"Hannover",state:"Niedersachsen",origin:{lon:9.732,lat:52.3759},tiles:cityTiles("hannover",9.732,52.3759),offline:false},
 {id:"kiel",label:"Leitstellenstadt Kiel",city:"Kiel",state:"Schleswig-Holstein",origin:{lon:10.1228,lat:54.3233},tiles:cityTiles("kiel",10.1228,54.3233),offline:false},
 {id:"rostock",label:"Leitstellenstadt Rostock",city:"Rostock",state:"Mecklenburg-Vorpommern",origin:{lon:12.1405,lat:54.0924},tiles:cityTiles("rostock",12.1405,54.0924),offline:false},
 {id:"potsdam",label:"Leitstellenstadt Potsdam",city:"Potsdam",state:"Brandenburg",origin:{lon:13.0645,lat:52.3906},tiles:cityTiles("potsdam",13.0645,52.3906),offline:false},
 {id:"koeln",label:"Leitstellenstadt Köln",city:"Köln",state:"Nordrhein-Westfalen",origin:{lon:6.9603,lat:50.9375},tiles:cityTiles("koeln",6.9603,50.9375),offline:false},
 {id:"duesseldorf",label:"Leitstellenstadt Düsseldorf",city:"Düsseldorf",state:"Nordrhein-Westfalen",origin:{lon:6.7735,lat:51.2277},tiles:cityTiles("duesseldorf",6.7735,51.2277),offline:false},
 {id:"dortmund",label:"Leitstellenstadt Dortmund",city:"Dortmund",state:"Nordrhein-Westfalen",origin:{lon:7.4653,lat:51.5136},tiles:cityTiles("dortmund",7.4653,51.5136),offline:false},
 {id:"frankfurt",label:"Leitstellenstadt Frankfurt am Main",city:"Frankfurt am Main",state:"Hessen",origin:{lon:8.6821,lat:50.1109},tiles:cityTiles("frankfurt",8.6821,50.1109),offline:false},
 {id:"mainz",label:"Leitstellenstadt Mainz",city:"Mainz",state:"Rheinland-Pfalz",origin:{lon:8.2473,lat:49.9929},tiles:cityTiles("mainz",8.2473,49.9929),offline:false},
 {id:"stuttgart",label:"Leitstellenstadt Stuttgart",city:"Stuttgart",state:"Baden-Württemberg",origin:{lon:9.1829,lat:48.7758},tiles:cityTiles("stuttgart",9.1829,48.7758),offline:false},
 {id:"freiburg",label:"Leitstellenstadt Freiburg im Breisgau",city:"Freiburg im Breisgau",state:"Baden-Württemberg",origin:{lon:7.8522,lat:47.999},tiles:cityTiles("freiburg",7.8522,47.999),offline:false},
 {id:"dresden",label:"Leitstellenstadt Dresden",city:"Dresden",state:"Sachsen",origin:{lon:13.7373,lat:51.0504},tiles:cityTiles("dresden",13.7373,51.0504),offline:false},
 {id:"leipzig",label:"Leitstellenstadt Leipzig",city:"Leipzig",state:"Sachsen",origin:{lon:12.3731,lat:51.3397},tiles:cityTiles("leipzig",12.3731,51.3397),offline:false},
 {id:"magdeburg",label:"Leitstellenstadt Magdeburg",city:"Magdeburg",state:"Sachsen-Anhalt",origin:{lon:11.6292,lat:52.1205},tiles:cityTiles("magdeburg",11.6292,52.1205),offline:false},
 {id:"erfurt",label:"Leitstellenstadt Erfurt",city:"Erfurt",state:"Thüringen",origin:{lon:11.0299,lat:50.9848},tiles:cityTiles("erfurt",11.0299,50.9848),offline:false},
 {id:"saarbruecken",label:"Leitstellenstadt Saarbrücken",city:"Saarbrücken",state:"Saarland",origin:{lon:7.0064,lat:49.2402},tiles:cityTiles("saarbruecken",7.0064,49.2402),offline:false},
 {id:"kassel",label:"Leitstellenstadt Kassel",city:"Kassel",state:"Hessen",origin:{lon:9.4797,lat:51.3127},tiles:cityTiles("kassel",9.4797,51.3127),offline:false},
 {id:"muenster",label:"Leitstellenstadt Münster",city:"Münster",state:"Nordrhein-Westfalen",origin:{lon:7.6261,lat:51.9607},tiles:cityTiles("muenster",7.6261,51.9607),offline:false},
 {id:"wuerzburg",label:"Leitstellenstadt Würzburg",city:"Würzburg",state:"Bayern",origin:{lon:9.936,lat:49.7913},tiles:cityTiles("wuerzburg",9.936,49.7913),offline:false},
 {id:"koblenz",label:"Leitstellenstadt Koblenz",city:"Koblenz",state:"Rheinland-Pfalz",origin:{lon:7.5889,lat:50.3569},tiles:cityTiles("koblenz",7.5889,50.3569),offline:false},
 {id:"karlsruhe",label:"Leitstellenstadt Karlsruhe",city:"Karlsruhe",state:"Baden-Württemberg",origin:{lon:8.4044,lat:49.0069},tiles:cityTiles("karlsruhe",8.4044,49.0069),offline:false}
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
