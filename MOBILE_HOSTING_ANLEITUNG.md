# NORDTAL ATC – Mobile Online 0.3

## Ohne lokale Installation veröffentlichen
1. GitHub-Konto erstellen/anmelden.
2. Neues **privates** Repository anlegen.
3. Dateien dieses ZIP-Archivs über die GitHub-Weboberfläche hochladen (Inhalt des Projektordners, nicht das ZIP).
4. Bei Render anmelden, **New > Blueprint** auswählen, GitHub verbinden, Repository wählen, Blueprint bereitstellen.
5. Die von Render ausgegebene HTTPS-Adresse auf iPad/Smartphone/PC öffnen.
6. Im Multiplayer-Menü denselben Raumnamen wählen, dann pro Person eine Lotsenposition belegen.

Render-Angebote und Freikontingente können sich ändern. Prüfe beim Erstellen, ob `free` verfügbar ist. Kostenlose Instanzen können schlafen, neu starten oder Nutzung begrenzen.

## Grenzen
- Online-Multiplayer benötigt einen laufenden WebSocket-Server; rein statisches Hosting genügt nicht.
- Räume und Simulationsstände liegen nur im RAM; Neustart löscht sie.
- Keine Konten, Persistenz, Sprachfunk, vollständige ICAO-Verfahren oder Produktionssicherheitsprüfung.
- Bestehende Steuerung ist für Touchbedienung angepasst, nicht umfassend auf realen Geräten getestet.
- Die HTML-Oberfläche enthält weiterhin einige lokale Simulationsaktionen, die im Multiplayer serverseitig nicht wirken.
- Keine öffentliche Produktionsfreigabe; Pilotbetrieb mit vertrauten Personen empfohlen.
