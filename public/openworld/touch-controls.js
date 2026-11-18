/* FUNKSPRUCH – mobile first-person controls.
 * Dual-stick input with pointer capture, dead zones and delta-based camera look.
 * Mounted explicitly by the open-world runtime; no global handlers.
 */
(function(root){"use strict";
function mount(host,{onInteract=()=>{},onRun=()=>{}}={}){
 if(!host||!host.appendChild)throw Error("Container erforderlich");
 const doc=host.ownerDocument,container=doc.createElement("div");
 container.setAttribute("aria-label","FUNKSPRUCH – Touchsteuerung");
 Object.assign(container.style,{position:"absolute",inset:"0",pointerEvents:"none",zIndex:"30",touchAction:"none",userSelect:"none",webkitUserSelect:"none"});
 const state={forward:0,strafe:0,lookX:0,lookY:0,run:false};
 const active=new Map(),pads=[];
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function pad(side,label){
  const el=doc.createElement("div"),knob=doc.createElement("div");
  el.setAttribute("role","group");el.setAttribute("aria-label",label);
  Object.assign(el.style,{position:"absolute",bottom:"max(20px, env(safe-area-inset-bottom))",[side]:"max(18px, env(safe-area-inset-"+side+"))",width:"min(29vw,136px)",height:"min(29vw,136px)",borderRadius:"50%",border:"2px solid #a6dbea99",background:"#102b3e77",boxShadow:"inset 0 0 22px #0005",pointerEvents:"auto",touchAction:"none"});
  Object.assign(knob.style,{position:"absolute",left:"50%",top:"50%",width:"39%",height:"39%",borderRadius:"50%",background:"#9dd9ed99",border:"1px solid #e4f8ff",transform:"translate(-50%,-50%)",pointerEvents:"none"});
  el.appendChild(knob);container.appendChild(el);pads.push(el);
  function moveKnob(x,y){knob.style.left=(50+x*29)+"%";knob.style.top=(50+y*29)+"%";}
  el.addEventListener("pointerdown",e=>{
   if(active.has(side))return;
   e.preventDefault();el.setPointerCapture(e.pointerId);
   const r=el.getBoundingClientRect();
   active.set(side,{id:e.pointerId,cx:r.left+r.width/2,cy:r.top+r.height/2,lastX:e.clientX,lastY:e.clientY,radius:r.width*.37});
   update(e);
  });
  function update(e){
   const p=active.get(side);if(!p||p.id!==e.pointerId)return;
   e.preventDefault();
   const dx=clamp((e.clientX-p.cx)/p.radius,-1,1),dy=clamp((e.clientY-p.cy)/p.radius,-1,1);
   moveKnob(dx,dy);
   if(side==="left"){
    const dead=.14,curve=v=>Math.abs(v)<dead?0:Math.sign(v)*(Math.abs(v)-dead)/(1-dead);
    state.strafe=curve(dx);state.forward=-curve(dy);
   }else{
    // Relative pointer movement avoids camera drift while the finger is still.
    state.lookX+=clamp(e.clientX-p.lastX,-35,35)*.0032;
    state.lookY-=clamp(e.clientY-p.lastY,-35,35)*.0032;
   }
   p.lastX=e.clientX;p.lastY=e.clientY;
  }
  el.addEventListener("pointermove",update);
  function stop(e){
   const p=active.get(side);if(!p||p.id!==e.pointerId)return;
   active.delete(side);moveKnob(0,0);
   if(side==="left"){state.forward=0;state.strafe=0;}
  }
  for(const event of ["pointerup","pointercancel","lostpointercapture"])el.addEventListener(event,stop);
 }
 function button(label,bottom,handler){
  const el=doc.createElement("button");el.type="button";el.textContent=label;
  Object.assign(el.style,{position:"absolute",right:"max(18px, env(safe-area-inset-right))",bottom,padding:"11px 13px",minHeight:"44px",borderRadius:"11px",background:"#16364be8",color:"#fff",border:"1px solid #a3d6ed",pointerEvents:"auto",fontSize:"13px",fontWeight:"600"});
  el.addEventListener("click",handler);container.appendChild(el);return el;
 }
 pad("left","Bewegungsstick");pad("right","Blickstick");
 button("Interagieren","calc(max(20px, env(safe-area-inset-bottom)) + min(29vw, 136px) + 16px)",onInteract);
 const runButton=button("Sprinten: Aus","calc(max(20px, env(safe-area-inset-bottom)) + min(29vw, 136px) + 70px)",()=>{
  state.run=!state.run;runButton.textContent=state.run?"Sprinten: An":"Sprinten: Aus";runButton.setAttribute("aria-pressed",String(state.run));onRun(state.run);
 });
 host.appendChild(container);
 return {read(){const value={...state};state.lookX=0;state.lookY=0;return value;},dispose(){active.clear();container.remove();},element:container};
}
root.LDOpenWorldTouch=Object.freeze({mount});
})(typeof window!=="undefined"?window:globalThis);
