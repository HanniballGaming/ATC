# NORDTAL ATC 0.6 – GitHub Pages + Render (iPad geeignet)

## Wichtige Architektur
GitHub Pages hostet NUR die statische Browseroberfläche aus `docs/`. Der WebSocket-Multiplayer-Server benötigt zusätzlich Render oder einen anderen Node.js-Host. Ein reines GitHub-Pages-Deployment ermöglicht **keinen** Multiplayer. Für mobile Mikrofone muss die Website HTTPS verwenden.

## Schritt A: GitHub (ohne PC)
1. Auf dem iPad `github.com` im Browser öffnen und anmelden bzw. ein Konto erstellen.
2. `+` > **New repository** wählen, z. B. `nordtal-atc`. **Public** wählen (bei GitHub Free ist Pages für öffentliche Repositories verfügbar; private Pages erfordern ggf. anderen Plan). Keine echten Passwörter in Dateien hinterlegen.
3. ZIP herunterladen und in der Dateien-App entpacken. Repository öffnen > **Add file** > **Upload files**. Projektdateien und den Ordner `docs` hochladen. Wenn die mobile GitHub-Oberfläche Ordneruploads nicht unterstützt, Browser-Desktopansicht oder einen PC verwenden. Alternativ GitHub-Webeditor `github.dev` nutzen.
4. Repository > **Settings** > **Pages** > **Build and deployment**: Source **Deploy from a branch**, Branch **main**, Folder **/docs**, dann **Save**.
5. Warten bis die Pages-Adresse angezeigt wird: `https://DEINNAME.github.io/nordtal-atc/` (Namen ersetzen).

## Schritt B: Render (notwendig für Multiplayer)
1. `render.com` öffnen, anmelden und GitHub autorisieren.
2. **New** > **Blueprint**, das Repository auswählen und die mitgelieferte `render.yaml` verwenden. Prüfen, ob der Free-Tarif angeboten wird. Die Preismodelle können sich ändern.
3. Nach dem Deployment die Render-Adresse kopieren, z. B. `https://nordtal-atc.onrender.com`.
4. Die Pages-Website öffnen, im Multiplayer-Menü im Feld **Server** `wss://nordtal-atc.onrender.com` eintragen (eigene Adresse verwenden), dann **Join** klicken.
5. **Register** oder **Login**, Raum beitreten, Position wählen und **Claim position**. Bei der ersten Verbindung muss der Free-Server eventuell aufwachen.
6. Zweites Gerät: dieselbe Pages-Adresse und Serveradresse, eigener Benutzername, derselbe Raum, andere Lotsenposition.

## Funk
1. **Voice** einschalten, damit Pilotenrufe und Readbacks gesprochen werden.
2. **Speak** antippen, Mikrofon freigeben und eine englische Freigabe sprechen. Spracherkennung ist browserabhängig und auf iOS nicht garantiert.
3. KI-Piloten senden eigenständig Anfragen auf den vier Positionen; Notfälle erzeugen zusätzliche MAYDAY-Meldungen. Dies sind simulierte Textmeldungen mit optionaler Sprachausgabe, kein authentischer Frequenzfunk.

## Grenzen
- Render Free kann einschlafen. Die lokale JSON-Datenbank auf dem Render-Free-Dateisystem ist **nicht dauerhaft**. Benutzerkonten und gespeicherte Flüge können nach Neustart/Deployment verschwinden. Für produktive Konten: externe Datenbank wie Supabase Postgres integrieren.
- Es gibt noch keine E-Mail-Verifizierung, Account-Recovery, echte Sprachkanäle, belastbare Sicherheitshärtung oder vollständige 3D-Flughafenszene.
- Das Projekt ist ein Prototyp, nicht als echte ATC-Ausbildung geeignet.
- Niemals ein anderswo verwendetes Passwort für diesen Prototyp benutzen.
