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
    version: "1.0",
    groups: [
      {
        title: "Testspiel anfragen",
        items: [
          "Testspiele und Leistungsvergleiche als konkreten Termin anfragen: Datum, Uhrzeit, Platz und Feldgröße — Großfeld, verkürztes Großfeld oder Halbfeld.",
          "Der Gegner ist beim Anfragen freiwillig und lässt sich nach der Genehmigung nachtragen.",
          "Bei Leistungsvergleichen kommen Anzahl der Spiele und Minuten je Spiel dazu.",
          "Überschneidet sich die Anfrage mit einer bestehenden Reservierung desselben Platzes, warnt die App.",
          "Je Trainer gibt es ein Saison-Kontingent für Testspiele und Leistungsvergleiche zusammen; die Saison läuft vom 1. Juli bis 30. Juni. Der eigene Verbrauch steht sichtbar dabei.",
          "Hat ein genehmigter Termin 14 Tage vorher noch keinen Gegner, erinnert das Werkzeug daran — im Tool und auf dem Dashboard der Tools-Übersicht. Dann heißt es: Gegner eintragen oder Platz freigeben."
        ]
      },
      {
        title: "Genehmigen",
        items: [
          "Jede Anfrage muss genehmigt oder abgelehnt werden, eine Ablehnung mit Kommentar.",
          "Genehmigt wird erst, wenn beides bestätigt ist: das Spiel ist im DFBnet eingetragen und der Platz ist reserviert. Dafür gibt es zwei Haken je Anfrage.",
          "Sobald der Gegner feststeht, setzt der anfragende Trainer die Reservierung selbst auf „vereinbart“.",
          "Alle Reservierungen lassen sich nach Status filtern und als Text oder PDF ausgeben."
        ]
      },
      {
        title: "Plätze und Freigaben",
        items: [
          "Plätze sind pflegbar: Name, aktiv oder stillgelegt, und welche Feldgrößen sie anbieten.",
          "Trainer-Freigaben als aufklappbare Liste: je Trainer ein Häkchen „darf anfragen“ und ein eigenes Saison-Kontingent.",
          "Wer nicht freigeschaltet ist, sieht im Reiter „Planen“ statt des Formulars einen Hinweis.",
          "Wer in der Tools-Übersicht die Stufe „Administrieren“ für dieses Werkzeug hat, darf immer anfragen — ohne eigene Freigabe-Zeile."
        ]
      },
      {
        title: "Wer darf was",
        items: [
          "Sehen: die Reservierungen, schreibgeschützt.",
          "Bearbeiten: Anfragen stellen (sofern freigegeben), Anfragen genehmigen und ablehnen, Reservierungen exportieren.",
          "Administrieren: zusätzlich Plätze, Trainer-Freigaben und Kontingente im Reiter „Einstellungen“.",
          "Der Reiter „Info“ ist für alle sichtbar."
        ]
      },
      {
        title: "Bedienung am Handy",
        items: [
          "Die Reiterleiste bricht am Handy um, statt seitlich aus dem Bild zu laufen — auch die hinteren Reiter sind auf schmalen Bildschirmen erreichbar.",
          "Eingabefelder sind mindestens 16 Pixel groß, damit der iPhone-Browser beim Antippen nicht ungefragt in die Seite hineinzoomt und verschoben stehen bleibt."
        ]
      },
      {
        title: "Daten & Speicherung",
        items: [
          "Gespeichert wird in der Vereins-Nextcloud über die zentrale Anmeldung der Tools-Übersicht — ein eigenes Passwort braucht es nicht."
        ]
      }
    ]
  }
];
