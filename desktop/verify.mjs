/* Node-Tests für Quellcode, Oberfläche und Open-World-Kern. */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";
import assert from "node:assert/strict";
const base=path.join(path.dirname(fileURLToPath(import.meta.url)),"web");
const read=p=>fs.readFileSync(path.join(base,p),"utf8");
assert.match(read("index.html"),/funkspruch_embed\.js/);
assert.match(read("openworld/index.html"),/FUNKSPRUCH/);
assert.match(read("openworld/index.html"),/id="startNormal"/);
assert.match(read("openworld/index.html"),/disabled aria-disabled="true"/);
assert.match(read("openworld/arbeitsplatz.html"),/fs_embed=1/);
assert.match(read("openworld/index.html"),/\.\/vendor\/three\.min\.js/);
assert.ok(fs.statSync(path.join(base,"openworld","vendor","three.min.js")).size>100000);
const context={console,Math,Date,JSON,Map,Set,Array,Object,Number,String,Boolean,Promise,Intl,setTimeout,clearTimeout};
context.window=context;vm.createContext(context);
for(const file of ["geo-core.js","collision-core.js","vehicle-core.js","vehicle-interaction.js","walker-core.js","life-core.js","road-graph.js","osm-loader.js","integration-tests.js"])
 vm.runInContext(read("openworld/"+file),context,{filename:file,timeout:3000});
const result=await context.LDOpenWorldIntegrationTests.run();
if(result.passed!==result.total)throw Error("Open-World-Tests fehlgeschlagen: "+JSON.stringify(result.results.filter(x=>!x.ok)));
console.log("OK: "+result.passed+"/"+result.total+" Logiktests; Desktop-Paket und gesperrter zweiter Modus geprüft.");
