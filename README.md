# Testspielplaner

Planungstool des 1. SC 1911 e.V. Heilbad Heiligenstadt für **Testspiele und
Leistungsvergleiche**: Trainer reservieren sich konkrete Platz-Termine (auch
ohne feststehenden Gegner), ein Admin genehmigt, der Gegner wird nachgetragen.

## Funktionen

- **Slot-Suche über einen Zeitraum** („Montag bis Donnerstag ginge") — freie
  Lücken je Platz und Tag als klickbare Vorschläge, inklusive read-only
  Abgleich mit dem Trainings-Wochenplan der Platzbelegung-App.
- **Testspiel**: Datum, Uhrzeit, Platz, Feldgröße (Großfeld / verkürztes
  Großfeld / Halbfeld), Gegner optional.
- **Leistungsvergleich**: zusätzlich Anzahl Spiele und Minuten pro Spiel.
- **Genehmigungs-Workflow**: angefragt → genehmigt/abgelehnt (Admin) →
  vereinbart (Trainer trägt Gegner ein) bzw. freigegeben (Platz wieder frei).
- **Saison-Kontingent** je Trainer (01.07.–30.06., admin-einstellbar).
- **Erinnerung**, wenn ein genehmigter Termin in den nächsten 14 Tagen noch
  keinen Gegner hat.
- Plätze admin-editierbar (Name, aktiv, Feldgrößen, Platzbelegung-Zuordnung).

## Architektur

Vanilla-JS-App ohne Build-Step. Anmeldung und Speicherung laufen über das
zentrale Login-Gateway der
[Tools-Übersicht](https://tecko1985.github.io/ToolsUebersicht/)
(Cloudflare Worker → Vereins-Nextcloud, eine JSON-Datei). Kein Passwort und
keine Zugangsdaten auf dem Gerät.
