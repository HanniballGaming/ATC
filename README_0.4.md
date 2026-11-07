# NORDTAL ATC 0.4 — experimental features

## Added
- Browser-based registration/login using scrypt password hashing and session tokens (24h, in-memory).
- JSON file persistence of user accounts and periodically saved room simulation snapshots.
- Random incident notifications and optional speech synthesis.
- Lightweight perspective 3D-style tower canvas (not a full 3D engine, aircraft placement illustrative).
- Mobile-first UI from 0.3.

## Hosting caveats
- Render free service filesystems are ephemeral. Accounts and room snapshots WILL be lost on redeployment/restart without persistent storage. Use a paid persistent disk or replace file storage with a managed database before production.
- This build is a prototype. No password reset, verified email, account recovery, robust security audit, realistic emergency response procedures, voice chat, or speech-to-text commands.
- Browser voice uses device speech synthesis and requires browser support; no radio voice transmission between players.
- Open the main page to log in before visiting /tower3d.html in the same browser tab context.
- Do not use passwords reused on other services.

## Deploy
Upload all files to GitHub and deploy via render.yaml (Render Blueprint). Free tier availability varies. Open the Render HTTPS URL.
