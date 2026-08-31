# ⚽ Testspielplaner

Wer will wann welchen Platz für ein Testspiel oder einen Leistungsvergleich.
Trainerinnen und Trainer fragen an, die Verwaltung gibt frei — und behält dabei
im Blick, dass das Kontingent nicht überzogen wird.

**➡️ [Testspielplaner öffnen](https://sc1911heiligenstadt.github.io/testspielplaner/)**

## Wie es gedacht ist

1. Unter **Planen** wird eine **neue Anfrage** gestellt: Datum, **von–bis**,
   **Platz**, **Art**, **Feldgröße**, **Anzahl Spiele** und **Minuten pro
   Spiel**; Gegner und Notiz sind freiwillig.
2. Die Anfrage erscheint in der **Verwaltung** und wird dort entschieden.
3. Was freigegeben ist, steht unter **Meine Reservierungen** und lässt sich
   exportieren.

## Was drin ist

| Reiter | Wofür |
|---|---|
| **Planen** | Neue Anfrage stellen, eigene Reservierungen ansehen |
| **Verwaltung** | Reservierungen entscheiden und verwalten, Export |
| **Einstellungen** | Kontingent und Grundeinstellungen |

## Das Kontingent

Je Saison lässt sich ein **Kontingent** hinterlegen — wie viele Testspiele eine
Person anfragen darf. Die App zeigt dabei laufend, wie viel davon verbraucht
ist, und lehnt eine Anfrage ab, sobald das Kontingent erschöpft ist. Bleibt das
Feld leer, gilt kein Limit.

## Zugang

Die Anmeldung läuft über die [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) — dort einmal anmelden, danach ist dieses Werkzeug offen.

Die Rechte gelten in drei Stufen: **Sehen** (Reservierungen ansehen),
**Bearbeiten** (Anfragen stellen) und **Administrieren** (Reiter *Verwaltung*
und *Einstellungen*: freigeben, Kontingent). Wer welche Stufe hat, legt die
Tools-Übersicht fest.

## Lokal starten

Über den Eintrag `testspielplaner` in `E:\.claude\launch.json` — der Server läuft dann auf `http://localhost:8785/`.

## Technik

Vanilla JavaScript ohne Build-Schritt — die Dateien werden so ausgeliefert, wie sie im Repo liegen. Veröffentlicht über GitHub Pages. Die Daten liegen in der Vereins-Nextcloud; der Zugriff läuft ausschließlich über den Login-Worker der Tools-Übersicht, nie mit Zugangsdaten im Browser.

Die `db.js` dieser App ist zugleich die **Vorlage** für den Wellen-Merker, mit
dem alle Werkzeuge der Familie beim Start mit einer einzigen Gateway-Anfrage
auskommen.

---

Ein Werkzeug des 1. SC 1911 Heiligenstadt. Alle Werkzeuge auf einen Blick: [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) · Erklärungen im [Toolbox Wiki](https://sc1911heiligenstadt.github.io/Vereinswiki/).
