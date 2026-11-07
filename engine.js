'use strict';
var ATC = globalThis.ATC = {};

'use strict';
globalThis.ATC = globalThis.ATC || {};
ATC.SECTORS = Object.freeze({ ground: 'GROUND', tower: 'TOWER', approach: 'APPROACH', center: 'CENTER' });
ATC.RUNWAY = '09';
ATC.GATES = [
  {id:'A1',x:-0.76,y:-0.69},{id:'A2',x:-0.42,y:-0.69},{id:'A3',x:-0.08,y:-0.69},
  {id:'A4',x:0.26,y:-0.69},{id:'A5',x:0.60,y:-0.69}
];
ATC.TYPE_NAMES = ['A320','B738','A319','E190','A321','B739'];
ATC.norm = (deg) => ((deg % 360) + 360) % 360;
ATC.bearing = (x1,y1,x2,y2) => ATC.norm(Math.atan2(x2-x1,y2-y1)*180/Math.PI);
ATC.dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
ATC.clamp = (v,a,b) => Math.max(a,Math.min(b,v));
ATC.hdgText = d => String(Math.round(ATC.norm(d))).padStart(3,'0');
ATC.formatAlt = a => (a.alt>=10000 ? 'FL'+String(Math.round(a.alt/100)).padStart(3,'0') : Math.round(a.alt/100)*100+' ft');
ATC.PHASE_LABELS = {
  center_in:'Enroute / Inbound', approach_in:'Approach inbound', ils:'ILS 09', final:'Final 09',
  missed:'Missed approach', rollout:'Landing roll', taxi_wait_arr:'Runway vacated', taxi_in:'Taxi to stand', parked:'At stand',
  taxi_out:'Taxi to RWY 09', hold_short:'Holding short', lining_up:'Entering RWY 09', lineup:'Lined up',
  takeoff_roll:'Takeoff roll', climb:'Initial climb', center_out:'Enroute / Outbound', done:'Completed'
};
ATC.seedFlights = () => [
  {callsign:'DLH401',type:'A320',op:'arrival',ctrl:'center',phase:'center_in',x:-34,y:10,heading:111,spd:275,alt:13000,targetAlt:10000,targetSpd:250,fix:{x:-22,y:5}},
  {callsign:'SWR611',type:'A220',op:'arrival',ctrl:'approach',phase:'approach_in',x:-17,y:4,heading:106,spd:205,alt:6100,targetAlt:4500,targetSpd:195,fix:{x:-11,y:3}},
  {callsign:'EWG204',type:'A319',op:'arrival',ctrl:'tower',phase:'final',x:-6.6,y:0,heading:90,spd:150,alt:1850,targetAlt:1850,targetSpd:145,ilsCleared:true,onGlide:true},
  {callsign:'DLH772',type:'A320',op:'departure',ctrl:'ground',phase:'parked',gate:'A1',x:-0.76,y:-0.69,heading:0,spd:0,alt:0,targetAlt:5000,targetSpd:210},
  {callsign:'KLM326',type:'B738',op:'departure',ctrl:'ground',phase:'parked',gate:'A2',x:-0.42,y:-0.69,heading:0,spd:0,alt:0,targetAlt:5000,targetSpd:210}
];



