/* FUNKSPRUCH – deterministic adaptive rendering budget for older laptops and tablets. */
(function(root){"use strict";
function create({windowSeconds=6,minFps=28,maxFps=54,slowWindows=2,fastWindows=3}={}){
 let elapsed=0,frames=0,weak=0,strong=0,low=false,fps=null;
 function reset(initialLow=false){elapsed=0;frames=0;weak=0;strong=0;low=!!initialLow;fps=null;}
 function sample(dt,active=true){
  if(!active||!Number.isFinite(dt)||dt<=0||dt>.6)return null;
  elapsed+=dt;frames++;
  if(elapsed<windowSeconds)return null;
  fps=frames/elapsed;elapsed=0;frames=0;
  if(fps<minFps){weak++;strong=0;}
  else if(fps>maxFps){strong++;weak=0;}
  else{weak=0;strong=0;}
  if(weak>=slowWindows&&!low){low=true;weak=0;strong=0;return true;}
  if(strong>=fastWindows&&low){low=false;weak=0;strong=0;return false;}
  return null;
 }
 return {reset,sample,stats:()=>({fps:fps===null?null:Math.round(fps),low})};
}
root.LDFunkspruchPerformance=Object.freeze({create});
})(typeof window!=="undefined"?window:globalThis);
