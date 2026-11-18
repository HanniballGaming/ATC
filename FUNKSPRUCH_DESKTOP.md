# FUNKSPRUCH – Browser und Windows

Dieser Zweig integriert das vorhandene umfangreiche Einsatzleitsystem aus dem bisherigen Spielarchiv in den 3D-Leitstellenarbeitsplatz. **Integrationsfassung, noch keine abgenommene 1.0.**

## Browser

Das ZIP LEITSTELLE_DEUTSCHLAND_v0_21.zip enthält den bisherigen Hauptsimulator. Der Einstieg in die 3D-Welt liegt in public/openworld/index.html. Das ZIP muss für den Webbetrieb in den Stammordner entpackt und public/openworld unter /openworld/ mitgeliefert werden. Beim Platznehmen lädt arbeitsplatz.html den vollständigen Hauptsimulator im Bildschirm. Eine Ersatzansicht bleibt als arbeitsplatz-basis.html verfügbar.

## Windows-Installer bauen

Erforderlich: Windows, Python 3, Node.js 22, Internet zum Installieren der Bauwerkzeuge.

1. python release_v23.py
2. cd desktop
3. npm install
4. npm run prepare:web
5. npm run verify
6. npm run build:windows

Das Setup liegt danach in desktop/release/. GitHub Actions erstellt bei jedem Push auf den Integrationszweig ein Windows-Testartefakt.

FUNKSPRUCH startet nur einen lokalen HTTP-Server unter 127.0.0.1:47821. Die feste Adresse erhält lokale Spielstände zwischen Neustarts. Keine Verbindung zu echten Notrufen oder BOS-Systemen.

## Offen vor Version 1.0

Windows-Installation und dauerhafte Spielstände testen; vollständiges ELS und Hauptmenü im realen Browser prüfen; Funk und laufende Einsatzbearbeitung durchspielen; Open World mit lizenzierten Geodaten ausbauen (derzeit synthetische Testgeometrie); iPad, Audio, Mikrofon und Laufzeitleistung testen. Das Windows-Setup ist zunächst nicht signiert. Der zweite Spielmodus bleibt gesperrt.
