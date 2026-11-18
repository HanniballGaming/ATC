/* Fiktive, für die Spielmechanik definierte Leitstellen-Innenraumkollisionen. */
(function(root){"use strict";
function rectangle(x,z,width,depth){
 if(![x,z,width,depth].every(Number.isFinite)||width<=0||depth<=0)throw Error("Ungültiger Grundriss");
 const left=x-width/2,right=x+width/2,top=z-depth/2,bottom=z+depth/2;
 return {rings:[[{x:left,z:top},{x:right,z:top},{x:right,z:bottom},{x:left,z:bottom}]]};
}
function model(){
 // Zwei real vorhandene Trennwände begrenzen die Nebenräume.
 // Der Hauptgang bleibt vorne und hinten zu den Seitenbereichen begehbar.
 return {buildings:[
  rectangle(-3.3,1.5,.12,5.3),
  rectangle(3.3,1.5,.12,5.3)
 ]};
}
root.LDFunkspruchIndoor=Object.freeze({rectangle,model});
})(typeof window!=="undefined"?window:globalThis);
