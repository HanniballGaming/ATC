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
  // Trennwände und zentrale Leitstellenarbeitsplätze
  rectangle(-3.3,1.5,.12,5.3),
  rectangle(3.3,1.5,.12,5.3),
  rectangle(1,-2,3.8,1.1),
  rectangle(1,-.7,.7,.65),
  // Seitliche Tische: Eingänge am Nord- und Südende bleiben passierbar
  rectangle(-5.6,-2.3,1.5,.85),
  rectangle(-3.8,-2.3,1.5,.85),
  rectangle(3.8,-2.3,1.5,.85),
  rectangle(5.6,-2.3,1.5,.85),
  // Pausenzone, Automat, Serverraum und Schränke
  rectangle(-5.3,2.65,1.8,1.1),
  rectangle(-7.2,1.9,.72,.65),
  rectangle(7.4,-3.4,.65,1),
  ...[-6,-3.8,-1.6,4.5,6.5].map(x=>rectangle(x,3.9,.9,.8))
 ]};
}
root.LDFunkspruchIndoor=Object.freeze({rectangle,model});
})(typeof window!=="undefined"?window:globalThis);
