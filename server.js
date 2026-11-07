const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {WebSocketServer}=require('ws');const ATC=require('./engine');
const PORT=Number(process.env.PORT||3000);const rooms=new Map();const MAX_ROOMS=30,MAX_CLIENTS=20;
const sectors=['ground','tower','approach','center'];
const DB_FILE=process.env.DATA_FILE||path.join(__dirname,'atc-data.json');
let db={users:{},rooms:{}};
try{db=JSON.parse(fs.readFileSync(DB_FILE,'utf8'));db.users||={};db.rooms||={};}catch{}
function save(){const temp=DB_FILE+'.tmp';fs.writeFileSync(temp,JSON.stringify(db));fs.renameSync(temp,DB_FILE);}
function hash(p,salt){return crypto.scryptSync(p,salt,64).toString('hex');}
function authToken(){return crypto.randomBytes(24).toString('hex');}
const sessions=new Map();
function snapshot(r){return {aircraft:r.sim.aircraft,clock:r.sim.clock,elapsed:r.sim.elapsed,stats:r.sim.stats};}
function persistRoom(id,r){db.rooms[id]=snapshot(r);try{save();}catch(e){console.error('Persistence:',e.message);}}

function room(id){if(!rooms.has(id)){if(rooms.size>=MAX_ROOMS)throw Error('Server capacity reached');const sim=new ATC.Simulation();sim.speed=1;const saved=db.rooms[id];if(saved){try{sim.aircraft=saved.aircraft;sim.clock=saved.clock;sim.elapsed=saved.elapsed;sim.stats=saved.stats;}catch{}}rooms.set(id,{sim,clients:new Set(),owners:{},last:Date.now(),nextIncident:Date.now()+120000+Math.random()*180000,nextPilotCall:Date.now()+18000,radioSeq:0});}return rooms.get(id);}
const server=http.createServer((req,res)=>{let url;try{url=new URL(req.url,'http://localhost')}catch{return res.writeHead(400).end()};const name=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!['index.html','health','tower3d.html'].includes(name)){res.writeHead(404).end();return;}if(name==='health'){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({ok:true,rooms:rooms.size}));return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}).end(fs.readFileSync(path.join(__dirname,name)));});
const wss=new WebSocketServer({server,maxPayload:4096});
function send(ws,obj){if(ws.readyState===1)ws.send(JSON.stringify(obj));}
function broadcast(r){const state={type:'state',aircraft:r.sim.aircraft,events:r.sim.events.slice(-80),clock:r.sim.clock,elapsed:r.sim.elapsed,speed:r.sim.speed,paused:r.sim.paused,stats:r.sim.stats,owners:r.owners};for(const c of r.clients)send(c,state);}
wss.on('connection',(ws,req)=>{let r=null,sector=null,clientId=crypto.randomUUID(),username=null;let count=0,windowStart=Date.now();ws.on('message',data=>{try{if(Date.now()-windowStart>1000){count=0;windowStart=Date.now();}if(++count>20)throw Error('Rate limit');const msg=JSON.parse(data);if(!msg||typeof msg!=='object')return;
if(msg.type==='register'||msg.type==='login'){
const name=String(msg.username||'').toLowerCase(),password=String(msg.password||'');
if(!/^[a-z0-9_]{3,20}$/.test(name)||password.length<8||password.length>128)throw Error('Username 3-20 chars, password 8-128 chars');
if(msg.type==='register'){if(db.users[name])throw Error('Account exists');const salt=crypto.randomBytes(16).toString('hex');db.users[name]={salt,passwordHash:hash(password,salt),created:Date.now()};save();}
const u=db.users[name];if(!u||!crypto.timingSafeEqual(Buffer.from(u.passwordHash,'hex'),Buffer.from(hash(password,u.salt),'hex')))throw Error('Invalid credentials');
username=name;const token=authToken();sessions.set(token,{username:name,expires:Date.now()+86400000});send(ws,{type:'authenticated',username:name,token});return;
}
if(msg.type==='resume'){const sess=sessions.get(String(msg.token||''));if(!sess||sess.expires<Date.now())throw Error('Session expired');username=sess.username;send(ws,{type:'authenticated',username,token:msg.token});return;}
if(msg.type==='join'){if(r)throw Error('Already joined');const id=String(msg.room||'PUBLIC').toUpperCase();if(!/^[A-Z0-9_-]{3,16}$/.test(id))throw Error('Room ID must be 3-16 letters/numbers');if(!username)throw Error('Login required');r=room(id);if(r.clients.size>=MAX_CLIENTS)throw Error('Room full');r.clients.add(ws);send(ws,{type:'joined',id:clientId,room:id,username});broadcast(r);return;}
if(!r)throw Error('Join a room first');
if(msg.type==='claim'){const s=String(msg.sector||'');if(!sectors.includes(s))throw Error('Invalid position');if(r.owners[s]&&r.owners[s]!==clientId)throw Error('Position occupied');if(sector&&r.owners[sector]===clientId)delete r.owners[sector];r.owners[s]=clientId;sector=s;broadcast(r);return;}
if(msg.type==='release'){if(sector&&r.owners[sector]===clientId)delete r.owners[sector];sector=null;broadcast(r);return;}
if(msg.type==='command'){if(!sector||r.owners[sector]!==clientId)throw Error('Claim a position first');const callsign=String(msg.callsign||'').toUpperCase(),action=String(msg.action||'');if(!/^[A-Z0-9]{3,10}$/.test(callsign)||!['taxi','handoff','lineup','takeoff','land','ils','goaround','heading','altitude','speed','hdg','alt','spd'].includes(action))throw Error('Invalid command');const a=r.sim.find(callsign);if(!a||a.ctrl!==sector)throw Error('Flight not controlled by your position');const value=Number(msg.value);const before=r.sim.events.length;const result=r.sim.issue(callsign,action,Number.isFinite(value)?value:undefined);const recent=r.sim.events.slice(before);const pilot=recent.filter(x=>String(x.type||x.who||x.from||'').toLowerCase()==='pilot'||/PILOT/i.test(JSON.stringify(x))).at(-1);send(ws,{type:'result',...result,callsign,readback:pilot?.text||pilot?.message||null});broadcast(r);for(const [id,rr] of rooms){if(rr===r){persistRoom(id,r);break;}}return;}
if(msg.type==='ping')send(ws,{type:'pong'});
}catch(e){send(ws,{type:'error',message:String(e.message).slice(0,160)});}});ws.on('close',()=>{if(!r)return;r.clients.delete(ws);if(sector&&r.owners[sector]===clientId)delete r.owners[sector];r.last=Date.now();broadcast(r);});});
let last=Date.now();setInterval(()=>{const now=Date.now(),dt=Math.min((now-last)/1000,1);last=now;for(const [id,r] of rooms){if(!r.clients.size){if(now-r.last>600000){persistRoom(id,r);rooms.delete(id);}continue;}
r.sim.step(dt);
if(now>r.nextPilotCall){
 const candidates=r.sim.aircraft.filter(a=>a&&a.callsign&&a.ctrl);
 if(candidates.length){const a=candidates[Math.floor(Math.random()*candidates.length)];
 const messages={ground:['request taxi instructions','ready for taxi','request further taxi clearance'],tower:['ready for departure','request takeoff clearance','established final, request landing clearance'],approach:['inbound, request vectors','request approach clearance','descending, request further instructions'],center:['request climb clearance','request direct routing','request descent clearance']};
 const options=messages[a.ctrl]||messages.center;
 const msg={type:'pilot_radio',id:++r.radioSeq,callsign:a.callsign,sector:a.ctrl,message:options[Math.floor(Math.random()*options.length)],timestamp:Date.now()};
 for(const c of r.clients)send(c,msg);
 }
 r.nextPilotCall=now+18000+Math.random()*27000;
}
if(now>r.nextIncident){const candidates=r.sim.aircraft.filter(a=>a&&a.callsign);if(candidates.length){const a=candidates[Math.floor(Math.random()*candidates.length)];const kinds=['MEDICAL EMERGENCY','RADIO FAILURE (SIMULATED)','TECHNICAL ISSUE','BIRD STRIKE REPORT'];const incident=kinds[Math.floor(Math.random()*kinds.length)];r.sim.events.push({t:r.sim.clock,text:'⚠ '+a.callsign+': '+incident});for(const c of r.clients){send(c,{type:'incident',callsign:a.callsign,incident});send(c,{type:'pilot_radio',id:++r.radioSeq,callsign:a.callsign,sector:a.ctrl||'tower',message:'MAYDAY MAYDAY, '+incident+', request immediate assistance',timestamp:Date.now()});}}r.nextIncident=now+180000+Math.random()*300000;}
broadcast(r);}},200);
server.listen(PORT,'0.0.0.0',()=>console.log('NORDTAL ATC multiplayer listening on '+PORT));

setInterval(()=>{for(const [id,r] of rooms)persistRoom(id,r);},30000);
