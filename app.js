let appData = { einstellungen: { trainerZugriff: {} }, plaetze: [], reservierungen: [] };
let currentUsername = null;
let currentIsAdmin = false;
let currentCanAdmin = false; // Administrieren-Stufe für dieses Tool (dritte Rechte-Stufe der Tools-Übersicht) — zählt beim darfAnfragen-Bypass wie ein Admin
let currentCanEdit = false;
let currentVorname = null;
let currentNachname = null;
let currentMannschaften = [];

function canEdit() { return currentIsAdmin || currentCanEdit; }
let currentStatusFilter = "alle";
// Trainer-Verzeichnis für die Freigabeliste in Einstellungen — lazy geladen
// beim ersten Öffnen des Tabs, danach für die Session gecacht.
let trainerDirectory = null;
// Wer eine Anfrage entscheiden darf (Bearbeiten- oder Administrieren-Recht) —
// die Auswahlliste für die Push-Verteilung, ebenfalls lazy + gecacht.
let entscheiderDirectory = null;

const RESERVIERUNG_STATUS = [
  { id: "angefragt", label: "Angefragt" },
  { id: "genehmigt", label: "Genehmigt" },
  { id: "vereinbart", label: "Vereinbart" },
  { id: "abgelehnt", label: "Abgelehnt" },
  { id: "freigegeben", label: "Freigegeben" }
];

// ---------- Helpers ----------

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("de-DE") + ", " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr";
}

