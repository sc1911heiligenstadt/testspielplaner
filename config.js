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
          "Testspiele und Leistungsvergleiche als konkreten Termin anfragen: Datum, Uhrzeit von und bis, Platz und Feldgröße — Großfeld, verkürztes Großfeld oder Halbfeld.",
          "Die Mannschaft kommt aus dem eigenen Trainerprofil. Wer mehrere betreut, wählt sie aus einer Liste.",
          "Der Gegner ist beim Anfragen freiwillig und lässt sich nach der Genehmigung nachtragen. Für Ansprechpartner oder Besonderheiten gibt es ein Notizfeld.",
          "Bei Leistungsvergleichen kommen Anzahl der Spiele und Minuten je Spiel dazu.",
          "Überschneidet sich die Anfrage mit einer bestehenden Reservierung desselben Platzes, warnt die App.",
          "Je Trainer gibt es ein Saison-Kontingent für Testspiele und Leistungsvergleiche zusammen; die Saison läuft vom 1. Juli bis 30. Juni. Der eigene Verbrauch steht sichtbar dabei.",
          "Eine noch nicht entschiedene Anfrage lässt sich zurückziehen.",
          "Hat ein genehmigter Termin 14 Tage vorher noch keinen Gegner, erinnert das Werkzeug daran — im Tool und auf dem Dashboard der Tools-Übersicht. Dann heißt es: Gegner eintragen oder Platz freigeben."
        ]
      },
      {
        title: "Der Weg einer Reservierung",
        items: [
          "Eine Reservierung trägt eines von fünf Kennzeichen: „Angefragt“, „Genehmigt“, „Vereinbart“, „Abgelehnt“ und „Freigegeben“.",
          "Sobald der Gegner feststeht, setzt der anfragende Trainer die Reservierung selbst auf „vereinbart“.",
          "Wird ein genehmigter oder vereinbarter Termin doch nicht gebraucht, gibt der Trainer den Platz frei — er steht dann wieder für andere zur Verfügung und zählt nicht mehr gegen das Kontingent.",
          "Nur angefragte, genehmigte und vereinbarte Termine blockieren einen Platz."
        ]
      },
      {
        title: "Genehmigen",
        items: [
          "Jede Anfrage muss genehmigt oder abgelehnt werden, eine Ablehnung mit Kommentar.",
          "Genehmigt wird erst, wenn beides bestätigt ist: das Spiel ist im DFBnet eingetragen und der Platz ist reserviert. Dafür gibt es zwei Haken je Anfrage.",
          "Alle Reservierungen lassen sich nach Status filtern und als Text oder PDF ausgeben — ausgegeben wird genau das, was der Filter gerade zeigt.",
          "Eine Reservierung lässt sich endgültig löschen, wenn sie gar nicht erst hätte entstehen sollen."
        ]
      },
      {
        title: "Plätze und Freigaben",
        items: [
          "Plätze sind pflegbar: Name, aktiv oder stillgelegt, und welche Feldgrößen sie anbieten.",
          "Trainer-Freigaben als aufklappbare Liste: je Trainer ein Häkchen „darf anfragen“ und ein eigenes Saison-Kontingent. Bleibt das Kontingent leer, gilt kein Limit.",
          "Wer nicht freigeschaltet ist, sieht im Reiter „Planen“ statt des Formulars einen Hinweis.",
          "Wer in der Tools-Übersicht die Stufe „Administrieren“ für dieses Werkzeug hat, darf immer anfragen — ohne eigene Freigabe-Zeile."
        ]
      },
      {
        title: "Benachrichtigung aufs Handy",
        items: [
          "Eine neue Anfrage meldet sich bei denen, die darüber entscheiden, statt in der Verwaltung auf jemanden zu warten.",
          "Ist über eine Anfrage entschieden worden, bekommt der anfragende Trainer eine Nachricht aufs Handy.",
          "Die Nachricht nennt keine Namen und kein Ergebnis — sie steht auf dem Sperrbildschirm. Was entschieden wurde, sieht man nach dem Antippen.",
          "Eingeschaltet wird das in der Tools-Übersicht unter „Mein Konto“, einzeln für dieses Werkzeug. Wer es nicht einschaltet, merkt keinen Unterschied.",
          "Wird eine Anfrage aus einem anderen Grund nicht gespeichert (fehlende Freigabe, erschöpftes Kontingent, fehlende DFBnet-Haken), geht auch keine Nachricht raus.",
          "Im Reiter „Einstellungen“ steht die aufklappbare Liste „Wer wird über neue Anfragen benachrichtigt“. Zur Auswahl stehen nur Personen, die eine Anfrage auch entscheiden dürfen — ein Haken bei jemand anderem hätte nichts bewirkt.",
          "Solange nichts angehakt ist, werden alle Entscheidenden benachrichtigt. Unter der Liste steht, was der aktuelle Stand bedeutet. Die Auswahl kann den Kreis nur verkleinern; wer sein Bearbeiten-Recht verliert, bekommt automatisch keine Meldung mehr.",
          "Die Rückmeldung an den anfragenden Trainer ist davon nicht betroffen: die geht immer an ihn."
        ]
      },
      {
        title: "Wer darf was",
        items: [
          "Sehen: die eigenen Reservierungen, schreibgeschützt.",
          "Bearbeiten: Anfragen stellen, sofern man dafür freigeschaltet ist, eigene Anfragen zurückziehen, den Gegner nachtragen und einen Platz wieder freigeben.",
          "Administrieren: die Reiter „Verwaltung“ und „Einstellungen“ — genehmigen, ablehnen, exportieren, löschen sowie Plätze, Trainer-Freigaben und Kontingente pflegen.",
          "Der Reiter „Info“ ist für alle sichtbar. Dort stehen eine Kurzbeschreibung, diese Änderungsliste und der Datenschutzhinweis des Vereins."
        ]
      },
      {
        title: "Bedienung am Handy",
        items: [
          "Die Reiterleiste bricht am Handy um, statt seitlich aus dem Bild zu laufen — auch die hinteren Reiter sind auf schmalen Bildschirmen erreichbar.",
          "Eingabefelder sind groß genug, dass der iPhone-Browser beim Antippen nicht ungefragt in die Seite hineinzoomt."
        ]
      },
      {
        title: "Daten & Speicherung",
        items: [
          "Gespeichert wird in der Vereins-Nextcloud über die zentrale Anmeldung der Tools-Übersicht — ein eigenes Passwort braucht es nicht.",
          "Ändern zwei Leute gleichzeitig denselben Stand, lädt die App den fremden Stand nach und trägt die eigene Änderung noch einmal ein."
        ]
      }
    ]
  }
];
