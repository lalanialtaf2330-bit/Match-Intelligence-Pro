
"use strict";

const STORAGE_KEY = "matchIntelligenceProDatabase";

const SPORTS = ["Cricket", "Football", "Tennis"];

let selectedSport = "Cricket";
let matches = [];

let importReport = {
  valid: 0,
  rejected: 0,
  duplicates: 0
};

function getElement(id) {
  return document.getElementById(id);
}

function showMessage(element, message) {
  if (!element) return;

  element.textContent = message;
  element.classList.remove("hidden");
}

function hideMessage(element) {
  if (!element) return;

  element.textContent = "";
  element.classList.add("hidden");
}

function saveDatabase() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(matches)
    );

    updateDashboard();
    return true;

  } catch (error) {
    alert("Unable to save database. Storage may be full.");
    console.error(error);
    return false;
  }
}

function loadDatabase() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      matches = [];
      return;
    }

    const data = JSON.parse(saved);

    if (!Array.isArray(data)) {
      throw new Error("Invalid database.");
    }

    matches = data;

  } catch (error) {
    matches = [];
    console.error(error);
    alert("Unable to load saved database.");
  }
}

function updateConnectionStatus() {
  const dot = getElement("connectionDot");
  const text = getElement("connectionText");

  if (!dot || !text) return;

  if (navigator.onLine) {
    dot.style.background = "#16865b";
    text.textContent = "Browser online";
  } else {
    dot.style.background = "#c43d4b";
    text.textContent = "Offline";
  }
}

window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);