function isoToDisplay(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function localDateIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "YYYY-MM-DD" als LOKALES Datum parsen — new Date("YYYY-MM-DD") wäre UTC und
// verschiebt den Wochentag je nach Zeitzone.
function dateFromIso(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dateToIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoPlusTage(iso, tage) {
  const d = dateFromIso(iso);
  d.setDate(d.getDate() + tage);
  return dateToIso(d);
}

function timeToMin(t) {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minToTime(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Saison-Schlüssel zum Spieldatum, z. B. "2026/27" (Saison = 01.07.–30.06.).
function saisonKeyOf(dateIso) {
  if (!dateIso || !/^\d{4}-\d{2}/.test(dateIso)) return null;
  const [y, m] = dateIso.split("-").map(Number);
  const start = m >= 7 ? y : y - 1;
  return start + "/" + String((start + 1) % 100).padStart(2, "0");
}

function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "txxxxxxxx".replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));
}

function download(filename, type, content) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// Fallback, falls der Gateway (noch) kein vorname/nachname liefert.
function deriveNameFromUsername(username) {
  const parts = String(username || "").split(".");
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  return { vorname: cap(parts[0] || ""), nachname: cap(parts.slice(1).join(" ") || "") };
}

// ---------- Normalisierung & Lookups ----------

function normalizeAppData(data) {
  const d = data && typeof data === "object" ? data : {};
  if (!d.einstellungen || typeof d.einstellungen !== "object") d.einstellungen = {};
  if (!d.einstellungen.trainerZugriff || typeof d.einstellungen.trainerZugriff !== "object") {
    d.einstellungen.trainerZugriff = {};
  }
  // Verteiler für die Push-Meldung bei neuen Anfragen. LEER heißt bewusst
  // „alle Berechtigten“ (heutiges Verhalten), nicht „niemand“ — ein still
  // ausbleibendes Push würde sonst niemandem auffallen. Der Worker legt die
  // Liste nur als Filter über die Bearbeitenden, sie kann den Kreis also nie
  // erweitern.
  if (!Array.isArray(d.einstellungen.pushEmpfaenger)) d.einstellungen.pushEmpfaenger = [];
  if (!Array.isArray(d.plaetze) || !d.plaetze.length) {
    d.plaetze = DEFAULT_PLAETZE.map((p) => ({ ...p, feldgroessen: p.feldgroessen.slice() }));
  }
  if (!Array.isArray(d.reservierungen)) d.reservierungen = [];
  return d;
}

function aktivePlaetze() { return appData.plaetze.filter((p) => p.aktiv !== false); }
function platzById(id) { return appData.plaetze.find((p) => p.id === id) || null; }
function platzName(id) { const p = platzById(id); return p ? p.name : (id || ""); }

function statusLabel(status) {
  const s = RESERVIERUNG_STATUS.find((x) => x.id === status);
  return s ? s.label : (status || "");
}

function statusBadgeHtml(status) {
  return `<span class="status-badge status-${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span>`;
}

function typLabel(typ) {
  return typ === "leistungsvergleich" ? "Leistungsvergleich" : "Testspiel";
}

function feldgroesseLabel(id) {
  const f = FELDGROESSEN.find((x) => x.id === id);
  return f ? f.label : (id || "");
}

function trainerName(r) {
  return (r.vorname || r.nachname) ? `${r.vorname || ""} ${r.nachname || ""}`.trim() : r.erstelltVon;
}

// Kurzbeschreibung eines Termins ("Sa, 25.07.2026 · 14:00–16:00 · Kunstrasen").
function terminText(r) {
  const zeit = (r.von || r.bis) ? ` · ${r.von || "?"}–${r.bis || "?"}` : "";
  return `${isoToDisplay(r.datum)}${zeit} · ${platzName(r.platzId)}`;
}

function lvDetailText(r) {
  if (r.typ !== "leistungsvergleich") return "";
  return `${r.anzahlSpiele || "?"} Spiele × ${r.minutenProSpiel || "?"} Min`;
}

// ---------- Speichern mit Konflikt-Retry ----------

// Wendet mutate() auf appData an und speichert. Bei Konflikt (409) wird der aktuelle
// Remote-Stand nachgeladen und dieselbe Mutation erneut angewendet, bevor erneut
// gespeichert wird. Guards gehören deshalb IN die Mutation.
async function saveWithConflictRetry(mutate) {
  mutate(appData);
  try {
    await gatewaySave(appData);
  } catch (e) {
    if (!(e instanceof ConflictError)) throw e;
    const data = await gatewayLoad();
    appData = normalizeAppData(data);
    mutate(appData);
    await gatewaySave(appData);
  }
}

// ---------- Trainer-Freigabe & Kontingent ----------

// Gewählter Verteiler für die Push-Meldung bei neuen Anfragen. Leer = alle
// Berechtigten (die Entscheidung dazu fällt im Worker, hier steht nur der Wert).
function pushEmpfaengerListe(data) {
  const v = data.einstellungen ? data.einstellungen.pushEmpfaenger : null;
  return Array.isArray(v) ? v : [];
}

// Freigabe-Eintrag eines Trainers (nur vorhanden, wenn ein Admin ihn je gesetzt hat).
function trainerZugriffFor(data, username) {
  const z = data.einstellungen && data.einstellungen.trainerZugriff ? data.einstellungen.trainerZugriff[username] : null;
  return z && typeof z === "object" ? z : null;
}

// Fail-closed: ohne expliziten Eintrag darf ein Trainer nicht anfragen.
// Admins sind immer erlaubt (gleiche Konvention wie der Gateway-Bypass).
function darfAnfragen(data, username, isAdmin) {
  if (isAdmin) return true;
  const z = trainerZugriffFor(data, username);
  return !!(z && z.erlaubt);
}

function kontingentLimit(data, username) {
  const z = trainerZugriffFor(data, username);
  const v = z ? z.kontingent : null;
  return (typeof v === "number" && v > 0) ? v : null;
}

function verbrauchtesKontingent(data, username, saisonKey) {
  return data.reservierungen.filter((r) =>
    r.erstelltVon === username &&
    BLOCKIERENDE_STATUS.includes(r.status) &&
    saisonKeyOf(r.datum || "") === saisonKey
  ).length;
}

// ⚠️ Die Saison kommt aus dem GEWAEHLTEN Datum, nicht aus dem heutigen. Die
// Pruefung beim Absenden rechnet gegen saisonKeyOf(datum) -- einmal vor dem
// Speichern und einmal im mutate-Closure. Stand hier localDateIso(), zeigten
// Anzeige und Pruefung in der Sommerpause VERSCHIEDENE Saisons: die Anzeige
// meldete "5 von 5 verbraucht" und faerbte sich rot, waehrend die Anfrage fuer
// August gegen die neue Saison lief und anstandslos durchging (und umgekehrt).
// Die Saison springt am 1. Juli -- genau dann werden Testspiele geplant.
// Ohne gewaehltes Datum bleibt die laufende Saison die richtige Auskunft.
function renderKontingentInfo() {
  const el = document.getElementById("kontingent-info");
  const feld = document.getElementById("f-datum");
  const saison = saisonKeyOf(feld ? feld.value : "") || saisonKeyOf(localDateIso());
  const limit = kontingentLimit(appData, currentUsername);
  const verbraucht = verbrauchtesKontingent(appData, currentUsername, saison);
  // Die Einfaerbung in BEIDEN Zweigen setzen: die Funktion laeuft jetzt bei
  // jeder Datumsaenderung erneut, und ein einmal gesetztes Rot bliebe sonst
  // stehen, wenn ein Admin das Limit inzwischen entfernt hat.
  el.classList.toggle("kontingent-voll", limit != null && verbraucht >= limit);
  if (limit == null) {
    el.textContent = `Saison ${saison}: ${verbraucht} Reservierung${verbraucht === 1 ? "" : "en"} — kein Kontingent-Limit gesetzt.`;
  } else {
    el.textContent = `Kontingent Saison ${saison}: ${verbraucht} von ${limit} verbraucht.`;
  }
}

// ---------- Reminder-Banner ----------

// Muss inhaltlich mit my-testspielplaner-status im admin-worker.js übereinstimmen,
// damit Dashboard-Badge und Banner nie widersprechen.
function anstehendeOhneGegner() {
  const heute = localDateIso();
  const grenze = isoPlusTage(heute, REMINDER_TAGE);
  return appData.reservierungen.filter((r) =>
    r.erstelltVon === currentUsername && r.status === "genehmigt" &&
    !(r.gegner || "").trim() && (r.datum || "") >= heute && (r.datum || "") <= grenze
  );
}

function renderReminderBanner() {
  const el = document.getElementById("reminder-banner");
  const list = anstehendeOhneGegner();
  if (!list.length) { el.style.display = "none"; el.innerHTML = ""; return; }
  el.style.display = "block";
  el.innerHTML = `
    <strong>⚠ ${list.length} genehmigte Reservierung${list.length === 1 ? "" : "en"} in den nächsten ${REMINDER_TAGE} Tagen ohne Gegner</strong>
    <div class="muted" style="margin-top:4px;">${list.map((r) => escapeHtml(terminText(r))).join(" · ")}</div>
    <div class="muted" style="margin-top:4px;">Bitte unter „Meine Reservierungen“ den Gegner eintragen — oder den Platz freigeben, damit andere ihn nutzen können.</div>`;
}

// ---------- Überschneidungs-Prüfung ----------

// Belegte Blöcke eines Platzes an einem konkreten Datum: eigene Reservierungen
// mit blockierendem Status (für die Überschneidungs-Warnung im Anfrage-Formular).
function busyBlocksFor(platz, dateIso) {
  const blocks = [];
  for (const r of appData.reservierungen) {
    if (r.datum !== dateIso || r.platzId !== platz.id) continue;
    if (!BLOCKIERENDE_STATUS.includes(r.status)) continue;
    const s = timeToMin(r.von), e = timeToMin(r.bis);
    if (s == null || e == null || e <= s) continue;
    blocks.push({ start: s, ende: e, art: "reservierung", label: `${typLabel(r.typ)} ${trainerName(r)}${(r.gegner || "").trim() ? " vs. " + r.gegner : ""} (${statusLabel(r.status)})` });
  }
  return blocks;
}

// ---------- Neue Anfrage (Formular) ----------

function renderFeldgroesseSelects() {
  const options = FELDGROESSEN.map((f) => `<option value="${f.id}">${escapeHtml(f.label)}</option>`).join("");
  document.getElementById("f-feldgroesse").innerHTML = options;
}

// Platz-Auswahl im Formular: nur aktive Plätze, die die gewählte Feldgröße anbieten.
function renderPlatzSelect() {
  const feldgroesse = document.getElementById("f-feldgroesse").value;
  const sel = document.getElementById("f-platz");
  const vorher = sel.value;
  const passende = aktivePlaetze().filter((p) => (p.feldgroessen || []).includes(feldgroesse));
  sel.innerHTML = passende.length
    ? passende.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join("")
    : `<option value="">— kein Platz mit dieser Feldgröße —</option>`;
  if (passende.some((p) => p.id === vorher)) sel.value = vorher;
}

function renderMannschaftField() {
  const el = document.getElementById("mannschaft-field");
  if (!el) return;
  if (currentMannschaften.length > 1) {
    el.innerHTML = `
      <label>Mannschaft</label>
      <select id="f-mannschaft">
        ${currentMannschaften.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("")}
      </select>`;
  } else if (currentMannschaften.length === 1) {
    el.innerHTML = `<label>Mannschaft</label><p class="muted">${escapeHtml(currentMannschaften[0])}</p>`;
  } else {
    el.innerHTML = `<p class="muted">Keine Mannschaft im Trainerprofil hinterlegt.</p>`;
  }
}

function resolveMannschaft() {
  if (currentMannschaften.length > 1) {
    const sel = document.getElementById("f-mannschaft");
    return sel ? sel.value : null;
  }
  if (currentMannschaften.length === 1) return currentMannschaften[0];
  return null;
}

function formKonflikte() {
  const datum = document.getElementById("f-datum").value;
  const platz = platzById(document.getElementById("f-platz").value);
  const s = timeToMin(document.getElementById("f-von").value);
  const e = timeToMin(document.getElementById("f-bis").value);
  if (!datum || !platz || s == null || e == null || e <= s) return [];
  return busyBlocksFor(platz, datum).filter((b) => b.start < e && s < b.ende);
}

function checkFormOverlap() {
  const konflikte = formKonflikte();
  const el = document.getElementById("form-warning");
  if (!konflikte.length) { el.style.display = "none"; el.innerHTML = ""; return konflikte; }
  el.style.display = "block";
  el.innerHTML = "⚠ Überschneidung: " + konflikte
    .map((k) => escapeHtml(`${k.label} ${minToTime(k.start)}–${minToTime(k.ende)}`))
    .join(" · ");
  return konflikte;
}

function showFormError(msg) {
  const el = document.getElementById("form-error");
  el.style.display = msg ? "block" : "none";
  el.textContent = msg || "";
}

function resetAnfrageForm() {
  document.getElementById("f-datum").value = "";
  document.getElementById("f-von").value = "";
  document.getElementById("f-bis").value = "";
  document.getElementById("f-gegner").value = "";
  document.getElementById("f-anzahl-spiele").value = "";
  document.getElementById("f-minuten").value = "";
  document.getElementById("f-notiz").value = "";
  checkFormOverlap();
  renderMannschaftField();
}

async function submitReservierung() {
  showFormError("");
  if (!darfAnfragen(appData, currentUsername, currentIsAdmin || currentCanAdmin)) {
    showFormError("Du bist für die Testspielplanung nicht freigeschaltet.");
    return;
  }
  const typ = document.getElementById("f-typ").value;
  const datum = document.getElementById("f-datum").value;
  const von = document.getElementById("f-von").value;
  const bis = document.getElementById("f-bis").value;
  const feldgroesse = document.getElementById("f-feldgroesse").value;
  const platzId = document.getElementById("f-platz").value;
  const gegner = document.getElementById("f-gegner").value.trim();
  const anzahlSpiele = Number(document.getElementById("f-anzahl-spiele").value) || 0;
  const minutenProSpiel = Number(document.getElementById("f-minuten").value) || 0;
  const notiz = document.getElementById("f-notiz").value.trim();
  const mannschaft = resolveMannschaft();

  if (!datum) { showFormError("Bitte ein Datum wählen."); return; }
  if (datum < localDateIso()) { showFormError("Das Datum liegt in der Vergangenheit."); return; }
  const s = timeToMin(von), e = timeToMin(bis);
  if (s == null || e == null || e <= s) { showFormError("Bitte gültige Uhrzeiten angeben (Bis nach Von)."); return; }
  const platz = platzById(platzId);
  if (!platz) { showFormError("Bitte einen Platz wählen."); return; }
  if (!(platz.feldgroessen || []).includes(feldgroesse)) { showFormError("Dieser Platz bietet die gewählte Feldgröße nicht an."); return; }
  if (typ === "leistungsvergleich" && (anzahlSpiele < 1 || minutenProSpiel < 1)) {
    showFormError("Für einen Leistungsvergleich bitte Anzahl Spiele und Minuten pro Spiel angeben."); return;
  }

  const saison = saisonKeyOf(datum);
  const limit = kontingentLimit(appData, currentUsername);
  if (limit != null && verbrauchtesKontingent(appData, currentUsername, saison) >= limit) {
    showFormError(`Dein Kontingent für die Saison ${saison} ist erschöpft (${limit} von ${limit}).`); return;
  }

  const konflikte = checkFormOverlap();
  if (konflikte.length && !confirm("Der Termin überschneidet sich mit bestehenden Belegungen (siehe Warnung). Trotzdem anfragen?")) return;

  const btn = document.getElementById("btn-submit");
  btn.disabled = true;
  const originalLabel = btn.textContent;
  btn.textContent = "Wird gespeichert…";
  try {
    const res = {
      id: uuid(),
      typ,
      erstelltVon: currentUsername,
      vorname: currentVorname,
      nachname: currentNachname,
      mannschaft,
      datum, von, bis,
      platzId,
      feldgroesse,
      gegner,
      anzahlSpiele: typ === "leistungsvergleich" ? anzahlSpiele : null,
      minutenProSpiel: typ === "leistungsvergleich" ? minutenProSpiel : null,
      notiz,
      status: "angefragt",
      adminKommentar: "",
      dfbnetSpiel: false,
      dfbnetPlatz: false,
      erstelltAm: new Date().toISOString(),
      entschiedenAm: null,
      entschiedenVon: null,
      vereinbartAm: null,
      freigegebenAm: null
    };
    // Freigabe- und Kontingent-Recheck IM mutate: beim Konflikt-Retry läuft die
    // Prüfung auf dem frischen Remote-Stand — hat ein Admin die Freigabe inzwischen
    // entzogen oder der Trainer parallel woanders angefragt, wird das hier gefangen.
    let blocked = null; // null | "zugriff" | "kontingent"
    await saveWithConflictRetry((data) => {
      blocked = null;
      if (!darfAnfragen(data, currentUsername, currentIsAdmin || currentCanAdmin)) { blocked = "zugriff"; return; }
      const lim = kontingentLimit(data, currentUsername);
      if (lim != null && verbrauchtesKontingent(data, currentUsername, saison) >= lim) { blocked = "kontingent"; return; }
      data.reservierungen.push(res);
    });
    if (blocked === "zugriff") {
      showFormError("Du bist für die Testspielplanung nicht freigeschaltet — die Anfrage wurde nicht gespeichert.");
      return;
    }
    if (blocked === "kontingent") {
      showFormError(`Dein Kontingent für die Saison ${saison} ist erschöpft — die Anfrage wurde nicht gespeichert.`);
      return;
    }
    // Erst hier: oben wird bei "zugriff"/"kontingent" mit return abgebrochen,
    // die Anfrage existiert an dieser Stelle also wirklich.
    await pushVorgang("neu", res.id);
    resetAnfrageForm();
    renderAll();
  } catch (e2) {
    showFormError("Fehler beim Speichern: " + e2.message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

// ---------- Meine Reservierungen ----------

// Anstehende zuerst (aufsteigend), Vergangenes danach (absteigend).
function sortReservierungen(list) {
  const heute = localDateIso();
  const key = (r) => (r.datum || "") + " " + (r.von || "");
  const kommend = list.filter((r) => (r.datum || "") >= heute).sort((a, b) => key(a).localeCompare(key(b)));
  const vergangen = list.filter((r) => (r.datum || "") < heute).sort((a, b) => key(b).localeCompare(key(a)));
  return kommend.concat(vergangen);
}

function reservierungInfoHtml(r) {
  return `
    <div class="res-termin">${escapeHtml(terminText(r))} · ${escapeHtml(feldgroesseLabel(r.feldgroesse))}</div>
    <div class="muted">
      <span class="typ-badge">${escapeHtml(typLabel(r.typ))}</span>
      ${r.typ === "leistungsvergleich" ? escapeHtml(lvDetailText(r)) + " · " : ""}
      ${(r.gegner || "").trim() ? "Gegner: " + escapeHtml(r.gegner) : "Gegner noch offen"}
      ${r.mannschaft ? " · " + escapeHtml(r.mannschaft) : ""}
    </div>
    ${(r.notiz || "").trim() ? `<div class="muted">Notiz: ${escapeHtml(r.notiz)}</div>` : ""}
    ${(r.adminKommentar || "").trim() ? `<div class="muted">Kommentar: ${escapeHtml(r.adminKommentar)}</div>` : ""}`;
}

function renderMeineReservierungen() {
  const list = sortReservierungen(appData.reservierungen.filter((r) => r.erstelltVon === currentUsername));
  const container = document.getElementById("meine-rows");
  document.getElementById("meine-empty").style.display = list.length ? "none" : "block";
  const heute = localDateIso();
  container.innerHTML = list.map((r) => `
    <div class="res-row${(r.datum || "") < heute ? " vergangen" : ""}" data-id="${escapeHtml(r.id)}">
      <div class="res-row-main">${reservierungInfoHtml(r)}</div>
      <div class="res-row-actions">
        ${statusBadgeHtml(r.status)}
        ${r.status === "angefragt" ? `<button type="button" class="btn secondary small btn-withdraw">Zurückziehen</button>` : ""}
        ${r.status === "genehmigt" ? `
          <span class="gegner-inline">
            <input type="text" class="gegner-input" value="${escapeHtml(r.gegner || "")}" placeholder="Gegner" />
            <button type="button" class="btn success small btn-gegner">Gegner bestätigen</button>
          </span>` : ""}
        ${(r.status === "genehmigt" || r.status === "vereinbart") ? `<button type="button" class="btn secondary small btn-freigeben">Platz freigeben</button>` : ""}
      </div>
    </div>
  `).join("");
}

// ---------- Status-Übergänge ----------

async function withdrawReservierung(id) {
  if (!confirm("Diese Anfrage wirklich zurückziehen?")) return;
  // Guard auch in der Mutation: beim Konflikt-Retry darf eine inzwischen
  // entschiedene Anfrage nicht mehr gelöscht werden.
  await saveWithConflictRetry((data) => {
    data.reservierungen = data.reservierungen.filter((r) =>
      !(r.id === id && r.status === "angefragt" && r.erstelltVon === currentUsername));
  });
  renderAll();
}

// ---------- Benachrichtigung (seit 2026-08-03) ----------
// Der Empfänger wird SERVERSEITIG bestimmt: bei "neu" die Entscheidenden, bei
// "entschieden" der Anfragende aus dem Datensatz. Diese App schickt bewusst
// keinen Nutzernamen mit — sonst könnte ein Bearbeiter beliebige Leute
// benachrichtigen lassen, und ein Tippfehler liefe unbemerkt ins Leere.
async function pushVorgang(art, id) {
  try {
    await gatewayRequest({ action: "vorgang-push", app: GATEWAY_APP_ID, art, id });
  } catch (e) {
    // Best-effort: der Vorgang ist gespeichert, eine misslungene
    // Benachrichtigung darf ihn nicht als Fehler erscheinen lassen.
    console.warn("Benachrichtigung fehlgeschlagen", e);
  }
}

async function entscheideReservierung(id, entscheidung, adminKommentar) {
  if (!canEdit()) return;
  // ⚠️ Das mutate-Closure kann still nichts tun (Status schon geändert, DFBnet-
  // Haken fehlen). Ohne dieses Flag ginge eine Benachrichtigung raus, obwohl
  // gar nichts entschieden wurde. Zurückgesetzt wird es IM Closure, weil der
  // Konflikt-Retry es mehrfach ausführt — gleiches Muster wie `blocked` oben.
  let entschieden = false;
  await saveWithConflictRetry((data) => {
    entschieden = false;
    const r = data.reservierungen.find((x) => x.id === id);
    if (!r || r.status !== "angefragt") return;
    // Guard IM mutate-Closure (Konflikt-Retry): Genehmigung erst, wenn beide
    // DFBnet-Haken gesetzt sind — auch wenn der Button clientseitig bereits
    // disabled war, prüft der Save-Pfad nochmal gegen den frischen Stand.
    if (entscheidung === "genehmigt" && !(r.dfbnetSpiel && r.dfbnetPlatz)) return;
    r.status = entscheidung;
    r.entschiedenAm = new Date().toISOString();
    r.entschiedenVon = currentUsername;
    if (adminKommentar !== undefined) r.adminKommentar = adminKommentar;
    entschieden = true;
  });
  if (entschieden) await pushVorgang("entschieden", id);
  renderAll();
}

async function setDfbnetFlag(id, feld, value) {
  if (!canEdit()) return;
  await saveWithConflictRetry((data) => {
    const r = data.reservierungen.find((x) => x.id === id);
    if (!r || r.status !== "angefragt") return;
    r[feld] = value;
  });
  renderAll();
}

async function bestaetigeGegner(id, gegner) {
  const g = (gegner || "").trim();
  if (!g) { alert("Bitte zuerst den Gegner eintragen."); return; }
  // Kein zweites Admin-OK: der Platz-Slot ist bereits genehmigt, der Gegner-Eintrag
  // wertet die Reservierung nur auf "vereinbart" auf.
  await saveWithConflictRetry((data) => {
    const r = data.reservierungen.find((x) => x.id === id);
    if (!r || r.status !== "genehmigt" || r.erstelltVon !== currentUsername) return;
    r.gegner = g;
    r.status = "vereinbart";
    r.vereinbartAm = new Date().toISOString();
  });
  renderAll();
}

async function gebePlatzFrei(id) {
  if (!confirm("Diesen Termin wirklich freigeben? Die Reservierung verfällt und der Platz wird wieder frei.")) return;
  await saveWithConflictRetry((data) => {
    const r = data.reservierungen.find((x) => x.id === id);
    if (!r || !(r.status === "genehmigt" || r.status === "vereinbart") || r.erstelltVon !== currentUsername) return;
    r.status = "freigegeben";
    r.freigegebenAm = new Date().toISOString();
  });
  renderAll();
}

async function deleteReservierungAdmin(id) {
  if (!canEdit()) return;
  if (!confirm("Diese Reservierung wirklich endgültig löschen?")) return;
  await saveWithConflictRetry((data) => {
    data.reservierungen = data.reservierungen.filter((r) => r.id !== id);
  });
  renderAll();
}

// ---------- Verwaltung (Admin) ----------

function filteredReservierungen() {
  const list = currentStatusFilter === "alle"
    ? appData.reservierungen
    : appData.reservierungen.filter((r) => r.status === currentStatusFilter);
  return sortReservierungen(list);
}

function statusFilterLabel() {
  return currentStatusFilter === "alle" ? "Alle" : statusLabel(currentStatusFilter);
}

function renderVerwaltung() {
  const list = filteredReservierungen();
  const container = document.getElementById("verwaltung-rows");
  document.getElementById("verwaltung-empty").style.display = list.length ? "none" : "block";
  const heute = localDateIso();
  container.innerHTML = list.map((r) => `
    <div class="res-row${(r.datum || "") < heute ? " vergangen" : ""}" data-id="${escapeHtml(r.id)}">
      <div class="res-row-main">
        <div class="muted">${escapeHtml(trainerName(r))} · angefragt am ${escapeHtml(fmtDate(r.erstelltAm))}</div>
        ${reservierungInfoHtml(r)}
        ${r.status === "angefragt" ? `
        <div class="pe-block dfbnet-block">
          <span class="pe-block-label">DFBnet:</span>
          <label class="pe-checkbox"><input type="checkbox" class="dfbnet-check" data-feld="dfbnetSpiel" ${r.dfbnetSpiel ? "checked" : ""} /> Spiel eingetragen</label>
          <label class="pe-checkbox"><input type="checkbox" class="dfbnet-check" data-feld="dfbnetPlatz" ${r.dfbnetPlatz ? "checked" : ""} /> Platz reserviert/eingetragen</label>
        </div>
        <div class="form-field admin-kommentar-field">
          <label>Admin-Kommentar</label>
          <input type="text" class="admin-kommentar-input" value="${escapeHtml(r.adminKommentar || "")}" placeholder="z. B. bitte Flutlicht abstimmen" />
        </div>` : ""}
      </div>
      <div class="res-row-actions">
        ${statusBadgeHtml(r.status)}
        ${r.status === "angefragt" ? `
          <button type="button" class="btn success small btn-genehmigen"${(r.dfbnetSpiel && r.dfbnetPlatz) ? "" : " disabled title=\"Erst möglich, wenn Spiel und Platz im DFBnet eingetragen sind\""}>Genehmigen</button>
          <button type="button" class="btn secondary small btn-ablehnen">Ablehnen</button>
        ` : ""}
        <button type="button" class="btn secondary small btn-delete-res">Löschen</button>
      </div>
    </div>
  `).join("");
}

// ---------- Einstellungen (Admin) ----------

function platzEditorHtml(platz) {
  return `
    <div class="platz-editor" data-platz-id="${escapeHtml(platz.id)}">
      <div class="platz-editor-head">
        <input type="text" class="pe-name" value="${escapeHtml(platz.name || "")}" placeholder="Platzname" />
        <label class="pe-checkbox"><input type="checkbox" class="pe-aktiv" ${platz.aktiv !== false ? "checked" : ""} /> Aktiv</label>
        <button type="button" class="btn secondary small pe-remove">Entfernen</button>
      </div>
      <div class="pe-block">
        <span class="pe-block-label">Feldgrößen:</span>
        ${FELDGROESSEN.map((f) => `
          <label class="pe-checkbox"><input type="checkbox" class="pe-feldgroesse" data-fg="${f.id}" ${(platz.feldgroessen || []).includes(f.id) ? "checked" : ""} /> ${escapeHtml(f.label)}</label>
        `).join("")}
      </div>
    </div>`;
}

// Eine Zeile der Trainer-Freigabeliste: Checkbox "darf anfragen" + eigenes
// Saison-Kontingent (leer = kein Limit, gleiche Konvention wie vorher global).
function trainerZugriffRowHtml(user) {
  const saved = trainerZugriffFor(appData, user.username);
  const erlaubt = !!(saved && saved.erlaubt);
  const kontingent = saved && typeof saved.kontingent === "number" ? saved.kontingent : "";
  return `
    <div class="tz-row" data-username="${escapeHtml(user.username)}">
      <label class="pe-checkbox"><input type="checkbox" class="tz-erlaubt" ${erlaubt ? "checked" : ""} /> ${escapeHtml(user.displayName || user.username)}</label>
      <input type="number" class="tz-kontingent" min="1" step="1" placeholder="kein Limit" value="${escapeHtml(kontingent)}" ${erlaubt ? "" : "disabled"} />
    </div>`;
}

// Eine Zeile der Push-Verteilerliste. Nur ein Häkchen — wer angehakt ist,
// bekommt die Meldung über eine neue Anfrage.
function pushEmpfaengerRowHtml(user) {
  const gewaehlt = pushEmpfaengerListe(appData).indexOf(user.username) !== -1;
  return `
    <div class="tz-row" data-username="${escapeHtml(user.username)}">
      <label class="pe-checkbox"><input type="checkbox" class="push-empf" ${gewaehlt ? "checked" : ""} /> ${escapeHtml(user.displayName || user.username)}</label>
    </div>`;
}

// Lazy laden + für die Session cachen (nur Admins erreichen den Einstellungen-Tab,
// der Aufruf lohnt sich also nicht schon beim App-Start für jeden Nutzer).
async function ensureTrainerDirectory() {
  if (trainerDirectory) return trainerDirectory;
  try {
    const res = await fetchDirectory();
    const users = Array.isArray(res.users) ? res.users : [];
    trainerDirectory = users.slice().sort((a, b) =>
      (a.displayName || a.username).localeCompare(b.displayName || b.username, "de"));
  } catch (e) {
    trainerDirectory = [];
  }
  return trainerDirectory;
}

// Dasselbe für die Entscheidenden. Bewusst eine ZWEITE Quelle statt der
// Trainerliste: hier dürfen nur Leute stehen, die die Anfrage auch entscheiden
// können — ein Haken bei jemand anderem wäre ein stiller Blindgänger, weil der
// Worker die Liste nur als Filter über die Berechtigten legt.
async function ensureEntscheiderDirectory() {
  if (entscheiderDirectory) return entscheiderDirectory;
  try {
    const res = await fetchToolEditors();
    const users = Array.isArray(res.users) ? res.users : [];
    entscheiderDirectory = users.slice().sort((a, b) =>
      (a.displayName || a.username).localeCompare(b.displayName || b.username, "de"));
  } catch (e) {
    entscheiderDirectory = [];
  }
  return entscheiderDirectory;
}

async function renderEinstellungen() {
  document.getElementById("einstellungen-plaetze").innerHTML = appData.plaetze.map(platzEditorHtml).join("");
  const tzList = document.getElementById("trainer-zugriff-list");
  tzList.innerHTML = `<p class="muted">Lade Trainerliste…</p>`;
  const peList = document.getElementById("push-empfaenger-list");
  peList.innerHTML = `<p class="muted">Lade Liste…</p>`;
  const users = await ensureTrainerDirectory();
  tzList.innerHTML = users.length
    ? users.map(trainerZugriffRowHtml).join("")
    : `<p class="muted">Trainerliste konnte nicht geladen werden.</p>`;
  const entscheider = await ensureEntscheiderDirectory();
  peList.innerHTML = entscheider.length
    ? entscheider.map(pushEmpfaengerRowHtml).join("")
    : `<p class="muted">Es ist niemand hinterlegt, der Anfragen entscheiden darf. Die Gruppen dafür werden in der Tools-Übersicht vergeben.</p>`;
  renderPushEmpfaengerHinweis();
}

// Sagt an, was der aktuelle Häkchenstand bedeutet — vor allem den Fall „nichts
// angehakt“, der eben NICHT „niemand“ heißt. Ohne den Satz liest sich eine
// leere Liste wie ein abgeschalteter Versand.
function renderPushEmpfaengerHinweis() {
  const el = document.getElementById("push-empfaenger-hinweis");
  if (!el) return;
  const gesamt = document.querySelectorAll("#push-empfaenger-list .tz-row").length;
  const gewaehlt = document.querySelectorAll("#push-empfaenger-list .push-empf:checked").length;
  if (!gesamt) { el.style.display = "none"; return; }
  // Gespeicherte Namen, die niemand mehr entscheiden darf: sie stehen nicht mehr
  // in der Liste, verschwänden hier also lautlos. Der Totalausfall ist im Worker
  // abgefangen (bleibt niemand übrig, gehen die Meldungen wieder an alle) —
  // sichtbar muss es trotzdem sein, sonst schrumpft der Verteiler unbemerkt.
  const bekannt = (entscheiderDirectory || []).map((u) => u.username);
  const verwaist = pushEmpfaengerListe(appData).filter((n) => bekannt.indexOf(n) === -1);
  el.style.display = "block";
  let text = gewaehlt
    ? `Es werden ${gewaehlt} von ${gesamt} benachrichtigt.`
    : `Nichts angehakt — es werden alle ${gesamt} benachrichtigt.`;
  if (verwaist.length) {
    text += ` Achtung: ${verwaist.join(", ")} war ausgewählt, darf aber keine Anfragen mehr entscheiden und bekommt nichts mehr. Beim nächsten Speichern fällt der Eintrag weg.`;
  }
  el.textContent = text;
}

function showEinstellungenStatus(msg, isError) {
  const el = document.getElementById("einstellungen-status");
  el.style.display = msg ? "block" : "none";
  el.textContent = msg || "";
  el.style.color = isError ? "var(--red)" : "var(--green)";
}

function collectEinstellungenFromForm() {
  const plaetze = Array.from(document.querySelectorAll("#einstellungen-plaetze .platz-editor")).map((el) => {
    const id = el.dataset.platzId;
    return {
      id,
      name: el.querySelector(".pe-name").value.trim(),
      aktiv: el.querySelector(".pe-aktiv").checked,
      feldgroessen: Array.from(el.querySelectorAll(".pe-feldgroesse:checked")).map((c) => c.dataset.fg)
    };
  });
  const tzRows = Array.from(document.querySelectorAll("#trainer-zugriff-list .tz-row"));
  const trainerZugriff = {};
  tzRows.forEach((row) => {
    const erlaubt = row.querySelector(".tz-erlaubt").checked;
    if (!erlaubt) return; // nicht angehakt = kein Eintrag = fail-closed gesperrt
    const kontRaw = row.querySelector(".tz-kontingent").value.trim();
    const kontNum = Math.floor(Number(kontRaw));
    const kontingent = kontRaw !== "" && Number.isFinite(kontNum) && kontNum > 0 ? kontNum : null;
    trainerZugriff[row.dataset.username] = { erlaubt: true, kontingent };
  });
  const peRows = Array.from(document.querySelectorAll("#push-empfaenger-list .tz-row"));
  const pushEmpfaenger = peRows
    .filter((row) => row.querySelector(".push-empf").checked)
    .map((row) => row.dataset.username);
  // Zeilen vorhanden ⇒ Trainerliste war geladen, trainerZugriff darf ersetzt werden.
  // Noch nicht geladen (z. B. sehr schnelles Klicken) ⇒ nichts überschreiben, statt
  // versehentlich alle bestehenden Freigaben zu löschen.
  return {
    plaetze, trainerZugriff, trainerZugriffLoaded: tzRows.length > 0,
    pushEmpfaenger, pushEmpfaengerLoaded: peRows.length > 0
  };
}

async function saveEinstellungen() {
  if (!(currentIsAdmin || currentCanAdmin)) return;
  showEinstellungenStatus("");
  const { plaetze, trainerZugriff, trainerZugriffLoaded, pushEmpfaenger, pushEmpfaengerLoaded } = collectEinstellungenFromForm();
  if (plaetze.some((p) => !p.name)) { showEinstellungenStatus("Bitte jedem Platz einen Namen geben.", true); return; }
  if (!plaetze.length) { showEinstellungenStatus("Mindestens ein Platz muss vorhanden sein.", true); return; }
  const btn = document.getElementById("btn-save-einstellungen");
  btn.disabled = true;
  try {
    await saveWithConflictRetry((data) => {
      data.plaetze = plaetze;
      if (trainerZugriffLoaded) data.einstellungen.trainerZugriff = trainerZugriff;
      // Gleiche Vorsicht wie oben: nur ersetzen, wenn die Liste wirklich
      // gerendert war — sonst löschte ein sehr schnelles Speichern den Verteiler.
      if (pushEmpfaengerLoaded) data.einstellungen.pushEmpfaenger = pushEmpfaenger;
    });
    showEinstellungenStatus("Gespeichert ✓");
    renderEinstellungen();
    renderPlatzSelect();
    renderAll();
  } catch (e) {
    showEinstellungenStatus("Fehler beim Speichern: " + e.message, true);
  } finally {
    btn.disabled = false;
  }
}

function addPlatzEditor() {
  const neu = { id: "p-" + uuid().slice(0, 8), name: "", aktiv: true, feldgroessen: FELDGROESSEN.map((f) => f.id) };
  document.getElementById("einstellungen-plaetze").insertAdjacentHTML("beforeend", platzEditorHtml(neu));
}

// ---------- Export ----------

function exportRows() {
  return filteredReservierungen().map((r) => ({
    termin: `${isoToDisplay(r.datum)} ${r.von || ""}–${r.bis || ""}`.trim(),
    platz: platzName(r.platzId),
    feldgroesse: feldgroesseLabel(r.feldgroesse),
    typ: typLabel(r.typ) + (r.typ === "leistungsvergleich" ? ` (${lvDetailText(r)})` : ""),
    trainer: trainerName(r),
    mannschaft: r.mannschaft || "",
    gegner: (r.gegner || "").trim() || "offen",
    status: statusLabel(r.status),
    kommentar: r.adminKommentar || ""
  }));
}

const EXPORT_FIELDS = [
  { label: "Termin", key: "termin" },
  { label: "Platz", key: "platz" },
  { label: "Feldgröße", key: "feldgroesse" },
  { label: "Art", key: "typ" },
  { label: "Trainer", key: "trainer" },
  { label: "Mannschaft", key: "mannschaft" },
  { label: "Gegner", key: "gegner" },
  { label: "Status", key: "status" },
  { label: "Kommentar", key: "kommentar" }
];

function exportText() {
  const rows = exportRows();
  if (!rows.length) { alert("Keine Reservierungen für den aktuellen Filter vorhanden."); return; }
  const widths = EXPORT_FIELDS.map((f) => Math.max(f.label.length, ...rows.map((r) => String(r[f.key]).length)));
  const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join("  ");
  const sepLine = widths.map((w) => "-".repeat(w)).join("  ");
  let out = `Testspielplaner — Reservierungen (Filter: ${statusFilterLabel()})\n`;
  out += `Erstellt am ${new Date().toLocaleString("de-DE")}\n\n`;
  out += line(EXPORT_FIELDS.map((f) => f.label)) + "\n" + sepLine + "\n";
  out += rows.map((r) => line(EXPORT_FIELDS.map((f) => r[f.key]))).join("\n") + "\n";
  download(`testspielplaner_${localDateIso()}.txt`, "text/plain", "﻿" + out);
}

function exportPdf() {
  const rows = exportRows();
  if (!rows.length) { alert("Keine Reservierungen für den aktuellen Filter vorhanden."); return; }
  const theadHtml = `<tr>${EXPORT_FIELDS.map((f) => `<th>${escapeHtml(f.label)}</th>`).join("")}</tr>`;
  const rowsHtml = rows.map((r) => `<tr>${EXPORT_FIELDS.map((f) => `<td>${escapeHtml(r[f.key])}</td>`).join("")}</tr>`).join("");
  document.getElementById("print-content").innerHTML = `
    <h1>🆚 Testspielplaner</h1>
    <p class="print-meta">Reservierungen (Filter: ${escapeHtml(statusFilterLabel())}) — erstellt am ${new Date().toLocaleString("de-DE")}</p>
    <table class="print-table">
      <thead>${theadHtml}</thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;
  document.body.classList.add("printing-report");
  const cleanup = () => { document.body.classList.remove("printing-report"); window.removeEventListener("afterprint", cleanup); };
  window.addEventListener("afterprint", cleanup);
  setTimeout(() => window.print(), 150);
}

// ---------- Rendering-Sammel ----------

function renderAll() {
  renderKontingentInfo();
  renderReminderBanner();
  renderMeineReservierungen();
  // ⚠️ Muss dieselbe Stufe sein, die den Reiter sichtbar macht (.tooladmin-only
  // = is-tooladmin = currentIsAdmin || currentCanAdmin). Stand vorher auf
  // currentIsAdmin allein — wer das Administrieren-Recht nur über eine Gruppe
  // hatte, sah einen leeren Reiter ohne Leermeldung.
  if (currentIsAdmin || currentCanAdmin) renderVerwaltung();
}

// ---------- Header / Tabs / Start ----------

function renderHeaderUser() {
  const el = document.getElementById("header-user");
  if (!el) return;
  if (!currentUsername) { el.textContent = ""; return; }
  const name = (currentVorname || currentNachname)
    ? `${currentVorname || ""} ${currentNachname || ""}`.trim()
    : currentUsername;
  const mannschaftHinweis = currentMannschaften.length ? ` (${currentMannschaften.join(", ")})` : "";
  el.textContent = "👤 " + name + mannschaftHinweis + (currentIsAdmin ? " (Admin)" : "");
}

function activateTab(name) {
  document.querySelectorAll("nav button[data-tab]").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".tab-section").forEach((s) => s.classList.remove("active"));
  document.querySelector(`nav button[data-tab="${name}"]`).classList.add("active");
  document.getElementById("tab-" + name).classList.add("active");
  if (name === "einstellungen") renderEinstellungen();
  if (name === "verwaltung" && (currentIsAdmin || currentCanAdmin)) renderVerwaltung();
}

function setupTabs() {
  document.querySelectorAll("nav button[data-tab]").forEach((b) => {
    b.addEventListener("click", () => activateTab(b.dataset.tab));
  });

}

function renderChangelog() {
  const list = document.getElementById("changelog-list");
  list.innerHTML = APP_CHANGELOG.map((entry) => `
    <div class="changelog-entry">
      <span class="cv">Version ${escapeHtml(entry.version)}</span>
      ${entry.groups.map((g) => `
        <div class="changelog-group">
          <div class="cg-title">${escapeHtml(g.title)}</div>
          <ul class="cg-items">${g.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
        </div>
      `).join("")}
    </div>
  `).join("");
}

function startApp() {
  document.getElementById("connect-screen").style.display = "none";
  document.getElementById("app-shell").style.display = "block";
}

function showConnectScreen(errorMsg) {
  document.getElementById("connect-screen").style.display = "block";
  document.getElementById("app-shell").style.display = "none";
  const err = document.getElementById("cloud-error");
  err.style.display = errorMsg ? "block" : "none";
  err.textContent = errorMsg || "";
}

async function init() {
  document.getElementById("version-badge-2").textContent = "v" + APP_VERSION;
  renderChangelog();
  setupTabs();
  renderFeldgroesseSelects();

  document.getElementById("f-typ").addEventListener("change", (e) => {
    document.getElementById("anfrage-card").classList.toggle("typ-lv", e.target.value === "leistungsvergleich");
  });
  document.getElementById("f-feldgroesse").addEventListener("change", () => { renderPlatzSelect(); checkFormOverlap(); });
  ["f-datum", "f-von", "f-bis", "f-platz"].forEach((id) => {
    document.getElementById(id).addEventListener("change", checkFormOverlap);
  });
  // Das Kontingent haengt an der Saison des SPIELDATUMS -- wechselt das Datum
  // ueber den 1. Juli, gilt ein anderer Zaehler. Ohne diese Zeile bliebe die
  // Zeile ueber dem Formular auf der Saison stehen, die beim Seitenstart galt.
  document.getElementById("f-datum").addEventListener("change", renderKontingentInfo);
  document.getElementById("btn-submit").addEventListener("click", submitReservierung);

  document.getElementById("meine-rows").addEventListener("click", (e) => {
    const row = e.target.closest(".res-row");
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.closest(".btn-withdraw")) withdrawReservierung(id);
    else if (e.target.closest(".btn-gegner")) {
      const input = row.querySelector(".gegner-input");
      bestaetigeGegner(id, input ? input.value : "");
    }
    else if (e.target.closest(".btn-freigeben")) gebePlatzFrei(id);
  });

  document.getElementById("admin-status-filter").addEventListener("change", (e) => {
    currentStatusFilter = e.target.value;
    renderVerwaltung();
  });
  document.getElementById("verwaltung-rows").addEventListener("click", (e) => {
    const row = e.target.closest(".res-row");
    if (!row) return;
    const id = row.dataset.id;
    const kommentarInput = row.querySelector(".admin-kommentar-input");
    const kommentar = kommentarInput ? kommentarInput.value.trim() : undefined;
    if (e.target.closest(".btn-genehmigen")) entscheideReservierung(id, "genehmigt", kommentar);
    else if (e.target.closest(".btn-ablehnen")) entscheideReservierung(id, "abgelehnt", kommentar);
    else if (e.target.closest(".btn-delete-res")) deleteReservierungAdmin(id);
  });
  document.getElementById("verwaltung-rows").addEventListener("change", (e) => {
    const check = e.target.closest(".dfbnet-check");
    if (!check) return;
    const row = e.target.closest(".res-row");
    setDfbnetFlag(row.dataset.id, check.dataset.feld, check.checked);
  });
  document.getElementById("btn-export-text").addEventListener("click", exportText);
  document.getElementById("btn-export-pdf").addEventListener("click", exportPdf);

  document.getElementById("btn-add-platz").addEventListener("click", addPlatzEditor);
  document.getElementById("btn-save-einstellungen").addEventListener("click", saveEinstellungen);
  document.getElementById("trainer-zugriff-list").addEventListener("change", (e) => {
    const check = e.target.closest(".tz-erlaubt");
    if (!check) return;
    const kont = check.closest(".tz-row").querySelector(".tz-kontingent");
    kont.disabled = !check.checked;
    if (!check.checked) kont.value = "";
  });
  document.getElementById("push-empfaenger-list").addEventListener("change", (e) => {
    if (e.target.closest(".push-empf")) renderPushEmpfaengerHinweis();
  });
  document.getElementById("einstellungen-plaetze").addEventListener("click", (e) => {
    const btn = e.target.closest(".pe-remove");
    if (!btn) return;
    const editor = btn.closest(".platz-editor");
    const id = editor.dataset.platzId;
    if (appData.reservierungen.some((r) => r.platzId === id)) {
      alert("Für diesen Platz gibt es Reservierungen — bitte stattdessen das Häkchen „Aktiv“ entfernen.");
      return;
    }
    editor.remove();
  });

  if (!getSessionToken()) {
    showConnectScreen();
    return;
  }

  try {
    // Nacheinander statt Promise.all — und das ist hier schneller, nicht
    // langsamer: dav-load liefert das "me" mittlerweile gratis mit (der Worker
    // hat nutzer.json und die Rechte-Datei für diesen Request ohnehin gelesen),
    // der zweite Aufruf kostet also gar keinen Request mehr. Parallel wären es
    // zwei echte Requests mit zwei Session-Prüfungen.
    const data = await gatewayLoad();
    const me = await fetchMe();
    currentUsername = me.username;
    currentIsAdmin = !!me.isAdmin;
    currentCanAdmin = !!me.canAdmin;
    currentCanEdit = !!me.canEdit;
    currentVorname = me.vorname || null;
    currentNachname = me.nachname || null;
    if (!currentVorname && !currentNachname) {
      const derived = deriveNameFromUsername(currentUsername);
      currentVorname = derived.vorname;
      currentNachname = derived.nachname;
    }
    currentMannschaften = Array.isArray(me.mannschaften) ? me.mannschaften : [];
    appData = normalizeAppData(data);
    // Admin-UI rein CSS-reaktiv über die Body-Klasse (kein isAdmin im Render-HTML,
    // siehe startApp-Timing-Gotcha der Geschwister-Apps). Seit Bearbeiten-Recht-
    // Trennung: is-admin-Klasse steuert jetzt canEdit() (Admin ODER editGroupIds),
    // Name bewusst beibehalten (CSS/Doku referenzieren ihn).
    document.body.classList.toggle("is-admin", canEdit());
    // Dritte Stufe: Einstellungen (Plätze/Freigaben) nur für Administrierende.
    document.body.classList.toggle("is-tooladmin", currentIsAdmin || currentCanAdmin);
    // Nicht freigeschaltete Trainer sehen statt des Anfrage-Formulars nur den Hinweis.
    const erlaubt = darfAnfragen(appData, currentUsername, currentIsAdmin || currentCanAdmin);
    document.getElementById("anfrage-card").style.display = erlaubt ? "" : "none";
    document.getElementById("anfrage-gesperrt-hinweis").style.display = erlaubt ? "none" : "block";
    startApp();
    renderHeaderUser();
    renderMannschaftField();
    renderPlatzSelect();
    renderAll();
  } catch (e) {
    if (e instanceof NotLoggedInError) {
      showConnectScreen();
    } else {
      showConnectScreen("Fehler beim Laden: " + e.message);
    }
  }
}

window.addEventListener("DOMContentLoaded", () => { init(); });
