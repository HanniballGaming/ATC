# FUNKSPRUCH — KI-Entwicklerteam

Verbindliche Projektbasis: Branch `funkspruch-v1-integration` (nicht ATC-main).
Nur Ego-/First-Person-Ansicht; deutsche Texte; Singleplayer. Normaler Modus spielbar; zweiter Modus im Menü sichtbar, aber gesperrt und mit "in Entwicklung" gekennzeichnet.
Browser: Nur die jeweils ausgewählte ILS-Stadt ist in 3D befahrbar, übriges Deutschland wird simuliert. Windows: langfristig deutschlandweite befahrbare Spielwelt.
Reale, lizenzierte Geodaten und realistische Wachen, Fahrzeuge, Fahrzeiten, Einsatzbearbeitung, Schichtbeginn, Notrufannahme, KI-Kollegen, KI-Anrufer, Funk und Touch-Steuerung weiterentwickeln. Nie Tests durch Behauptungen ersetzen.

## Arbeitsweise
- Wähle eine kleine Aufgabe aus `docs/AI_BACKLOG.md`, implementiere sie im **vorhandenen** Projekt.
- Build: `python release_v23.py`; dann im Verzeichnis `desktop`: `npm install --no-audit --no-fund`, `npm run prepare:web`, `npm run verify`.
- Zusätzliche Browser-Smoketests `browser-smoke.mjs`, `city-switch-smoke.mjs`, `tablet-smoke.mjs`, `offline-smoke.mjs`.
- Testfehler reproduzieren, Ursache beheben, erneut testen. Nie Tests entfernen, um grüne Ergebnisse vorzutäuschen.
- Änderungen in eigenem Feature-Branch, nur als Draft-PR. Testergebnisse und Restprobleme dokumentieren.
- Projektleitung, Entwickler, Welt/UI, Test, Story und Roadmap sind unabhängige Rollen. Neue Story in Dokumentations-PR.
- Keine automatischen Merges, Releases, Tags, Deployments oder Veränderungen an Release-Branches, Geheimnissen, `.github/workflows` oder `AGENTS.md`.
- Version 1.0 erfordert reale Tests für Browser, iPad, Windows, Performance, Audio, Speicherung, Asset-Lizenzen und ausdrückliche menschliche Freigabe.

## Code Review Rules
Prüfe Regressionen, Sicherheit, Lizenz, Geodaten, Browser/Windows-Trennung, deutsche Texte, und den Nachweis jedes Tests. Ein Offline-Build ist kein Spieltest.