function setupSportSelection() {
  document.querySelectorAll(".sport").forEach(button => {
    button.addEventListener("click", () => {
      selectedSport = button.dataset.sport;

      document.querySelectorAll(".sport").forEach(item => {
        item.classList.remove("active");
      });

      button.classList.add("active");

      getElement("selectedSport").textContent =
        "Currently selected: " + selectedSport;
    });
  });
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  text = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        value += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;

      row.push(value.trim());

      if (row.some(cell => cell !== "")) {
        rows.push(row);
      }

      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (quoted) {
    throw new Error("Unclosed quotation mark in CSV.");
  }

  if (value !== "" || row.length > 0) {
    row.push(value.trim());

    if (row.some(cell => cell !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

function isValidDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsed = new Date(date + "T00:00:00");

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}

function validateMatch(match) {
  if (!isValidDate(match.date)) {
    return "Invalid date.";
  }

  if (!match.home_team || !match.away_team) {
    return "Missing participant.";
  }

  if (
    match.home_team.toLowerCase() ===
    match.away_team.toLowerCase()
  ) {
    return "Participants cannot be identical.";
  }

  if (!match.winner) {
    return "Missing winner.";
  }

  const participants = [
    match.home_team.toLowerCase(),
    match.away_team.toLowerCase()
  ];

  if (
    !participants.includes(match.winner.toLowerCase()) &&
    !["draw", "no result"].includes(match.winner.toLowerCase())
  ) {
    return "Winner must be a participant, Draw or No Result.";
  }

  if (!SPORTS.includes(match.sport)) {
    return "Invalid sport.";
  }

  return null;
}

function createMatchKey(match) {
  return [
    match.sport,
    match.date,
    match.competition,
    match.home_team,
    match.away_team,
    match.format
  ].map(value =>
    String(value || "").trim().toLowerCase()
  ).join("|");
}

async function importCSV() {
  const input = getElement("matchFile");
  const message = getElement("importMessage");

  hideMessage(message);

  if (!input.files.length) {
    showMessage(message, "Please select a CSV file.");
    return;
  }

  const file = input.files[0];

  if (!file.name.toLowerCase().endsWith(".csv")) {
    showMessage(message, "Please select a CSV file.");
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showMessage(message, "File must be smaller than 10 MB.");
    return;
  }

  try {
    const rows = parseCSV(await file.text());

    if (rows.length < 2) {
      throw new Error("No match records found.");
    }

    const headers = rows[0].map(h => h.toLowerCase().trim());

    const required = [
      "date",
      "home_team",
      "away_team",
      "winner"
    ];

    const missing = required.filter(
      column => !headers.includes(column)
    );

    if (missing.length) {
      throw new Error(
        "Missing columns: " + missing.join(", ")
      );
    }

    const existingKeys = new Set(matches.map(createMatchKey));

    const newMatches = [];

    importReport = {
      valid: 0,
      rejected: 0,
      duplicates: 0
    };

    rows.slice(1).forEach((row, index) => {
      const raw = {};

      headers.forEach((header, i) => {
        raw[header] = (row[i] || "").trim();
      });

      const match = {
        id: crypto.randomUUID(),
        date: raw.date || "",
        sport: raw.sport || selectedSport,
        competition: raw.competition || "",
        format: raw.format || "",
        home_team: raw.home_team || "",
        away_team: raw.away_team || "",
        winner: raw.winner || "",
        home_score: raw.home_score || "",
        away_score: raw.away_score || "",
        venue: raw.venue || "",
        surface: raw.surface || ""
      };

      const error = validateMatch(match);

      if (error) {
        importReport.rejected++;
        console.warn("CSV row " + (index + 2), error);
        return;
      }

      const key = createMatchKey(match);

      if (existingKeys.has(key)) {
        importReport.duplicates++;
        return;
      }

      existingKeys.add(key);
      newMatches.push(match);
      importReport.valid++;
    });

    const updatedMatches = [...matches, ...newMatches];

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updatedMatches)
    );

    matches = updatedMatches;

    updateDashboard();
    renderMatches();
    updateHealth();

    showMessage(
      message,
      "Import completed!\n" +
      "Valid: " + importReport.valid + "\n" +
      "Rejected: " + importReport.rejected + "\n" +
      "Duplicates: " + importReport.duplicates
    );

    input.value = "";

  } catch (error) {
    showMessage(message, "Import failed: " + error.message);
    console.error(error);
  }
}

function updateDashboard() {
  getElement("totalMatches").textContent = matches.length;

  const sports = new Set(matches.map(m => m.sport));

  getElement("totalSports").textContent = sports.size;

  getElement("storageStatus").textContent = "Local";
}

function updateHealth() {
  getElement("validRecords").textContent = importReport.valid;
  getElement("rejectedRecords").textContent = importReport.rejected;
  getElement("duplicateRecords").textContent = importReport.duplicates;
}

function getFilteredMatches() {
  const sport = getElement("filterSport").value;
  const search = getElement("filterTeam").value.toLowerCase().trim();
  const from = getElement("filterFrom").value;
  const to = getElement("filterTo").value;

  return matches.filter(match => {
    const sportMatch = sport === "All" || match.sport === sport;

    const teamMatch =
      !search ||
      match.home_team.toLowerCase().includes(search) ||
      match.away_team.toLowerCase().includes(search);

    return (
      sportMatch &&
      teamMatch &&
      (!from || match.date >= from) &&
      (!to || match.date <= to)
    );
  });
}

function renderMatches() {
  const table = getElement("matchTable");
  const count = getElement("recordCount");

  const filtered = getFilteredMatches();

  table.replaceChildren();

  if (!filtered.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 4;
    cell.textContent = "No matching records found.";

    row.appendChild(cell);
    table.appendChild(row);
  } else {
    filtered.sort((a, b) => b.date.localeCompare(a.date));

    filtered.forEach(match => {
      const row = document.createElement("tr");

      [
        match.date,
        match.sport,
        match.home_team + " vs " + match.away_team,
        match.winner
      ].forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });

      table.appendChild(row);
    });
  }

  count.textContent =
    "Showing " + filtered.length +
    " of " + matches.length + " records";
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadTemplate() {
  const csv = [
    "date,sport,competition,format,home_team,away_team,winner,home_score,away_score,venue,surface",
    "2025-01-15,Cricket,Example Cup,T20,Team A,Team B,Team A,180/5,165/8,Example Stadium,Grass",
    "2025-01-16,Football,Example League,League,Team C,Team D,Draw,1,1,Example Ground,Grass",
    "2025-01-17,Tennis,Example Open,Singles,Player A,Player B,Player A,2 sets,1 set,Example Court,Hard"
  ].join("\n");

  downloadFile(csv, "match-template.csv", "text/csv");
}

