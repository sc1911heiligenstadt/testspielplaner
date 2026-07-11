let appData = { einstellungen: { kontingentProSaison: null }, plaetze: [], reservierungen: [] };
let platzbelegungData = null; // {plaetze:[{id,name}], belegungen:[...]} oder null (nicht ladbar)
let currentUsername = null;
let currentIsAdmin = false;
let currentVorname = null;
let currentNachname = null;
let currentMannschaften = [];
let currentStatusFilter = "alle";

const RESERVIERUNG_STATUS = [
  { id: "angefragt", label: "Angefragt" },
  { id: "genehmigt", label: "Genehmigt" },
  { id: "vereinbart", label: "Vereinbart" },
  { id: "abgelehnt", label: "Abgelehnt" },
  { id: "freigegeben", label: "Freigegeben" }
];

// getDay(): 0 = Sonntag -> null (die Platzbelegung kennt keinen Sonntag, dort ist
// bzgl. Training also nichts hinterlegt).
const WOCHENTAG_BY_GETDAY = [null, "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

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

function wochentagOf(iso) {
  return WOCHENTAG_BY_GETDAY[dateFromIso(iso).getDay()];
}

function wochentagName(iso) {
  return dateFromIso(iso).toLocaleDateString("de-DE", { weekday: "long" });
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
  if (typeof d.einstellungen.kontingentProSaison !== "number") d.einstellungen.kontingentProSaison = null;
  if (!Array.isArray(d.plaetze) || !d.plaetze.length) {
    d.plaetze = DEFAULT_PLAETZE.map((p) => ({ ...p, feldgroessen: p.feldgroessen.slice(), platzbelegungIds: p.platzbelegungIds.slice() }));
  }
  if (!Array.isArray(d.reservierungen)) d.reservierungen = [];
  return d;
}

function normalizePlatzbelegung(pb) {
  if (!pb || typeof pb !== "object") return null;
  return {
    plaetze: Array.isArray(pb.plaetze) ? pb.plaetze : [],
    belegungen: Array.isArray(pb.belegungen) ? pb.belegungen : []
  };
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

// ---------- Kontingent ----------

function kontingentLimit(data) {
  const v = data.einstellungen ? data.einstellungen.kontingentProSaison : null;
  return (typeof v === "number" && v > 0) ? v : null;
}

function verbrauchtesKontingent(data, username, saisonKey) {
  return data.reservierungen.filter((r) =>
    r.erstelltVon === username &&
    BLOCKIERENDE_STATUS.includes(r.status) &&
    saisonKeyOf(r.datum || "") === saisonKey
  ).length;
}

function renderKontingentInfo() {
  const el = document.getElementById("kontingent-info");
  const saison = saisonKeyOf(localDateIso());
  const limit = kontingentLimit(appData);
  const verbraucht = verbrauchtesKontingent(appData, currentUsername, saison);
  if (limit == null) {
    el.textContent = `Saison ${saison}: ${verbraucht} Reservierung${verbraucht === 1 ? "" : "en"} — kein Kontingent-Limit gesetzt.`;
  } else {
    el.textContent = `Kontingent Saison ${saison}: ${verbraucht} von ${limit} verbraucht.`;
    el.classList.toggle("kontingent-voll", verbraucht >= limit);
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

// ---------- Slot-Suche ----------

// Belegte Blöcke eines (groben) Platzes an einem konkreten Datum:
// Training aus der Platzbelegung (Wochentags-Muster, aggregiert über alle
// zugeordneten Teilplätze) + eigene Reservierungen mit blockierendem Status.
function busyBlocksFor(platz, dateIso) {
  const blocks = [];
  const tag = wochentagOf(dateIso);
  if (tag && platzbelegungData) {
    for (const b of platzbelegungData.belegungen) {
      if (b.tag !== tag) continue;
      if (!(platz.platzbelegungIds || []).includes(b.platz)) continue;
      const s = timeToMin(b.start), e = timeToMin(b.ende);
      if (s == null || e == null || e <= s) continue;
      blocks.push({ start: s, ende: e, art: "training", label: "Training: " + (b.label || "belegt") });
    }
  }
  for (const r of appData.reservierungen) {
    if (r.datum !== dateIso || r.platzId !== platz.id) continue;
    if (!BLOCKIERENDE_STATUS.includes(r.status)) continue;
    const s = timeToMin(r.von), e = timeToMin(r.bis);
    if (s == null || e == null || e <= s) continue;
    blocks.push({ start: s, ende: e, art: "reservierung", label: `${typLabel(r.typ)} ${trainerName(r)}${(r.gegner || "").trim() ? " vs. " + r.gegner : ""} (${statusLabel(r.status)})` });
  }
  return blocks;
}

function mergeIntervals(blocks) {
  const sorted = blocks.slice().sort((a, b) => a.start - b.start);
  const merged = [];
  for (const b of sorted) {
    const last = merged[merged.length - 1];
    if (last && b.start <= last.ende) last.ende = Math.max(last.ende, b.ende);
    else merged.push({ start: b.start, ende: b.ende });
  }
  return merged;
}

// Freie Lücken im Fenster [fensterStart, fensterEnde), mindestens MIN_SLOT_MIN lang.
function freeGaps(blocks, fensterStart, fensterEnde) {
  const gaps = [];
  let cursor = fensterStart;
  for (const b of mergeIntervals(blocks)) {
    if (b.ende <= fensterStart || b.start >= fensterEnde) continue;
    const s = Math.max(b.start, fensterStart);
    if (s > cursor) gaps.push({ start: cursor, ende: s });
    cursor = Math.max(cursor, Math.min(b.ende, fensterEnde));
  }
  if (cursor < fensterEnde) gaps.push({ start: cursor, ende: fensterEnde });
  return gaps.filter((g) => g.ende - g.start >= MIN_SLOT_MIN);
}

function renderSlotRow(platz, iso, blocks, gaps, fensterStart, fensterEnde) {
  const span = fensterEnde - fensterStart;
  const blockHtml = blocks
    .filter((b) => b.ende > fensterStart && b.start < fensterEnde)
    .map((b) => {
      const s = Math.max(b.start, fensterStart), e = Math.min(b.ende, fensterEnde);
      const left = ((s - fensterStart) / span) * 100;
      const width = ((e - s) / span) * 100;
      return `<div class="slot-block ${b.art === "training" ? "training" : "reservierung"}" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%;" title="${escapeHtml(`${b.label} (${minToTime(b.start)}–${minToTime(b.ende)})`)}"></div>`;
    }).join("");
  const chips = gaps.map((g) =>
    `<button type="button" class="gap-chip" data-datum="${iso}" data-platz="${escapeHtml(platz.id)}" data-von="${minToTime(g.start)}" data-bis="${minToTime(g.ende)}">${minToTime(g.start)}–${minToTime(g.ende)}</button>`
  ).join("");
  return `
    <div class="slot-row">
      <div class="slot-row-head">
        <span class="slot-platzname">${escapeHtml(platz.name)}</span>
        <span class="muted">${minToTime(fensterStart)}–${minToTime(fensterEnde)}</span>
      </div>
      <div class="slot-track">${blockHtml}</div>
      <div class="slot-chips">${chips || '<span class="muted">Keine freie Lücke im Zeitfenster.</span>'}</div>
    </div>`;
}

function runSlotSuche() {
  const out = document.getElementById("suche-ergebnis");
  const fehler = (msg) => { out.innerHTML = `<p class="muted" style="color:var(--red);">${escapeHtml(msg)}</p>`; };
  const von = document.getElementById("s-von").value;
  const bis = document.getElementById("s-bis").value || von;
  const zeitVon = document.getElementById("s-zeit-von").value || SUCHFENSTER_START;
  const zeitBis = document.getElementById("s-zeit-bis").value || SUCHFENSTER_ENDE;
  const feldgroesse = document.getElementById("s-feldgroesse").value;

  if (!von) { fehler("Bitte ein Von-Datum wählen."); return; }
  if (bis < von) { fehler("Das Bis-Datum liegt vor dem Von-Datum."); return; }
  const tage = Math.round((dateFromIso(bis) - dateFromIso(von)) / 86400000) + 1;
  if (tage > SUCHE_MAX_TAGE) { fehler(`Bitte höchstens ${SUCHE_MAX_TAGE} Tage auf einmal durchsuchen.`); return; }
  const fs = timeToMin(zeitVon), fe = timeToMin(zeitBis);
  if (fs == null || fe == null || fe <= fs) { fehler("Ungültiges Uhrzeit-Fenster."); return; }
  const plaetze = aktivePlaetze().filter((p) => (p.feldgroessen || []).includes(feldgroesse));
  if (!plaetze.length) { fehler("Kein aktiver Platz bietet diese Feldgröße an."); return; }

  let html = "";
  if (!platzbelegungData) {
    html += `<div class="hinweis-warnung">⚠ Trainingszeiten konnten nicht geladen werden — die Anzeige berücksichtigt nur Testspiel-Reservierungen und ist unvollständig.</div>`;
  }
  for (let iso = von, i = 0; i < tage; iso = isoPlusTage(iso, 1), i++) {
    const sonntag = wochentagOf(iso) === null;
    html += `<div class="suche-tag">
      <h4>${escapeHtml(wochentagName(iso))}, ${escapeHtml(isoToDisplay(iso))}${sonntag ? ' <span class="muted">(kein Trainingsplan hinterlegt — nur Reservierungen berücksichtigt)</span>' : ""}</h4>
      ${plaetze.map((p) => renderSlotRow(p, iso, busyBlocksFor(p, iso), freeGaps(busyBlocksFor(p, iso), fs, fe), fs, fe)).join("")}
    </div>`;
  }
  out.innerHTML = html;
}

// ---------- Neue Anfrage (Formular) ----------

function renderFeldgroesseSelects() {
  const options = FELDGROESSEN.map((f) => `<option value="${f.id}">${escapeHtml(f.label)}</option>`).join("");
  document.getElementById("s-feldgroesse").innerHTML = options;
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
  const limit = kontingentLimit(appData);
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
      erstelltAm: new Date().toISOString(),
      entschiedenAm: null,
      entschiedenVon: null,
      vereinbartAm: null,
      freigegebenAm: null
    };
    // Kontingent-Recheck IM mutate: beim Konflikt-Retry läuft die Prüfung auf dem
    // frischen Remote-Stand — hat der Trainer parallel woanders angefragt, wird
    // hier nicht über das Limit hinaus gebucht.
    let blocked = false;
    await saveWithConflictRetry((data) => {
      blocked = false;
      const lim = kontingentLimit(data);
      if (lim != null && verbrauchtesKontingent(data, currentUsername, saison) >= lim) { blocked = true; return; }
      data.reservierungen.push(res);
    });
    if (blocked) {
      showFormError(`Dein Kontingent für die Saison ${saison} ist erschöpft — die Anfrage wurde nicht gespeichert.`);
      return;
    }
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

async function entscheideReservierung(id, entscheidung, adminKommentar) {
  await saveWithConflictRetry((data) => {
    const r = data.reservierungen.find((x) => x.id === id);
    if (!r || r.status !== "angefragt") return;
    r.status = entscheidung;
    r.entschiedenAm = new Date().toISOString();
    r.entschiedenVon = currentUsername;
    if (adminKommentar !== undefined) r.adminKommentar = adminKommentar;
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
        <div class="form-field admin-kommentar-field">
          <label>Admin-Kommentar</label>
          <input type="text" class="admin-kommentar-input" value="${escapeHtml(r.adminKommentar || "")}" placeholder="z. B. bitte Flutlicht abstimmen" />
        </div>` : ""}
      </div>
      <div class="res-row-actions">
        ${statusBadgeHtml(r.status)}
        ${r.status === "angefragt" ? `
          <button type="button" class="btn success small btn-genehmigen">Genehmigen</button>
          <button type="button" class="btn secondary small btn-ablehnen">Ablehnen</button>
        ` : ""}
        <button type="button" class="btn secondary small btn-delete-res">Löschen</button>
      </div>
    </div>
  `).join("");
}

// ---------- Einstellungen (Admin) ----------

function platzEditorHtml(platz) {
  const mappingRendered = !!platzbelegungData;
  let mappingHtml;
  if (mappingRendered) {
    const bekannt = platzbelegungData.plaetze;
    const zugeordnet = platz.platzbelegungIds || [];
    const unbekannt = zugeordnet.filter((id) => !bekannt.some((p) => p.id === id));
    mappingHtml = bekannt.map((p) => `
      <label class="pe-checkbox"><input type="checkbox" class="pe-map" data-pbid="${escapeHtml(p.id)}" ${zugeordnet.includes(p.id) ? "checked" : ""} /> ${escapeHtml(p.name)}</label>
    `).join("") + unbekannt.map((id) => `
      <label class="pe-checkbox pe-unbekannt"><input type="checkbox" class="pe-map" data-pbid="${escapeHtml(id)}" checked /> ${escapeHtml(id)} <span title="Diese Teilplatz-Id existiert nicht (mehr) in der Platzbelegung — Zuordnung greift nicht.">⚠ unbekannt in Platzbelegung</span></label>
    `).join("");
  } else {
    mappingHtml = `<span class="muted">Trainingsplan nicht geladen — die bestehende Zuordnung bleibt beim Speichern unverändert.</span>`;
  }
  return `
    <div class="platz-editor" data-platz-id="${escapeHtml(platz.id)}" data-mapping-rendered="${mappingRendered ? "1" : "0"}">
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
      <div class="pe-block">
        <span class="pe-block-label">Belegt durch Training auf (Platzbelegung):</span>
        ${mappingHtml}
      </div>
    </div>`;
}

function renderEinstellungen() {
  const kont = appData.einstellungen.kontingentProSaison;
  document.getElementById("e-kontingent").value = (typeof kont === "number" && kont > 0) ? kont : "";
  document.getElementById("einstellungen-plaetze").innerHTML = appData.plaetze.map(platzEditorHtml).join("");
}

function showEinstellungenStatus(msg, isError) {
  const el = document.getElementById("einstellungen-status");
  el.style.display = msg ? "block" : "none";
  el.textContent = msg || "";
  el.style.color = isError ? "var(--red)" : "var(--green)";
}

function collectEinstellungenFromForm() {
  const kontRaw = document.getElementById("e-kontingent").value.trim();
  const kontNum = Math.floor(Number(kontRaw));
  const kontingent = kontRaw !== "" && Number.isFinite(kontNum) && kontNum > 0 ? kontNum : null;
  const plaetze = Array.from(document.querySelectorAll("#einstellungen-plaetze .platz-editor")).map((el) => {
    const id = el.dataset.platzId;
    const bisher = platzById(id);
    const mappingRendered = el.dataset.mappingRendered === "1";
    return {
      id,
      name: el.querySelector(".pe-name").value.trim(),
      aktiv: el.querySelector(".pe-aktiv").checked,
      feldgroessen: Array.from(el.querySelectorAll(".pe-feldgroesse:checked")).map((c) => c.dataset.fg),
      platzbelegungIds: mappingRendered
        ? Array.from(el.querySelectorAll(".pe-map:checked")).map((c) => c.dataset.pbid)
        : (bisher ? (bisher.platzbelegungIds || []) : [])
    };
  });
  return { kontingent, plaetze };
}

async function saveEinstellungen() {
  showEinstellungenStatus("");
  const { kontingent, plaetze } = collectEinstellungenFromForm();
  if (plaetze.some((p) => !p.name)) { showEinstellungenStatus("Bitte jedem Platz einen Namen geben.", true); return; }
  if (!plaetze.length) { showEinstellungenStatus("Mindestens ein Platz muss vorhanden sein.", true); return; }
  const btn = document.getElementById("btn-save-einstellungen");
  btn.disabled = true;
  try {
    await saveWithConflictRetry((data) => {
      data.einstellungen.kontingentProSaison = kontingent;
      data.plaetze = plaetze;
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
  const neu = { id: "p-" + uuid().slice(0, 8), name: "", aktiv: true, feldgroessen: FELDGROESSEN.map((f) => f.id), platzbelegungIds: [] };
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
  if (currentIsAdmin) renderVerwaltung();
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
}

function setupTabs() {
  document.querySelectorAll("nav button[data-tab]").forEach((b) => {
    b.addEventListener("click", () => activateTab(b.dataset.tab));
  });

  // Versionshistorie liegt im oeffentlichen Planen-Tab (siehe index.html), nicht in
  // einem admin-only Tab — fuer jeden eingeloggten Nutzer erreichbar.
  const versionBadgeHeader = document.getElementById("version-badge");
  const openVersionHistory = () => {
    activateTab("planen");
    const panel = document.getElementById("changelog-panel");
    if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  versionBadgeHeader.addEventListener("click", openVersionHistory);
  versionBadgeHeader.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openVersionHistory(); }
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
  document.getElementById("version-badge").textContent = "v" + APP_VERSION;
  document.getElementById("version-badge-2").textContent = "v" + APP_VERSION;
  renderChangelog();
  setupTabs();
  renderFeldgroesseSelects();
  document.getElementById("s-zeit-von").value = SUCHFENSTER_START;
  document.getElementById("s-zeit-bis").value = SUCHFENSTER_ENDE;

  document.getElementById("btn-suche").addEventListener("click", runSlotSuche);
  document.getElementById("suche-ergebnis").addEventListener("click", (e) => {
    const chip = e.target.closest(".gap-chip");
    if (!chip) return;
    document.getElementById("f-datum").value = chip.dataset.datum;
    document.getElementById("f-von").value = chip.dataset.von;
    document.getElementById("f-bis").value = chip.dataset.bis;
    document.getElementById("f-feldgroesse").value = document.getElementById("s-feldgroesse").value;
    renderPlatzSelect();
    document.getElementById("f-platz").value = chip.dataset.platz;
    checkFormOverlap();
    document.getElementById("anfrage-card").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.getElementById("f-typ").addEventListener("change", (e) => {
    document.getElementById("anfrage-card").classList.toggle("typ-lv", e.target.value === "leistungsvergleich");
  });
  document.getElementById("f-feldgroesse").addEventListener("change", () => { renderPlatzSelect(); checkFormOverlap(); });
  ["f-datum", "f-von", "f-bis", "f-platz"].forEach((id) => {
    document.getElementById(id).addEventListener("change", checkFormOverlap);
  });
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
  document.getElementById("btn-export-text").addEventListener("click", exportText);
  document.getElementById("btn-export-pdf").addEventListener("click", exportPdf);

  document.getElementById("btn-add-platz").addEventListener("click", addPlatzEditor);
  document.getElementById("btn-save-einstellungen").addEventListener("click", saveEinstellungen);
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
    // fetchMe() (Identität), gatewayLoad() (eigene Daten) und fetchPlatzbelegung()
    // (Trainingsplan, read-only) sind unabhängige Worker-Aufrufe — parallel statt
    // seriell. Der Trainingsplan ist optional: schlägt er fehl (alter Worker,
    // Netzfehler), läuft die App mit Warnung in der Slot-Suche weiter.
    const [me, data, pb] = await Promise.all([
      fetchMe(),
      gatewayLoad(),
      fetchPlatzbelegung().catch(() => null)
    ]);
    currentUsername = me.username;
    currentIsAdmin = !!me.isAdmin;
    currentVorname = me.vorname || null;
    currentNachname = me.nachname || null;
    if (!currentVorname && !currentNachname) {
      const derived = deriveNameFromUsername(currentUsername);
      currentVorname = derived.vorname;
      currentNachname = derived.nachname;
    }
    currentMannschaften = Array.isArray(me.mannschaften) ? me.mannschaften : [];
    appData = normalizeAppData(data);
    platzbelegungData = normalizePlatzbelegung(pb);
    // Admin-UI rein CSS-reaktiv über die Body-Klasse (kein isAdmin im Render-HTML,
    // siehe startApp-Timing-Gotcha der Geschwister-Apps).
    document.body.classList.toggle("is-admin", currentIsAdmin);
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
