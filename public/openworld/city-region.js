/* FUNKSPRUCH – echte Augsburger OSM-Region, ohne synthetische Wege. */
(function(root){"use strict";
const tiles=Object.freeze([
 Object.freeze({id:"suedwest",bounds:{south:48.364,west:10.888,north:48.3705,east:10.8985},bundledUrl:"./data/augsburg-suedwest.geojson"}),
 Object.freeze({id:"suedost",bounds:{south:48.364,west:10.8985,north:48.3705,east:10.909},bundledUrl:"./data/augsburg-suedost.geojson"}),
 Object.freeze({id:"nordwest",bounds:{south:48.3705,west:10.888,north:48.377,east:10.8985},bundledUrl:"./data/augsburg-nordwest.geojson"}),
 Object.freeze({id:"nordost",bounds:{south:48.3705,west:10.8985,north:48.377,east:10.909},bundledUrl:"./data/augsburg-nordost.geojson"})
]);
root.LDFunkspruchRegion=Object.freeze({id:"augsburg",label:"Augsburg",origin:{lon:10.8985,lat:48.3705},tiles});
})(typeof window!=="undefined"?window:globalThis);
