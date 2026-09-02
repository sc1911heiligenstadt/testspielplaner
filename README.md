# ⚽ Testspielplaner

Wer will wann welchen Platz für ein Testspiel oder einen Leistungsvergleich.
Trainerinnen und Trainer fragen an, die Verwaltung gibt frei — und behält dabei
im Blick, dass das Kontingent nicht überzogen wird.

**➡️ [Testspielplaner öffnen](https://sc1911heiligenstadt.github.io/testspielplaner/)**

## Wie es gedacht ist

1. Unter **Planen** wird eine **neue Anfrage** gestellt: **Art** (Testspiel oder
   Leistungsvergleich), Datum, **von–bis**, **Platz** und **Feldgröße**; bei
   Leistungsvergleichen zusätzlich **Anzahl Spiele** und **Minuten pro Spiel**.
   Gegner und Notiz sind freiwillig, die Mannschaft kommt aus dem Trainerprofil.
2. Kollidiert der Wunschtermin mit einer bestehenden Reservierung desselben
   Platzes, warnt die App noch vor dem Absenden.
3. Die Anfrage erscheint in der **Verwaltung** und wird dort entschieden — eine
   Ablehnung mit Kommentar. Genehmigt wird erst, wenn **beide DFBnet-Haken**
   gesetzt sind: Spiel eingetragen und Platz reserviert.
4. Was freigegeben ist, steht unter **Meine Reservierungen**. Dort trägt der
   Trainer den **Gegner** nach — damit wird die Reservierung *vereinbart* — oder
   er **gibt den Platz frei**, wenn der Termin doch nicht gebraucht wird.

Eine Reservierung trägt eines von fünf Kennzeichen: *Angefragt*, *Genehmigt*,
*Vereinbart*, *Abgelehnt* und *Freigegeben*. Nur die ersten drei blockieren
einen Platz und zählen gegen das Kontingent. Eine noch nicht entschiedene
Anfrage lässt sich **zurückziehen**.

Hat ein genehmigter Termin **14 Tage vorher noch keinen Gegner**, erinnert das
Werkzeug daran — im Tool und auf dem Dashboard der Tools-Übersicht.

## Was drin ist

| Reiter | Wofür |
|---|---|
| **Planen** | Neue Anfrage stellen, eigene Reservierungen ansehen und nachpflegen |
| **Verwaltung** | Reservierungen entscheiden, nach Status filtern, exportieren, löschen |
| **Einstellungen** | Plätze, Trainer-Freigaben und Kontingente, Benachrichtigungs-Verteiler |
| **Info** | Kurzbeschreibung, Änderungsliste und Datenschutzhinweis |

Der **Export** in der Verwaltung gibt als Text oder PDF genau das aus, was der
Statusfilter gerade zeigt.

## Plätze, Freigaben und das Kontingent

Plätze sind pflegbar: Name, aktiv oder stillgelegt, und welche **Feldgrößen**
sie anbieten (Großfeld, verkürztes Großfeld, Halbfeld) — davon hängt ab, welche
Plätze bei einer Anfrage überhaupt zur Auswahl stehen.

Anfragen darf nur, wer dafür **freigeschaltet** ist; wer es nicht ist, sieht
statt des Formulars einen Hinweis. Je Trainer lässt sich ein **Kontingent** pro
Saison hinterlegen — es zählt Testspiele und Leistungsvergleiche zusammen, die
Saison läuft vom 1. Juli bis 30. Juni. Die App zeigt laufend den eigenen
Verbrauch und lehnt eine Anfrage ab, sobald das Kontingent erschöpft ist. Bleibt
das Feld leer, gilt kein Limit. Wer die Stufe *Administrieren* hat, darf immer
anfragen.

## Benachrichtigung aufs Handy

Eine neue Anfrage meldet sich bei denen, die darüber entscheiden; ist
entschieden, bekommt der anfragende Trainer Bescheid. In den *Einstellungen*
lässt sich der Kreis der Benachrichtigten **verkleinern** — zur Auswahl stehen
nur Personen, die auch entscheiden dürfen. Nichts angehakt heißt: alle davon.
Eingeschaltet wird das in der Tools-Übersicht unter *Mein Konto*.

## Zugang

Die Anmeldung läuft über die [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) — dort einmal anmelden, danach ist dieses Werkzeug offen.

Die Rechte gelten in drei Stufen: **Sehen** (die eigenen Reservierungen ansehen),
**Bearbeiten** (anfragen, sofern freigeschaltet, zurückziehen, Gegner nachtragen,
Platz freigeben) und **Administrieren** (die Reiter *Verwaltung* und
*Einstellungen*: genehmigen, ablehnen, exportieren, löschen, Plätze und
Freigaben pflegen). Wer welche Stufe hat, legt die Tools-Übersicht fest. Der
Reiter *Info* ist für alle sichtbar.

## Lokal starten

Über den Eintrag `testspielplaner` in `E:\.claude\launch.json` — der Server läuft dann auf `http://localhost:8785/`.

## Technik

Vanilla JavaScript ohne Build-Schritt — die Dateien werden so ausgeliefert, wie sie im Repo liegen; ausgeliefert wird die einzelne Seite `index.html`. Veröffentlicht über GitHub Pages. Der PDF-Export entsteht über einen eigenen Druckbereich der Seite, ohne fremde Bibliothek. Die Daten liegen in der Vereins-Nextcloud; der Zugriff läuft ausschließlich über den Login-Worker der Tools-Übersicht, nie mit Zugangsdaten im Browser.

Die `db.js` dieser App ist zugleich die **Vorlage** für den Wellen-Merker, mit
dem alle Werkzeuge der Familie beim Start mit einer einzigen Gateway-Anfrage
auskommen.

---

Ein Werkzeug des 1. SC 1911 Heiligenstadt. Alle Werkzeuge auf einen Blick: [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) · Erklärungen im [Toolbox Wiki](https://sc1911heiligenstadt.github.io/Vereinswiki/).
