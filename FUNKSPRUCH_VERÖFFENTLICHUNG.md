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