'use strict';
class ATCSimulation {
  constructor(){ this.reset(); }
  reset(){
    this.aircraft=[];this.events=[];this.elapsed=0;this.clock=7*3600+35*60;
    this.speed=8;this.paused=false;this.nextId=700;this.nextTraffic=420;
    this.stats={arrivals:0,departures:0,goArounds:0,rejected:0,conflicts:0};
    this.conflictPairs=new Set();this.seq=0;
    for(const seed of ATC.seedFlights())this.add(seed);
    this.log('SYS','Simulation initialisiert · NORDTAL INTL · RWY 09 active','info');
    this.log('PILOT','EWG204: established ILS runway 09, request landing clearance.','pilot');
    this.log('PILOT','DLH772: at stand A1, request taxi.','pilot');
    this.log('PILOT','KLM326: at stand A2, request taxi.','pilot');
  }
  add(data){
    const a={id:++this.seq,callsign:data.callsign,type:data.type||'A320',op:data.op,ctrl:data.ctrl,
      phase:data.phase,x:data.x,y:data.y,heading:data.heading??90,spd:data.spd||0,alt:data.alt||0,
      targetAlt:data.targetAlt??data.alt??0,targetSpd:data.targetSpd??data.spd??0,
      targetHeading:data.heading??90,fix:data.fix||null,gate:data.gate||null,
      ilsCleared:data.ilsCleared||false,landCleared:false,onGlide:data.onGlide||false,
      manualHeading:false,taxiPoints:[],taxiIndex:0,trail:[],trailClock:0,holdTurn:0,missedPoints:[],
      completedAt:null};
    this.aircraft.push(a);return a;
  }
  log(from,message,kind='atc'){
    const stamp=this.timeText();this.events.unshift({stamp,from,message,kind,id:Date.now()+Math.random()});
    if(this.events.length>150)this.events.length=150;
  }
  timeText(){const s=((Math.floor(this.clock)%86400)+86400)%86400;return String(Math.floor(s/3600)).padStart(2,'0')+':'+String(Math.floor(s%3600/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
  find(callsign){return this.aircraft.find(a=>a.callsign===String(callsign).toUpperCase()&&a.phase!=='done');}
  active(){return this.aircraft.filter(a=>a.phase!=='done');}
  runwayOccupied(except=null){return this.aircraft.some(a=>a!==except&&['lining_up','lineup','takeoff_roll','rollout'].includes(a.phase));}
  inboundShort(except=null){return this.aircraft.some(a=>a!==except&&a.op==='arrival'&&['ils','final'].includes(a.phase)&&a.x<0&&a.x>-4.5);}
  reject(a,reason){this.stats.rejected++;this.log('ATC',`${a.callsign}: unable — ${reason}`,'warn');return {ok:false,message:reason};}
  success(a,clearance,readback){this.log('ATC',`${a.callsign}, ${clearance}`,'atc');this.log('PILOT',`${a.callsign}: ${readback}`,'pilot');return {ok:true,message:clearance};}
  issue(callsign,action,value){
    const a=this.find(callsign);if(!a)return {ok:false,message:'Aircraft not found.'};
    if(a.ctrl!==this.currentSector)return this.reject(a,`contact ${ATC.SECTORS[a.ctrl]} first`);
    switch(action){
      case 'heading': {
        if(!['approach','center'].includes(a.ctrl)||a.alt<250)return this.reject(a,'heading vectors available only on radar positions');
        const n=Number(value);if(!Number.isFinite(n)||n<0||n>359)return this.reject(a,'heading must be 000–359');
        a.targetHeading=ATC.norm(n);a.manualHeading=true;
        if(a.ilsCleared){a.ilsCleared=false;a.onGlide=false;a.phase='approach_in';}
        return this.success(a,`turn heading ${ATC.hdgText(n)}`,`turning heading ${ATC.hdgText(n)}`);
      }
      case 'altitude': {
        if(!['approach','center'].includes(a.ctrl)||a.alt<200)return this.reject(a,'altitude assignments available on radar positions');
        const n=Number(value);if(!Number.isFinite(n)||n<1000||n>40000||n%100!==0)return this.reject(a,'use 1,000–40,000 ft in 100 ft steps');
        a.targetAlt=n;return this.success(a,`climb/descend to ${n.toLocaleString('en-US')} feet`,`${n.toLocaleString('en-US')} feet`);
      }
      case 'speed': {
        if(!['approach','center'].includes(a.ctrl)||a.alt<200)return this.reject(a,'speed assignments available on radar positions');
        const n=Number(value);if(!Number.isFinite(n)||n<120||n>330)return this.reject(a,'speed must be 120–330 kt');
        a.targetSpd=n;return this.success(a,`maintain ${n} knots`,`maintain ${n} knots`);
      }
      case 'ils': {
        if(a.ctrl!=='approach'||a.op!=='arrival'||!['approach_in','missed'].includes(a.phase))return this.reject(a,'ILS clearance requires an approach-controlled inbound');
        if(ATC.dist(a,{x:0,y:0})>29)return this.reject(a,'outside approach area');
        a.ilsCleared=true;a.onGlide=false;a.manualHeading=false;a.phase='ils';a.targetSpd=170;a.targetAlt=3300;
        return this.success(a,'cleared ILS approach runway 09','cleared ILS runway 09');
      }
      case 'land': {
        if(a.ctrl!=='tower'||a.op!=='arrival'||!['ils','final'].includes(a.phase))return this.reject(a,'aircraft not on a Tower-controlled final');
        if(a.x>0||a.x< -10||Math.abs(a.y)>2.3)return this.reject(a,'aircraft must be established within 10 NM');
        if(this.runwayOccupied(a))return this.reject(a,'runway occupied');
        if(this.aircraft.some(b=>b!==a&&b.landCleared&&b.op==='arrival'&&b.phase!=='rollout'&&b.phase!=='done'))return this.reject(a,'landing clearance already issued');
        a.landCleared=true;return this.success(a,'runway 09 cleared to land','runway 09 cleared to land');
      }
      case 'taxi':{
        if(a.ctrl!=='ground')return this.reject(a,'taxi instructions require Ground');
        if(a.op==='departure'&&a.phase==='parked'){
          a.phase='taxi_out';a.taxiPoints=[{x:a.x,y:-0.37},{x:-1.16,y:-0.37},{x:-1.16,y:-0.18}];a.taxiIndex=0;
          return this.success(a,'taxi via apron and taxiway A, hold short runway 09','taxi via A, holding short runway 09');
        }
        if(a.op==='arrival'&&a.phase==='taxi_wait_arr'){
          const gate=this.freeGate();if(!gate)return this.reject(a,'all stands occupied');
          a.gate=gate.id;a.phase='taxi_in';a.taxiPoints=[{x:0.68,y:-0.37},{x:gate.x,y:-0.37},{x:gate.x,y:gate.y}];a.taxiIndex=0;
          return this.success(a,`taxi via A to stand ${gate.id}`,`taxi to stand ${gate.id}`);
        }
        return this.reject(a,'taxi clearance not available in current phase');
      }
      case 'lineup':{
        if(a.ctrl!=='tower'||a.phase!=='hold_short')return this.reject(a,'departure must be at holding point under Tower');
        if(this.runwayOccupied(a))return this.reject(a,'runway occupied');
        if(this.inboundShort(a))return this.reject(a,'arrival inside 4.5 NM final');
        a.phase='lining_up';a.taxiPoints=[{x:-1.04,y:0}];a.taxiIndex=0;
        return this.success(a,'line up and wait runway 09','line up and wait runway 09');
      }
      case 'takeoff':{
        if(a.ctrl!=='tower'||a.phase!=='lineup')return this.reject(a,'line up on runway first');
        if(this.runwayOccupied(a))return this.reject(a,'another aircraft on runway');
        if(this.inboundShort(a))return this.reject(a,'arrival inside 4.5 NM final');
        a.phase='takeoff_roll';a.spd=0;a.heading=90;a.targetHeading=90;a.targetAlt=5000;
        return this.success(a,'runway 09 cleared for takeoff','runway 09 cleared for takeoff');
      }
      case 'goaround':{
        if(a.ctrl!=='tower'||a.op!=='arrival'||!['ils','final'].includes(a.phase))return this.reject(a,'no approach to discontinue');
        this.goAround(a,'ATC instruction');
        return this.success(a,'go around, climb 3,500 feet','going around, 3,500 feet');
      }
      case 'handoff': {
        if(a.ctrl==='center'&&a.op==='arrival'&&a.phase==='center_in'&&ATC.dist(a,{x:0,y:0})<31){
          a.ctrl='approach';a.phase='approach_in';a.fix={x:-11,y:3};a.targetAlt=5000;a.targetSpd=210;a.manualHeading=false;
          return this.success(a,'contact Nordtal Approach 119.700','Approach 119.700, good day');
        }
        if(a.ctrl==='approach'&&a.op==='arrival'&&['ils','final'].includes(a.phase)&&a.x>-10.0&&a.x<0&&Math.abs(a.y)<2.5){
          a.ctrl='tower';return this.success(a,'contact Nordtal Tower 118.500','Tower 118.500');
        }
        if(a.ctrl==='tower'&&a.op==='arrival'&&a.phase==='taxi_wait_arr'){
          a.ctrl='ground';return this.success(a,'contact Nordtal Ground 121.800','Ground 121.800');
        }
        if(a.ctrl==='ground'&&a.op==='departure'&&a.phase==='hold_short'){
          a.ctrl='tower';return this.success(a,'contact Nordtal Tower 118.500','Tower 118.500');
        }
        if(a.ctrl==='tower'&&a.op==='departure'&&a.phase==='climb'&&a.x>2){
          a.ctrl='approach';a.targetAlt=7000;a.targetSpd=250;return this.success(a,'contact Nordtal Departure 119.700','Departure 119.700');
        }
        if(a.ctrl==='approach'&&a.op==='departure'&&a.phase==='climb'&&a.x>12){
          a.ctrl='center';a.phase='center_out';a.targetAlt=14000;a.targetSpd=280;return this.success(a,'contact Nordtal Center 132.200','Center 132.200, bye');
        }
        if(a.ctrl==='tower'&&a.op==='arrival'&&a.phase==='missed'&&a.x>1){
          a.ctrl='approach';return this.success(a,'contact Approach 119.700, missed approach','Approach 119.700');
        }
        return this.reject(a,'handoff not yet available for this flight');
      }
      default:return this.reject(a,'unknown instruction');
    }
  }
  goAround(a,reason){
    if(a.phase==='missed')return;
    a.phase='missed';a.ilsCleared=false;a.landCleared=false;a.onGlide=false;a.manualHeading=false;
    a.targetAlt=3500;a.targetSpd=195;a.alt=Math.max(a.alt,250);
    a.missedPoints=[{x:7,y:2.3},{x:-13,y:4}];a.taxiIndex=0;
    this.stats.goArounds++;this.log('ALERT',`${a.callsign}: GO AROUND (${reason})`,'warn');
    this.log('PILOT',`${a.callsign}: going around, runway 09.`,'pilot');
  }
  freeGate(){return ATC.GATES.find(g=>!this.aircraft.some(a=>a.phase!=='done'&&a.gate===g.id));}
  newTraffic(op){
    if(this.active().length>=13){this.log('SYS','Traffic cap reached (13).','warn');return false;}
    this.nextId++;
    const id=String(this.nextId);const prefix=['DLH','EWG','SWR','KLM','BAW','AFR'][this.nextId%6];
    const callsign=prefix+id;const type=ATC.TYPE_NAMES[this.nextId%ATC.TYPE_NAMES.length];
    if(op==='departure'){
      const gate=this.freeGate();if(!gate){this.log('SYS','No available stand for new departure.','warn');return false;}
      this.add({callsign,type,op:'departure',ctrl:'ground',phase:'parked',gate:gate.id,x:gate.x,y:gate.y,heading:0,spd:0,alt:0,targetAlt:5000,targetSpd:210});
      this.log('PILOT',`${callsign}: stand ${gate.id}, ready for taxi.`,'pilot');
    }else{
      const y=[-10,-5,5,9][this.nextId%4];
      this.add({callsign,type,op:'arrival',ctrl:'center',phase:'center_in',x:-39,y,heading:ATC.bearing(-39,y,-22,5),spd:265,alt:12000,targetAlt:10000,targetSpd:245,fix:{x:-22,y:5}});
      this.log('PILOT',`${callsign}: inbound Nordtal from west, FL120.`,'pilot');
    }
    return true;
  }
  step(realDt){
    if(this.paused)return;
    const dt=Math.min(0.08,Math.max(0,realDt))*this.speed;
    this.clock+=dt;this.elapsed+=dt;this.nextTraffic-=dt;
    if(this.nextTraffic<=0){this.newTraffic(this.stats.arrivals%2===0?'arrival':'departure');this.nextTraffic=420+Math.random()*160;}
    for(const a of this.aircraft){
      if(a.phase==='done')continue;
      if(['parked','taxi_wait_arr','hold_short','lineup'].includes(a.phase)){a.spd=0;continue;}
      if(['taxi_out','taxi_in','lining_up'].includes(a.phase))this.moveTaxi(a,dt);
      else if(a.phase==='takeoff_roll')this.moveTakeoff(a,dt);
      else if(a.phase==='rollout')this.moveLandingRoll(a,dt);
      else this.moveAirborne(a,dt);
      if(a.alt>100&&a.trailClock+8<this.elapsed){a.trail.push({x:a.x,y:a.y});if(a.trail.length>18)a.trail.shift();a.trailClock=this.elapsed;}
      if(a.op==='departure'&&a.phase==='center_out'&&a.x>=43){a.phase='done';a.completedAt=this.elapsed;this.stats.departures++;this.log('SYS',`${a.callsign}: departed sector — flight completed.`,'success');}
      if(a.op==='arrival'&&a.phase==='taxi_in'&&a.taxiIndex>=a.taxiPoints.length){a.phase='done';a.completedAt=this.elapsed;this.stats.arrivals++;this.log('SYS',`${a.callsign}: parked at ${a.gate} — flight completed.`,'success');}
    }
    this.aircraft=this.aircraft.filter(a=>a.phase!=='done'||this.elapsed-a.completedAt<45);
    this.checkConflicts();
  }
  steer(a,target,dt){const diff=((ATC.norm(target)-a.heading+540)%360)-180;const limit=3*dt;a.heading=ATC.norm(a.heading+ATC.clamp(diff,-limit,limit));}
  moveTaxi(a,dt){
    const point=a.taxiPoints[a.taxiIndex];if(!point)return;
    const dx=point.x-a.x,dy=point.y-a.y,d=Math.hypot(dx,dy);const move=Math.min(d,17/3600*dt);
    if(d>0.0001){a.heading=ATC.bearing(a.x,a.y,point.x,point.y);a.x+=dx/d*move;a.y+=dy/d*move;}
    a.spd=move>0?17:0;
    if(d<=move+0.0007){a.x=point.x;a.y=point.y;a.taxiIndex++;if(a.taxiIndex>=a.taxiPoints.length){
      if(a.phase==='taxi_out'){a.phase='hold_short';this.log('PILOT',`${a.callsign}: holding short runway 09, ready for departure.`,'pilot');}
      if(a.phase==='lining_up'){a.phase='lineup';this.log('PILOT',`${a.callsign}: lined up runway 09.`,'pilot');}
    }}
  }
  moveTakeoff(a,dt){
    a.heading=90;a.spd=Math.min(160,a.spd+4.0*dt);a.x+=a.spd/3600*dt;a.y=0;
    if(a.spd>=144){a.phase='climb';a.alt=60;a.targetAlt=5000;a.targetSpd=230;this.log('PILOT',`${a.callsign}: airborne, passing 100 feet.`,'pilot');}
  }
  moveLandingRoll(a,dt){
    a.alt=0;a.heading=90;a.spd=Math.max(18,a.spd-2.5*dt);a.x+=a.spd/3600*dt;a.y=0;
    if(a.x>=0.67){a.x=0.67;a.y=-0.19;a.phase='taxi_wait_arr';a.spd=0;a.landCleared=false;
      this.log('PILOT',`${a.callsign}: runway 09 vacated via taxiway C.`,'pilot');}
  }
  moveAirborne(a,dt){
    let requestedHeading=a.targetHeading;let requestedAltitude=a.targetAlt;
    let requestedSpeed=a.targetSpd;
    if(a.op==='arrival'){
      if(a.phase==='center_in'||a.phase==='approach_in'){
        if(!a.manualHeading){
          const fix=a.fix||{x:-12,y:3};const d=ATC.dist(a,fix);
          if(d>1.9){requestedHeading=ATC.bearing(a.x,a.y,fix.x,fix.y);}
          else {a.holdTurn+=dt;requestedHeading=ATC.norm(a.heading+3.0*dt);}
        }
      }
      if(a.phase==='ils'||a.phase==='final'){
        if(!a.onGlide){
          const fix={x:-9,y:0};requestedHeading=ATC.bearing(a.x,a.y,fix.x,fix.y);
          requestedAltitude=3300;requestedSpeed=175;
          if(ATC.dist(a,fix)<1.2){a.onGlide=true;a.phase='final';this.log('PILOT',`${a.callsign}: established runway 09 localizer.`,'pilot');}
        } else {
          requestedHeading=ATC.bearing(a.x,a.y,-0.95,0);
          requestedAltitude=ATC.clamp(Math.max(0,(-0.95-a.x)*320),0,3300);
          requestedSpeed=145;
        }
        a.targetAlt=requestedAltitude;a.targetSpd=requestedSpeed;
      }
      if(a.phase==='missed'){
        const fix=a.missedPoints[a.taxiIndex];
        if(fix){requestedHeading=ATC.bearing(a.x,a.y,fix.x,fix.y);if(ATC.dist(a,fix)<1.2)a.taxiIndex++;}
        else {a.phase='approach_in';a.fix={x:-12,y:3};a.targetAlt=3500;a.targetSpd=190;this.log('PILOT',`${a.callsign}: ready for new approach vectors.`,'pilot');}
      }
    }else if(a.op==='departure'&&['climb','center_out'].includes(a.phase)){
      if(!a.manualHeading)requestedHeading=a.x<8?90:101;
    }
    this.steer(a,requestedHeading,dt);
    const speedRate=1.3*dt;a.spd+=ATC.clamp(requestedSpeed-a.spd,-speedRate,speedRate);
    const altRate=(requestedAltitude>=a.alt?1800:2100)/60*dt;
    a.alt=Math.max(0,a.alt+ATC.clamp(requestedAltitude-a.alt,-altRate,altRate));
    const rad=a.heading*Math.PI/180;a.x+=Math.sin(rad)*a.spd/3600*dt;a.y+=Math.cos(rad)*a.spd/3600*dt;
    if(a.op==='arrival'&&['ils','final'].includes(a.phase)&&a.onGlide&&a.x>=-1.08){
      if(a.landCleared&&a.ctrl==='tower'&&!this.runwayOccupied(a)){
        a.phase='rollout';a.x=-1.07;a.y=0;a.alt=0;a.spd=140;a.heading=90;
        this.log('PILOT',`${a.callsign}: touchdown, runway 09.`,'pilot');
      } else this.goAround(a,a.ctrl!=='tower'?'not transferred to Tower':!a.landCleared?'no landing clearance':'runway not clear');
    }
  }
  checkConflicts(){
    const active=this.aircraft.filter(a=>a.alt>1000&&a.phase!=='done');const now=new Set();
    for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
      const a=active[i],b=active[j];const horizontal=ATC.dist(a,b);const vertical=Math.abs(a.alt-b.alt);
      if(horizontal<3&&vertical<1000){
        const key=[a.id,b.id].sort((x,y)=>x-y).join('-');now.add(key);
        if(!this.conflictPairs.has(key)){
          this.stats.conflicts++;this.log('ALERT',`PROXIMITY: ${a.callsign} / ${b.callsign} · ${horizontal.toFixed(1)} NM / ${Math.round(vertical)} ft`,'warn');
        }
      }
    }
    this.conflictPairs=now;
  }
}
ATC.Simulation=ATCSimulation;


module.exports=ATC;
