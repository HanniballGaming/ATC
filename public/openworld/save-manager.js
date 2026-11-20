/* FUNKSPRUCH – exportierbare lokale Spielstände für 3D-Welt und Einsatzleitsystem. */
(function(root){"use strict";
const FORMAT="FUNKSPRUCH-SPEICHERSTAND-1",MAX=5_000_000;
const accepted=k=>/^(ld|leitstelle|funkspruch)[\w.:/-]*$/i.test(k)&&!k.startsWith("funkspruch-osm-cache");
function capture(storage=root.localStorage){
 const entries=Object.create(null);let chars=0;
 for(let i=0;i<storage.length;i++){
  const name=storage.key(i);
  if(typeof name!=="string"||!accepted(name))continue;
  const value=storage.getItem(name);
  if(typeof value!=="string")continue;
  chars+=name.length+value.length;
  if(chars>MAX)throw Error("Der Spielstand ist für den Export zu groß.");
  entries[name]=value;
 }
 return {format:FORMAT,erstellt:new Date().toISOString(),entries};
}
function validate(data){
 if(!data||data.format!==FORMAT||!data.entries||Array.isArray(data.entries)||typeof data.entries!=="object")
  throw Error("Diese Datei ist kein gültiger FUNKSPRUCH-Spielstand.");
 const items=Object.entries(data.entries);
 if(items.length>400)throw Error("Die Sicherungsdatei enthält zu viele Einträge.");
 let length=0;
 for(const [name,value] of items){
  if(!accepted(name)||name.length>150||typeof value!=="string")throw Error("Die Sicherungsdatei enthält ungültige Speicherwerte.");
  length+=name.length+value.length;
  if(length>MAX)throw Error("Die Sicherungsdatei ist zu groß.");
 }
 return items;
}
function restore(data,storage=root.localStorage){
 const items=validate(data);
 // Import replaces the complete saved game, rather than mixing two different
 // shifts and dispatch states. OSM caches and unrelated app data remain intact.
 const existing=[];
 for(let i=0;i<storage.length;i++){const key=storage.key(i);if(typeof key==="string"&&accepted(key))existing.push(key);}
 const before=new Map(existing.map(key=>[key,storage.getItem(key)]));
 const incoming=new Map(items);
 try{
  for(const key of existing)if(!incoming.has(key))storage.removeItem(key);
  for(const [key,value] of incoming)storage.setItem(key,value);
 }catch(error){
  // Restore all previously saved keys, including ones deleted during import.
  for(const key of incoming.keys())if(!before.has(key))try{storage.removeItem(key);}catch{}
  for(const [key,value] of before)try{storage.setItem(key,value);}catch{}
  throw Error("Spielstand konnte nicht importiert werden: "+(error.message||error));
 }
 return items.length;
}
function download(data,doc=root.document){
 const payload=JSON.stringify(data,null,2);
 if(payload.length>MAX+30000)throw Error("Spielstand zu groß.");
 const blob=new Blob([payload],{type:"application/json;charset=utf-8"});
 const url=root.URL.createObjectURL(blob);
 const a=doc.createElement("a");
 a.href=url;a.download="FUNKSPRUCH-Spielstand.json";
 doc.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>root.URL.revokeObjectURL(url),3000);
}
root.LDFunkspruchSave=Object.freeze({capture,validate,restore,download,format:FORMAT});
})(typeof window!=="undefined"?window:globalThis);
