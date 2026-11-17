/* Touch input overlay for the Open World.
 * Creates controls only when mount() is explicitly called. Pointer events support iPad.
 */
(function(root){"use strict";
function mount(host,{onInteract=()=>{},onRun=()=>{}}={}){
 if(!host||!host.appendChild)throw Error("Container required");
 const doc=host.ownerDocument,container=doc.createElement("div");
 container.setAttribute("aria-label","Open-World-Touchsteuerung");
 Object.assign(container.style,{position:"absolute",inset:"0",pointerEvents:"none",zIndex:"30",touchAction:"none"});
 const state={forward:0,strafe:0,lookX:0,lookY:0,run:false};
 const active=new Map();
 function pad(side,label){
  const el=doc.createElement("div");el.setAttribute("aria-label",label);
  Object.assign(el.style,{position:"absolute",bottom:"22px",[side]:"20px",width:"132px",height:"132px",borderRadius:"50%",border:"2px solid #ffffff88",background:"#18252d55",pointerEvents:"auto",touchAction:"none"});
  container.appendChild(el);
  const center=()=>{const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};};
  el.addEventListener("pointerdown",e=>{e.preventDefault();el.setPointerCapture(e.pointerId);active.set(e.pointerId,{side,center:center(),x:e.clientX,y:e.clientY});});
  el.addEventListener("pointermove",e=>{const p=active.get(e.pointerId);if(!p)return;
   p.x=e.clientX;p.y=e.clientY;
   const dx=Math.max(-1,Math.min(1,(p.x-p.center.x)/55));
   const dy=Math.max(-1,Math.min(1,(p.y-p.center.y)/55));
   if(side==="left"){state.strafe=dx;state.forward=-dy;}
   else{state.lookX=dx*0.035;state.lookY=-dy*0.035;}
  });
  const stop=e=>{if(!active.has(e.pointerId))return;active.delete(e.pointerId);
   if(side==="left"){state.forward=0;state.strafe=0;}else{state.lookX=0;state.lookY=0;}
  };
  el.addEventListener("pointerup",stop);el.addEventListener("pointercancel",stop);el.addEventListener("lostpointercapture",stop);
 }
 function button(label,bottom,handler){
  const el=doc.createElement("button");el.type="button";el.textContent=label;
  Object.assign(el.style,{position:"absolute",right:"22px",bottom,padding:"12px 16px",borderRadius:"10px",background:"#1b2d39dd",color:"white",border:"1px solid #fff8",pointerEvents:"auto",fontSize:"14px"});
  el.addEventListener("click",handler);container.appendChild(el);
 }
 pad("left","Bewegung");pad("right","Blickrichtung");
 button("Interagieren","174px",onInteract);
 button("Laufen","230px",()=>{state.run=!state.run;onRun(state.run);});
 host.appendChild(container);
 return {read(){return {...state};},dispose(){active.clear();container.remove();},element:container};
}
root.LDOpenWorldTouch=Object.freeze({mount});
})(typeof window!=="undefined"?window:globalThis);
