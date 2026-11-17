/* LEITSTELLE DEUTSCHLAND – simple 2D building collision queries.
 * Uses imported building footprints; vertical levels and doors are not yet modelled.
 */
(function(root){"use strict";
function onSegment(p,a,b,epsilon=1e-7){
 const cross=(p.x-a.x)*(b.z-a.z)-(p.z-a.z)*(b.x-a.x);
 if(Math.abs(cross)>epsilon)return false;
 return p.x>=Math.min(a.x,b.x)-epsilon&&p.x<=Math.max(a.x,b.x)+epsilon&&p.z>=Math.min(a.z,b.z)-epsilon&&p.z<=Math.max(a.z,b.z)+epsilon;
}
function inRing(p,ring){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[j],b=ring[i];
  if(onSegment(p,a,b))return true;
  if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)inside=!inside;
 }
 return inside;
}
function inBuilding(point,building){
 const rings=building.rings;
 if(!rings||!rings.length||!inRing(point,rings[0]))return false;
 for(const hole of rings.slice(1))if(inRing(point,hole))return false;
 return true;
}
function collides(point,model,radius=0){
 if(!Number.isFinite(radius)||radius<0)throw Error("Invalid radius");
 for(const b of model.buildings||[]){
  if(inBuilding(point,b))return true;
  if(radius>0)for(const ring of b.rings||[])for(let i=0;i<ring.length;i++){
   const a=ring[i],c=ring[(i+1)%ring.length],dx=c.x-a.x,dz=c.z-a.z,l=dx*dx+dz*dz;
   if(l===0)continue;
   const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.z-a.z)*dz)/l));
   if(Math.hypot(point.x-(a.x+t*dx),point.z-(a.z+t*dz))<=radius)return true;
  }
 }
 return false;
}
function moveWithCollision(start,end,model,radius=0.35,step=0.5){
 const length=Math.hypot(end.x-start.x,end.z-start.z);
 const count=Math.max(1,Math.ceil(length/step));
 let p={x:start.x,z:start.z};
 for(let i=1;i<=count;i++){
  const target={x:start.x+(end.x-start.x)*i/count,z:start.z+(end.z-start.z)*i/count};
  if(collides(target,model,radius))return {...p,blocked:true};
  p=target;
 }
 return {...p,blocked:false};
}
root.LDOpenWorldCollision=Object.freeze({inRing,inBuilding,collides,moveWithCollision});
})(typeof window!=="undefined"?window:globalThis);
