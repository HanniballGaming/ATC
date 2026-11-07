# NORDTAL ATC Multiplayer 0.2 (development build)

## Run
Install Node.js 20+, open this folder in a terminal, run `npm install` and `npm start`. Open `http://localhost:3000` in two browsers/devices on the same network (use your computer LAN IP for iPad). For public internet deploy this Node.js service to a host with persistent WebSocket support and HTTPS.

## Multiplayer
Enter the same room ID on both devices, Join, choose a controller tab (Ground, Tower, Approach, Center) and press **Claim position**. Other players can claim different positions. Only the owner can command aircraft in that position. The server advances one shared world and validates commands. Observers can watch.

## Scope / known limitations
This is an expanded playable prototype, NOT a complete or certified realistic ATC simulator. No accounts, persistent database, authentication, moderation, production scaling, voice communications, 3D airport, full real-world procedures, robust conflict resolution or accurate aircraft physics. The server stores room state in memory and restarting loses sessions. Local reset/spawn/speed controls are disabled for multiplayer; text radio and flight command buttons work through server validation. The original offline prototype is included separately in the ZIP.

## Architecture
Node HTTP + ws server; one authoritative ATCSimulation per room; JSON snapshots broadcast 5 times/sec; browser canvas renderer and controller UI; four exclusive controller positions per room; input validation, basic per-client rate limit and room capacity; room garbage collection. Future milestones: persistent sessions, scenario editor, airport/navdata model, aircraft performance, voice, handoff accept protocol, authentication, latency smoothing, integration testing and operational security.
