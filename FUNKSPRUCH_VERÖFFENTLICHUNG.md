# FUNKSPRUCH – öffentliche Browser-Beta

Veröffentlichungsaktualisierung: 19. November 2026
Getesteter FUNKSPRUCH-Entwicklungsstand: `3b164c0288276e2dfdb584d2fc6dcad40d0e3d79`
Abnahme: GitHub Actions [44557510510](https://github.com/HanniballGaming/ATC/actions/runs/44557510510) – Browser, iPad-Browsersteuerung und Windows erfolgreich

**Direkt spielbar:** https://hanniballgaming.github.io/ATC/funkspruch/openworld/

## Neue Funktionen

- Strukturierte, fallbezogene Notruf-Checkliste: Einsatzort, Ereignis, Anzahl der Betroffenen und Gefahren sowie passende Zusatzangaben zu Atmung, Bewusstsein, Zugang und Beginn.
- Anzeige, welche Gesprächsangaben geklärt, noch offen oder unsicher sind; passende nächste Rückfrage direkt am Einsatzleitsystem.
- Regelbasierte KI-Anrufer erfinden nicht mehr automatisch ein Alter. Vorliegende Adressdaten werden bei Rückfragen wiedergegeben, fehlende Hausnummern ausdrücklich als unklar gekennzeichnet.
- KI-Kollegen können nach dokumentierter Einsatzaufnahme passende, tatsächlich freie Fahrzeuge aus der gemeinsamen Einsatzmittelliste selbst disponieren, wenn ein Fall an sie übertragen wurde.
- Schutz vor Zugriff auf fremde Fälle, Doppelalarmierung und unrealistischen zusätzlichen Einsatzmitteln.
- Windows-Fehler beim Beenden nach dem zweiten Start behoben; Start- und Persistenztest sowie tatsächlicher Start des gepackten Windows-Programms bestanden.

## Bereits enthalten

- Normaler Singleplayer-Leitstellenmodus mit First-Person-Schichtbeginn, Einsatzleitsystem am Arbeitsplatz, KI-Anrufen, Funk und Dienstjournal.
- Zweiter Modus „Apokalypse & Überleben“ sichtbar, aber als **in Entwicklung** gekennzeichnet und nicht startbar.
- Echte OpenStreetMap-Straßen und Gebäude eines begrenzten Augsburger Kartenausschnitts mit getrennter Fußgänger-/Fahrzeugnavigation, Einbahnstraßen, Fahrverboten und Kreisverkehrsrichtungen.
- iPad-Touchsteuerung und installierbare Browser-PWA.

## Grenzen

FUNKSPRUCH bleibt eine öffentliche Beta und ist keine vollständig veröffentlichungsreife Version 1.0.
Die Open-World-Karte umfasst bislang nur einen Teil von Augsburg.
Einige Gebäude, KI-Reaktionen, Verkehrsabläufe und Anfahrtszeiten sind simulierte Näherungen.
Es gibt **keine** Verbindung zu echten Notrufen oder BOS-Funkstellen.
Ein Test auf einem physischen iPad steht noch aus; die automatische iPad-Browseremulation wurde bestanden.
Spielstände werden lokal gespeichert.

NORDTAL ATC bleibt am bisherigen Hauptpfad des Repositories erreichbar.
FUNKSPRUCH wird getrennt unter `/funkspruch/` veröffentlicht.

## Beta-Bedienung und Fehlerbehebung (19.11.2026)

Entwicklungsstand: `9f3071bf3f45785dd6ed7b75a2f6dd463787bd4c`.

- Aufklappbare Schritt-für-Schritt-Hilfe für den Schichtbeginn und den Arbeitsplatz.
- Lokale Speicherstatusanzeige sowie verständliche Meldung bei Speicherproblemen.
- Technischen Fehlerbericht lokal als JSON exportieren (keine automatische Übertragung, keine Gesprächsinhalte).
- Lokale Spielstände nach ausdrücklicher Bestätigung zurücksetzen; zuvor wird ein Export empfohlen.
- Fehlerbehandlung bei beschädigten Spielständen und fehlgeschlagenem Spielstart.
- Zusätzliche Browser-Abnahmetests für die Beta-Bedienelemente.

Diese Beta enthält weiterhin einen geografisch begrenzten Ausschnitt und simulierte KI-/Einsatzabläufe. Sie ist keine vollumfängliche 1.0.

## Release-Qualitätsrunde: Spielstand und Nachtschicht (19.11.2026)

Verifizierter Entwicklungsstand: `f798dbeb8337387e578b8730e745870390ea8db7`.

- Nachtschichten und Funkereignisse über Mitternacht bleiben chronologisch und in der Dauer korrekt.
- Beschädigte lokale Dienstwerte werden beim Laden validiert.
- Spielstandimport ersetzt alte, nicht zur Sicherung gehörende FUNKSPRUCH-Daten vollständig und rollt bei Speicherfehlern zurück; fremde Browserdaten und OSM-Cache bleiben erhalten.
- Automatische Browser-, Tablet-, Einsatzleitstellen- und Windows-Installations-/Starttests erfolgreich: https://github.com/HanniballGaming/ATC/actions/runs/44561214575

Release-Qualität der gesamten Simulation ist damit noch nicht bewiesen; die Abnahme belegt die getesteten Kernpfade.

## Stabilitätsaktualisierung (19.11.2026)

Geprüfter Entwicklungsstand: `8b672e381dab64233108955c9e7c9eb18ef405e2`.

- Beim Wiederaufnehmen wird ein noch aktives Journal einer bereits beendeten Schicht automatisch abgeschlossen; die nächste Schicht ist nicht blockiert.
- Defekte aktive Journalstrukturen werden beim Laden verworfen; fehlerhafte abgeschlossene Einträge werden herausgefiltert.
- Zusätzliche automatisierte Tests prüfen unterbrochene Schichten und beschädigte Journalstände.
- Browser- und Windows-Testjobs erfolgreich: https://github.com/HanniballGaming/ATC/actions/runs/44627829504

Diese Aktualisierung ist weiterhin eine Beta. Eine vollständige 1.0-Abnahme und Erweiterung aller ursprünglich geplanten Inhalte steht aus.

## Größere Stabilitäts- und Spielweltrunde (19.11.2026)

**Automatisch erfolgreich abgenommener Entwicklungsstand:** `b6612c8fea9a227938bf9d1958230e76b5668fe1`.

- Einstellungen für Grafik, Umgebungsgeräusche und Kollegenstimmen sind pro Gerät dauerhaft gespeichert.
- Welt- und Schichtdaten werden zusammen in einem neuen, rückwärtskompatiblen Speicherformat gesichert.
- Automatische Sicherungsrotation mit vorheriger Version; beschädigte aktuelle Welt-Spielstände können aus der zweiten Generation wiederhergestellt werden.
- KI-Straßenverkehr hält Abstand zu vorausfahrenden Fahrzeugen anstelle von Überlappung.
- Dekorative Straßenlaternen und Bäume werden aus kartierten OSM-Straßensegmenten abgeleitet und bei Gebäudekollisionen ausgelassen. Frühere künstliche Parkplatzreihen sind entfernt.
- Automatische Grafikqualität passt bei anhaltenden FPS-Abweichungen Pixelauflösung und Kartensichtweite an. Manuelle Grafikprofile bleiben fest.
- Arbeitsplatz-Monitor besitzt einen eigenen Menüausstieg für Maus und Tablet-Touch.
- Beim Export wird ein fehlgeschlagenes Speichern gemeldet, statt stillschweigend einen möglicherweise veralteten Stand auszugeben.
- Zusätzliche Browser-, Mobil-, Integrations- und Windows-Regressionstests, inklusive längerem Weg über Dienstbeginn, KI-Notruf, Alarmierung, Funk und Dienstende.

**Prüfnachweis:** https://github.com/HanniballGaming/ATC/actions/runs/44631522925 – Browser und Windows einschließlich Installationspaket erfolgreich.

**Status:** weiterhin öffentlich spielbare Beta; nicht als vollständig abgenommene Releaseversion 1.0 zu verstehen. Der OSM-Ausschnitt ist begrenzt, KI und 3D-Grafik erreichen noch nicht alle geplanten Qualitätsziele. Es erfolgte kein physischer iPad-Test.