function exportJSON() {
  const backup = {
    application: "Match Intelligence Pro",
    version: 1,
    exportedAt: new Date().toISOString(),
    totalMatches: matches.length,
    matches: matches
  };

  downloadFile(
    JSON.stringify(backup, null, 2),
    "match-intelligence-backup.json",
    "application/json"
  );
}

function exportCSV() {
  const headers = [
    "date", "sport", "competition", "format",
    "home_team", "away_team", "winner",
    "home_score", "away_score", "venue", "surface"
  ];

  function escapeCSV(value) {
    return '"' + String(value ?? "").replace(/"/g, '""') + '"';
  }

  const lines = [
    headers.join(","),
    ...matches.map(match =>
      headers.map(header => escapeCSV(match[header])).join(",")
    )
  ];

  downloadFile(
    "\uFEFF" + lines.join("\r\n"),
    "match-intelligence-matches.csv",
    "text/csv;charset=utf-8"
  );
}

async function restoreBackup() {
  const input = getElement("backupFile");

  if (!input.files.length) {
    alert("Select a JSON backup first.");
    return;
  }

  if (!confirm("Replace your current database with this backup?")) {
    return;
  }

  try {
    const file = input.files[0];

    if (file.size > 20 * 1024 * 1024) {
      throw new Error("Backup must be smaller than 20 MB.");
    }

    const backup = JSON.parse(await file.text());

    const restored = Array.isArray(backup)
      ? backup
      : backup.matches;

    if (!Array.isArray(restored)) {
      throw new Error("Invalid backup file.");
    }

    const keys = new Set();

    for (const match of restored) {
      const error = validateMatch(match);

      if (error) throw new Error(error);

      const key = createMatchKey(match);

      if (keys.has(key)) {
        throw new Error("Backup contains duplicate matches.");
      }

      keys.add(key);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(restored));

    matches = restored;

    importReport = { valid: 0, rejected: 0, duplicates: 0 };

    updateDashboard();
    renderMatches();
    updateHealth();

    input.value = "";

    alert("Backup restored successfully.");

  } catch (error) {
    alert("Restore failed: " + error.message);
  }
}

function clearDatabase() {
  if (!matches.length) {
    alert("Database is already empty.");
    return;
  }

  if (!confirm("Permanently delete all local match records?")) {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);

  matches = [];
  importReport = { valid: 0, rejected: 0, duplicates: 0 };

  updateDashboard();
  renderMatches();
  updateHealth();

  alert("Database cleared.");
}

function setupEventListeners() {
  getElement("importMatches").addEventListener("click", importCSV);
  getElement("downloadTemplate").addEventListener("click", downloadTemplate);
  getElement("applyFilters").addEventListener("click", renderMatches);
  getElement("exportJSON").addEventListener("click", exportJSON);
  getElement("exportCSV").addEventListener("click", exportCSV);
  getElement("restoreBackup").addEventListener("click", restoreBackup);
  getElement("clearDatabase").addEventListener("click", clearDatabase);

  getElement("filterTeam").addEventListener("input", renderMatches);
  getElement("filterSport").addEventListener("change", renderMatches);
  getElement("filterFrom").addEventListener("change", renderMatches);
  getElement("filterTo").addEventListener("change", renderMatches);
}

function startApplication() {
  loadDatabase();
  setupSportSelection();
  setupEventListeners();
  updateConnectionStatus();
  updateDashboard();
  updateHealth();
  renderMatches();

  console.log("Match Intelligence Pro is ready.");
}

document.addEventListener("DOMContentLoaded", startApplication);

