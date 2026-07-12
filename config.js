const APP_VERSION = "1.0";

// Feldgrößen, die eine Anfrage anfordern kann. Welche davon ein Platz anbietet,
// steuert der Admin je Platz in den Einstellungen (Slot-Suche filtert danach).
const FELDGROESSEN = [
  { id: "grossfeld", label: "Großfeld" },
  { id: "verkuerztes-grossfeld", label: "Verkürztes Großfeld" },
  { id: "halbfeld", label: "Halbfeld" }
];

// Startliste der Plätze — greift nur bei komplett leerem plaetze-Array;
// danach zählt ausschließlich der Stand in der Nextcloud-JSON
// (Admin-editierbar im Einstellungen-Tab).
const DEFAULT_PLAETZE = [
  { id: "kunstrasen",  name: "Kunstrasen",  aktiv: true, feldgroessen: ["grossfeld", "verkuerztes-grossfeld", "halbfeld"] },
  { id: "stelzenberg", name: "Stelzenberg", aktiv: true, feldgroessen: ["grossfeld", "verkuerztes-grossfeld", "halbfeld"] },
  { id: "rengelrode",  name: "Rengelrode",  aktiv: true, feldgroessen: ["grossfeld", "verkuerztes-grossfeld", "halbfeld"] },
  { id: "kalteneber",  name: "Kalteneber",  aktiv: true, feldgroessen: ["grossfeld", "verkuerztes-grossfeld", "halbfeld"] },
  { id: "guenterode",  name: "Günterode",   aktiv: true, feldgroessen: ["grossfeld", "verkuerztes-grossfeld", "halbfeld"] }
];

// Diese Status blockieren einen Platz UND zählen ins Saison-Kontingent.
const BLOCKIERENDE_STATUS = ["angefragt", "genehmigt", "vereinbart"];

// Reminder: genehmigte Reservierungen ohne Gegner so viele Tage vor dem Termin
// anmahnen (muss mit my-testspielplaner-status im admin-worker.js übereinstimmen).
const REMINDER_TAGE = 14;

const APP_CHANGELOG = [
  {
    version: "1.4",
    groups: [
      {
        title: "Bearbeiten-Recht",
        items: [
          "Genehmigen/Ablehnen, DFBnet-Haken, Löschen und Einstellungen jetzt an das Bearbeiten-Recht der Gruppen-Verwaltung gekoppelt, nicht mehr an Admin-Status allein. Eigene Anfrage stellen/zurückziehen/Gegner eintragen bleibt für jeden freigeschalteten Trainer unverändert."
        ]
      }
    ]
  },
  {
    version: "1.3",
    groups: [
      {
        title: "Verwaltung & Einstellungen (nur Admins)",
        items: [
          "Trainer-Freigaben statt einem globalen Kontingent: aufklappbare Liste aller Trainer, je Checkbox „darf anfragen“ + eigenes Saison-Kontingent. Nicht freigeschaltete Trainer sehen im Planen-Tab statt des Formulars einen Hinweis."
        ]
      }
    ]
  },
  {
    version: "1.2",
    groups: [
      {
        title: "Verwaltung & Einstellungen (nur Admins)",
        items: [
          "Genehmigung erst möglich, wenn der Admin bestätigt hat, dass Spiel und Platz im DFBnet eingetragen bzw. reserviert sind (zwei Haken pro Anfrage)."
        ]
      }
    ]
  },
  {
    version: "1.0",
    groups: [
      {
        title: "Planen",
        items: [
          "Testspiele und Leistungsvergleiche als konkreten Termin anfragen: Datum, Uhrzeit, Platz, Feldgröße (Großfeld / verkürztes Großfeld / Halbfeld), Gegner optional — der Gegner kann nach der Genehmigung nachgetragen werden.",
          "Leistungsvergleiche zusätzlich mit Anzahl Spiele und Minuten pro Spiel.",
          "Warnung bei Überschneidung mit bestehenden Reservierungen desselben Platzes.",
          "Saison-Kontingent je Trainer (Testspiele + Leistungsvergleiche zusammen, Saison 01.07.–30.06.), mit Anzeige des eigenen Verbrauchs.",
          "Erinnerung im Tool und auf dem Dashboard, wenn ein genehmigter Termin in den nächsten 14 Tagen noch keinen Gegner hat — Gegner eintragen oder Platz freigeben."
        ]
      },
      {
        title: "Verwaltung & Einstellungen (nur Admins)",
        items: [
          "Jede Anfrage muss von einem Admin genehmigt oder abgelehnt werden (mit Kommentar); Genehmigte Reservierungen werden vom Trainer selbst auf „vereinbart“ gesetzt, sobald der Gegner feststeht.",
          "Alle Reservierungen filterbar nach Status, Export als Text oder PDF.",
          "Plätze admin-editierbar: Name, aktiv/inaktiv, angebotene Feldgrößen.",
          "Kontingent pro Trainer und Saison zentral einstellbar."
        ]
      }
    ]
  }
];
