const APP_VERSION = "1.0";

// Feldgrößen, die eine Anfrage anfordern kann. Welche davon ein Platz anbietet,
// steuert der Admin je Platz in den Einstellungen (Slot-Suche filtert danach).
const FELDGROESSEN = [
  { id: "grossfeld", label: "Großfeld" },
  { id: "verkuerztes-grossfeld", label: "Verkürztes Großfeld" },
  { id: "halbfeld", label: "Halbfeld" }
];

// Startliste der Plätze — greift nur bei komplett leerem plaetze-Array (wie
// DEFAULT_PLAETZE in der Platzbelegung-App); danach zählt ausschließlich der
// Stand in der Nextcloud-JSON (Admin-editierbar im Einstellungen-Tab).
// platzbelegungIds = Teilplatz-Ids aus der Platzbelegung-App, deren Trainings-
// belegungen diesen (gröberen) Platz blockieren. Achtung, zwei Namensräume:
// die EIGENE Platz-Id "kunstrasen" ist NICHT dieselbe wie die Platzbelegung-
// Teilplatz-Id "kunstrasen" (dort = "KuRa Rechts").
const DEFAULT_PLAETZE = [
  { id: "kunstrasen",  name: "Kunstrasen",  aktiv: true, feldgroessen: ["grossfeld", "verkuerztes-grossfeld", "halbfeld"], platzbelegungIds: ["parkplatz", "kunstrasen"] },
  { id: "stelzenberg", name: "Stelzenberg", aktiv: true, feldgroessen: ["grossfeld", "verkuerztes-grossfeld", "halbfeld"], platzbelegungIds: ["stelzenberg-vorne", "stelzenberg"] },
  { id: "rengelrode",  name: "Rengelrode",  aktiv: true, feldgroessen: ["grossfeld", "verkuerztes-grossfeld", "halbfeld"], platzbelegungIds: ["rengelrode-l", "rengelrode-r"] },
  { id: "kalteneber",  name: "Kalteneber",  aktiv: true, feldgroessen: ["grossfeld", "verkuerztes-grossfeld", "halbfeld"], platzbelegungIds: ["kalteneber-l", "kalteneber-r"] },
  { id: "guenterode",  name: "Günterode",   aktiv: true, feldgroessen: ["grossfeld", "verkuerztes-grossfeld", "halbfeld"], platzbelegungIds: ["guenterode-l", "guenterode-r"] }
];

// Diese Status blockieren Slots in der Suche UND zählen ins Saison-Kontingent.
const BLOCKIERENDE_STATUS = ["angefragt", "genehmigt", "vereinbart"];

// Slot-Suche: kürzere freie Lücken werden nicht als Vorschlag angeboten.
const MIN_SLOT_MIN = 60;
// Maximale Zeitraum-Länge der Slot-Suche in Tagen.
const SUCHE_MAX_TAGE = 14;
// Vorbelegung des Uhrzeit-Fensters der Slot-Suche.
const SUCHFENSTER_START = "08:00";
const SUCHFENSTER_ENDE = "20:00";
// Reminder: genehmigte Reservierungen ohne Gegner so viele Tage vor dem Termin
// anmahnen (muss mit my-testspielplaner-status im admin-worker.js übereinstimmen).
const REMINDER_TAGE = 14;

const APP_CHANGELOG = [
  {
    version: "1.0",
    groups: [
      {
        title: "Planen",
        items: [
          "Testspiele und Leistungsvergleiche als konkreten Termin anfragen: Datum, Uhrzeit, Platz, Feldgröße (Großfeld / verkürztes Großfeld / Halbfeld), Gegner optional — der Gegner kann nach der Genehmigung nachgetragen werden.",
          "Leistungsvergleiche zusätzlich mit Anzahl Spiele und Minuten pro Spiel.",
          "Slot-Suche über einen Zeitraum (z. B. Montag bis Donnerstag): freie Lücken je Platz und Tag als klickbare Vorschläge, inkl. read-only Abgleich mit dem Trainings-Wochenplan der Platzbelegung.",
          "Saison-Kontingent je Trainer (Testspiele + Leistungsvergleiche zusammen, Saison 01.07.–30.06.), mit Anzeige des eigenen Verbrauchs.",
          "Erinnerung im Tool und auf dem Dashboard, wenn ein genehmigter Termin in den nächsten 14 Tagen noch keinen Gegner hat — Gegner eintragen oder Platz freigeben."
        ]
      },
      {
        title: "Verwaltung & Einstellungen (nur Admins)",
        items: [
          "Jede Anfrage muss von einem Admin genehmigt oder abgelehnt werden (mit Kommentar); Genehmigte Reservierungen werden vom Trainer selbst auf „vereinbart“ gesetzt, sobald der Gegner feststeht.",
          "Alle Reservierungen filterbar nach Status, Export als Text oder PDF.",
          "Plätze admin-editierbar: Name, aktiv/inaktiv, angebotene Feldgrößen und Zuordnung zu den Trainings-Teilplätzen der Platzbelegung.",
          "Kontingent pro Trainer und Saison zentral einstellbar."
        ]
      }
    ]
  }
];
