const players = [
  { id: "dad", name: "Dad", color: "#ff5a1f" },
  { id: "cameron", name: "Cameron", color: "#1f8f7a" },
];

const scoreActions = {
  durango: { label: "Dodge Durango", delta: 1 },
  cybertruck: { label: "Tesla Cybertruck", delta: 0.5 },
  penalty: { label: "Wrong vehicle", delta: -1 },
};

const supabaseUrl = "https://tgibfvgfcaxuyprmpons.supabase.co";
const supabasePublishableKey = "sb_publishable_oDbqbqXwcBhPAqNH7VmPBQ_wla8Abzb";
const gameId = "one-family-scoreboard";
const storageKey = "one-scorebook-v1";
const themeKey = "one-theme";
const syncRetryDelay = 5000;
const requestTimeout = 8000;
const remotePageSize = 500;
const remoteIdChunkSize = 75;
const appVersion = "v11";
const syncedStatus = "synced";
const pendingStatus = "pending";
const failedStatus = "failed";
let state = loadState();
let activePlayer = players[0].id;
let calendarDate = new Date();
let currentDateKey = getCurrentDateKey();
let selectedDateKey = currentDateKey;
let isRemoteReady = false;
let isRendering = false;
let syncTimer = null;
let syncPromise = null;

const els = {
  splash: document.querySelector("#splash"),
  todayLabel: document.querySelector("#todayLabel"),
  syncStatus: document.querySelector("#syncStatus"),
  themeToggle: document.querySelector("#themeToggle"),
  themeIcon: document.querySelector("#themeIcon"),
  playerCards: document.querySelector("#playerCards"),
  combinedTotal: document.querySelector("#combinedTotal"),
  activityList: document.querySelector("#activityList"),
  undoButton: document.querySelector("#undoButton"),
  emptyActivityTemplate: document.querySelector("#emptyActivityTemplate"),
  scoreDialog: document.querySelector("#scoreDialog"),
  openAdd: document.querySelector("#openAdd"),
  playerPicker: document.querySelector("#playerPicker"),
  editCallList: document.querySelector("#editCallList"),
  navButtons: document.querySelectorAll("[data-view]"),
  leaderboardView: document.querySelector("#leaderboardView"),
  calendarView: document.querySelector("#calendarView"),
  prevMonth: document.querySelector("#prevMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  monthTitle: document.querySelector("#monthTitle"),
  calendarGrid: document.querySelector("#calendarGrid"),
  selectedDayTitle: document.querySelector("#selectedDayTitle"),
  selectedWinner: document.querySelector("#selectedWinner"),
  dayDetail: document.querySelector("#dayDetail"),
};

init();

function init() {
  window.OneAppDebug = {
    version: appVersion,
    lastRemoteRowCount: 0,
    lastRemotePageCount: 0,
    lastSyncAt: null,
  };
  document.documentElement.dataset.theme = getInitialTheme();
  updateTodayLabel();
  setThemeIcon();
  seedToday();
  renderPlayerPicker();
  render();
  bindEvents();
  registerServiceWorker();
  connectSupabase();

  window.setTimeout(() => {
    els.splash.classList.add("is-hidden");
  }, 850);
}

function bindEvents() {
  els.themeToggle.addEventListener("click", toggleTheme);
  els.openAdd.addEventListener("click", () => {
    renderEditCallList();
    els.scoreDialog.showModal();
  });
  els.undoButton.addEventListener("click", undoLast);
  els.editCallList.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-entry]");
    if (!deleteButton) return;
    deleteEntry(currentDateKey, deleteButton.dataset.deleteEntry);
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      addEntry(activePlayer, button.dataset.action);
      els.scoreDialog.close();
    });
  });

  els.navButtons.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  els.prevMonth.addEventListener("click", () => {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
    renderCalendar();
  });

  els.nextMonth.addEventListener("click", () => {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
    renderCalendar();
  });

  window.addEventListener("online", connectSupabase);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !isRemoteReady) {
      connectSupabase();
    }
  });
}

function render() {
  if (isRendering) return;
  isRendering = true;
  refreshCurrentDate();
  seedToday();
  renderLeaderboard();
  renderActivity();
  renderEditCallList();
  renderCalendar();
  saveState();
  isRendering = false;
}

function seedToday() {
  if (!state.days[currentDateKey]) {
    state.days[currentDateKey] = { entries: [] };
  }
}

function renderLeaderboard() {
  const totals = getTotals(currentDateKey);
  const leaderId = getLeader(totals);
  els.combinedTotal.textContent = `${formatScore(sumScores(totals))} pts`;
  els.playerCards.innerHTML = "";

  players.forEach((player) => {
    const card = document.createElement("article");
    card.className = "player-card";
    card.style.setProperty("--player-color", player.color);
    const playerEntries = getEntries(currentDateKey).filter((entry) => entry.playerId === player.id);
    const durangos = playerEntries.filter((entry) => entry.action === "durango").length;
    const cybertrucks = playerEntries.filter((entry) => entry.action === "cybertruck").length;
    const penalties = playerEntries.filter((entry) => entry.action === "penalty").length;

    card.innerHTML = `
      <div>
        <p class="player-name">${player.name}</p>
        <span class="leader-tag">${leaderId === player.id ? "Leading today" : "In the hunt"}</span>
        <div class="stats-row">
          <span class="stat-chip">${durangos} Durango</span>
          <span class="stat-chip">${cybertrucks} Cybertruck</span>
          <span class="stat-chip">${penalties} Miss</span>
        </div>
      </div>
      <div class="score">${formatScore(totals[player.id])}</div>
    `;
    els.playerCards.append(card);
  });
}

function renderActivity() {
  const recent = [...getEntries(currentDateKey)].reverse().slice(0, 6);
  els.activityList.innerHTML = "";
  els.undoButton.disabled = getEntries(currentDateKey).length === 0;

  if (!recent.length) {
    els.activityList.append(els.emptyActivityTemplate.content.cloneNode(true));
    return;
  }

  recent.forEach((entry) => {
    const player = players.find((item) => item.id === entry.playerId);
    const action = scoreActions[entry.action];
    const item = document.createElement("div");
    item.className = "activity-item";
    item.innerHTML = `
      <div class="activity-main">
        <strong>${player.name}</strong>
        <span>${action.label} · ${formatTime(entry.createdAt)}</span>
      </div>
      <div class="activity-score">${action.delta > 0 ? "+" : ""}${formatScore(action.delta)}</div>
    `;
    els.activityList.append(item);
  });
}

function renderEditCallList() {
  const entries = [...getEntries(currentDateKey)].reverse();
  els.editCallList.innerHTML = "";

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No calls to edit yet.";
    els.editCallList.append(empty);
    return;
  }

  entries.forEach((entry) => {
    const player = players.find((item) => item.id === entry.playerId);
    const action = scoreActions[entry.action];
    const item = document.createElement("div");
    item.className = "edit-call-item";
    item.innerHTML = `
      <div class="activity-main">
        <strong>${player.name}</strong>
        <span>${action.label} · ${formatTime(entry.createdAt)}</span>
      </div>
      <div class="edit-call-actions">
        <span class="activity-score">${action.delta > 0 ? "+" : ""}${formatScore(action.delta)}</span>
        <button class="delete-call-button" type="button" data-delete-entry="${entry.id}" aria-label="Remove ${player.name} ${action.label} call">
          ×
        </button>
      </div>
    `;
    els.editCallList.append(item);
  });
}

function renderPlayerPicker() {
  els.playerPicker.innerHTML = "";
  players.forEach((player) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `segment-button${player.id === activePlayer ? " is-selected" : ""}`;
    button.textContent = player.name;
    button.addEventListener("click", () => {
      activePlayer = player.id;
      renderPlayerPicker();
    });
    els.playerPicker.append(button);
  });
}

function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstOfMonth.getDay());
  els.monthTitle.textContent = formatDate(firstOfMonth, { month: "long", year: "numeric" });
  els.calendarGrid.innerHTML = "";

  ["S", "M", "T", "W", "T", "F", "S"].forEach((day) => {
    const label = document.createElement("div");
    label.className = "weekday";
    label.textContent = day;
    els.calendarGrid.append(label);
  });

  for (let index = 0; index < 42; index += 1) {
    const cellDate = new Date(start);
    cellDate.setDate(start.getDate() + index);
    const dateKey = toDateKey(cellDate);
    const totals = getTotals(dateKey);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day-cell";
    if (cellDate.getMonth() !== month) cell.classList.add("is-outside");
    if (dateKey === selectedDateKey) cell.classList.add("is-selected");
    cell.innerHTML = `
      <span class="day-number">${cellDate.getDate()}</span>
      <span class="day-score">
        <span>D ${formatScore(totals.dad)}</span>
        <span>C ${formatScore(totals.cameron)}</span>
      </span>
    `;
    cell.addEventListener("click", () => {
      selectedDateKey = dateKey;
      calendarDate = new Date(cellDate);
      renderCalendar();
    });
    els.calendarGrid.append(cell);
  }

  renderDayDetail();
}

function renderDayDetail() {
  const date = fromDateKey(selectedDateKey);
  const totals = getTotals(selectedDateKey);
  const leaderId = getLeader(totals);
  const entries = getEntries(selectedDateKey);
  els.selectedDayTitle.textContent = formatDate(date, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  els.selectedWinner.textContent = leaderId
    ? `${players.find((player) => player.id === leaderId).name} leads`
    : "Tied";
  els.dayDetail.innerHTML = "";

  players.forEach((player) => {
    const row = document.createElement("div");
    row.className = "day-player-row";
    row.innerHTML = `<span>${player.name}</span><span>${formatScore(totals[player.id])} pts</span>`;
    els.dayDetail.append(row);
  });

  const meta = document.createElement("p");
  meta.className = "empty-state";
  meta.textContent = `${entries.length} call${entries.length === 1 ? "" : "s"} logged`;
  els.dayDetail.append(meta);
}

function setView(view) {
  const isCalendar = view === "calendar";
  els.leaderboardView.classList.toggle("is-active", !isCalendar);
  els.calendarView.classList.toggle("is-active", isCalendar);
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });
}

async function addEntry(playerId, action) {
  refreshCurrentDate();
  seedToday();
  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    playerId,
    action,
    gameDate: currentDateKey,
    createdAt: new Date().toISOString(),
    syncStatus: pendingStatus,
  };
  state.days[currentDateKey].entries.push(entry);
  render();
  await saveRemoteEntry(entry);
}

async function undoLast() {
  refreshCurrentDate();
  const entries = getEntries(currentDateKey);
  if (!entries.length) return;
  const removed = entries.pop();
  render();
  await deleteRemoteEntry(removed);
}

async function deleteEntry(dateKey, entryId) {
  const entries = getEntries(dateKey);
  const entryIndex = entries.findIndex((entry) => entry.id === entryId);
  if (entryIndex === -1) return;

  const [removed] = entries.splice(entryIndex, 1);
  render();
  await deleteRemoteEntry(removed);
}

function getEntries(dateKey) {
  return state.days[dateKey]?.entries ?? [];
}

function getTotals(dateKey) {
  return getEntries(dateKey).reduce(
    (totals, entry) => {
      totals[entry.playerId] += scoreActions[entry.action].delta;
      return totals;
    },
    { dad: 0, cameron: 0 },
  );
}

function getLeader(totals) {
  if (totals.dad === totals.cameron) return null;
  return totals.dad > totals.cameron ? "dad" : "cameron";
}

function sumScores(totals) {
  return Object.values(totals).reduce((sum, score) => sum + score, 0);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved?.days) return saved;
  } catch {
    localStorage.removeItem(storageKey);
  }
  return { days: {} };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

async function connectSupabase() {
  if (syncPromise) return syncPromise;
  syncPromise = runSupabaseSync().finally(() => {
    syncPromise = null;
  });
  return syncPromise;
}

async function runSupabaseSync() {
  if (!navigator.onLine) {
    isRemoteReady = false;
    setSyncStatus("Offline", "error");
    scheduleSyncRetry();
    return;
  }

  setSyncStatus("Connecting", "pending");
  try {
    const syncStartedAt = new Date().toISOString();
    const localEntries = getAllEntries();
    await loadRemoteEntries({ syncStartedAt });
    isRemoteReady = true;
    setSyncStatus("Synced", "online");
    clearSyncRetry();
    pushLocalEntries(localEntries)
      .then(() => loadRemoteEntries({ preserveLocalEntries: true }))
      .catch((error) => {
        console.warn("Local backfill skipped", error);
      });
  } catch (error) {
    console.warn("Supabase sync unavailable", error);
    isRemoteReady = false;
    setSyncStatus("Local", "error");
    scheduleSyncRetry();
  }
}

async function loadRemoteEntries(options = {}) {
  const data = await fetchRemoteEntries();
  const localEntries = getAllEntries();
  const remoteIds = new Set(data.map((row) => row.id));
  state = { days: {} };
  data.forEach((row) => {
    addEntryToState(remoteRowToEntry(row));
  });
  localEntries
    .filter((entry) => shouldPreserveLocalEntry(entry, remoteIds, options))
    .forEach(addEntryToState);
  seedToday();
  render();
}

async function pushLocalEntries(entries = getUnsyncedEntries()) {
  entries = entries.map(ensureRemoteSafeEntry);
  if (!entries.length) return;

  const remoteIds = await fetchRemoteIds(entries.map((entry) => entry.id));
  const missingEntries = entries.filter((entry) => !remoteIds.has(entry.id));
  if (!missingEntries.length) {
    entries.forEach((entry) => updateLocalEntry(entry.id, { syncStatus: syncedStatus }));
    return;
  }

  await supabaseRequest("/sightings", {
    method: "POST",
    body: missingEntries.map(entryToRemoteRow),
    prefer: "return=minimal",
  }).catch((error) => {
    if (!isDuplicateInsertError(error)) throw error;
  });
  entries.forEach((entry) => updateLocalEntry(entry.id, { syncStatus: syncedStatus }));
  saveState();
}

function getAllEntries() {
  return Object.entries(state.days).flatMap(([dateKey, day]) =>
    (day.entries ?? []).map((entry) => normalizeEntry(entry, dateKey)),
  );
}

function getUnsyncedEntries() {
  return getAllEntries().filter((entry) => entry.syncStatus !== syncedStatus);
}

function shouldPreserveLocalEntry(entry, remoteIds, options) {
  if (remoteIds.has(entry.id)) return false;
  if (options.preserveLocalEntries) return true;
  if (entry.syncStatus !== syncedStatus) return true;
  return Boolean(options.syncStartedAt && entry.createdAt > options.syncStartedAt);
}

async function fetchRemoteEntries() {
  const rows = [];
  let offset = 0;
  let pageCount = 0;

  while (true) {
    const page = await supabaseRequest(
      `/sightings?game_id=eq.${encodeURIComponent(gameId)}&select=id,player_id,action,game_date,created_at&order=created_at.asc&limit=${remotePageSize}&offset=${offset}`,
    );
    rows.push(...page);
    pageCount += 1;
    if (page.length < remotePageSize) break;
    offset += remotePageSize;
  }

  window.OneAppDebug = {
    ...window.OneAppDebug,
    lastRemoteRowCount: rows.length,
    lastRemotePageCount: pageCount,
    lastSyncAt: new Date().toISOString(),
  };
  return rows;
}

async function fetchRemoteIds(ids) {
  const remoteIds = new Set();
  for (let index = 0; index < ids.length; index += remoteIdChunkSize) {
    const chunk = ids.slice(index, index + remoteIdChunkSize);
    const idFilter = chunk.join(",");
    const data = await supabaseRequest(
      `/sightings?game_id=eq.${encodeURIComponent(gameId)}&id=in.(${idFilter})&select=id`,
    );
    data.forEach((row) => remoteIds.add(row.id));
  }
  return remoteIds;
}

async function saveRemoteEntry(entry) {
  if (!navigator.onLine) {
    updateLocalEntry(entry.id, { syncStatus: failedStatus });
    setSyncStatus("Local", "error");
    scheduleSyncRetry();
    return;
  }

  setSyncStatus("Saving", "pending");
  try {
    const remoteEntry = ensureRemoteSafeEntry(entry);
    await supabaseRequest("/sightings", {
      method: "POST",
      body: entryToRemoteRow(remoteEntry),
      prefer: "return=minimal",
    });
  } catch (error) {
    if (isDuplicateInsertError(error)) {
      updateLocalEntry(entry.id, { syncStatus: syncedStatus });
      isRemoteReady = true;
      setSyncStatus("Synced", "online");
      clearSyncRetry();
      return;
    }
    console.warn("Could not save sighting", error);
    updateLocalEntry(entry.id, { syncStatus: failedStatus });
    isRemoteReady = false;
    setSyncStatus("Local", "error");
    scheduleSyncRetry();
    return;
  }

  updateLocalEntry(entry.id, { syncStatus: syncedStatus });
  addEntryToState({ ...entry, syncStatus: syncedStatus });
  render();
  isRemoteReady = true;
  setSyncStatus("Synced", "online");
  clearSyncRetry();
}

async function deleteRemoteEntry(entry) {
  if (!navigator.onLine || !entry?.id) {
    setSyncStatus("Local", "error");
    scheduleSyncRetry();
    return;
  }

  setSyncStatus("Saving", "pending");
  try {
    await supabaseRequest(`/sightings?game_id=eq.${encodeURIComponent(gameId)}&id=eq.${entry.id}`, {
      method: "DELETE",
      prefer: "return=minimal",
    });
  } catch (error) {
    console.warn("Could not delete sighting", error);
    isRemoteReady = false;
    setSyncStatus("Local", "error");
    scheduleSyncRetry();
    return;
  }

  isRemoteReady = true;
  setSyncStatus("Synced", "online");
  clearSyncRetry();
}

function addEntryToState(entry) {
  const dateKey = entry.gameDate || toDateKey(new Date(entry.createdAt));
  if (!state.days[dateKey]) state.days[dateKey] = { entries: [] };
  if (!state.days[dateKey].entries.some((item) => item.id === entry.id)) {
    state.days[dateKey].entries.push(entry);
  }
}

function normalizeEntry(entry, fallbackDateKey) {
  return {
    id: entry.id,
    playerId: entry.playerId,
    action: entry.action,
    gameDate: entry.gameDate || fallbackDateKey,
    createdAt: entry.createdAt || new Date().toISOString(),
    syncStatus: entry.syncStatus || pendingStatus,
  };
}

function ensureRemoteSafeEntry(entry) {
  if (!isUuid(entry.id)) {
    entry.id = crypto.randomUUID ? crypto.randomUUID() : makeUuidFallback();
  }
  return entry;
}

async function supabaseRequest(path, options = {}) {
  const method = options.method || "GET";
  const headers = {
    apikey: supabasePublishableKey,
    Authorization: `Bearer ${supabasePublishableKey}`,
  };
  if (options.body) headers["Content-Type"] = "application/json";
  if (options.prefer) headers.Prefer = options.prefer;

  const response = await fetchWithRetry(`${supabaseUrl}/rest/v1${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase ${method} ${path} failed: ${response.status} ${message}`);
  }

  if (response.status === 204 || options.prefer === "return=minimal") return null;
  return response.json();
}

async function fetchWithRetry(url, options, attempts = 1) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), requestTimeout);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) break;
      await wait(350 * (attempt + 1));
    } finally {
      window.clearTimeout(timeout);
    }
  }
  throw lastError;
}

function scheduleSyncRetry() {
  if (syncTimer || !navigator.onLine) return;
  syncTimer = window.setTimeout(() => {
    syncTimer = null;
    connectSupabase();
  }, syncRetryDelay);
}

function clearSyncRetry() {
  if (!syncTimer) return;
  window.clearTimeout(syncTimer);
  syncTimer = null;
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function entryToRemoteRow(entry) {
  const action = scoreActions[entry.action];
  return {
    id: entry.id,
    game_id: gameId,
    player_id: entry.playerId,
    action: entry.action,
    points: action.delta,
    game_date: entry.gameDate || toDateKey(new Date(entry.createdAt)),
    created_at: entry.createdAt,
  };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isDuplicateInsertError(error) {
  return String(error?.message || error).includes("23505");
}

function makeUuidFallback() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) =>
    (Number(char) ^ (Math.random() * 16) >> (Number(char) / 4)).toString(16),
  );
}

function remoteRowToEntry(row) {
  return {
    id: row.id,
    playerId: row.player_id,
    action: row.action,
    gameDate: row.game_date,
    createdAt: row.created_at,
    syncStatus: syncedStatus,
  };
}

function updateLocalEntry(entryId, updates) {
  Object.values(state.days).some((day) => {
    const entry = day.entries?.find((item) => item.id === entryId);
    if (!entry) return false;
    Object.assign(entry, updates);
    return true;
  });
  saveState();
}

function setSyncStatus(label, status) {
  els.syncStatus.textContent = label;
  els.syncStatus.classList.toggle("is-online", status === "online");
  els.syncStatus.classList.toggle("is-error", status === "error");
  els.syncStatus.classList.toggle("is-pending", status === "pending");
}

function getInitialTheme() {
  const saved = localStorage.getItem(themeKey);
  if (saved) return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function refreshCurrentDate() {
  const nextDateKey = getCurrentDateKey();
  if (nextDateKey !== currentDateKey) {
    currentDateKey = nextDateKey;
    selectedDateKey = nextDateKey;
    calendarDate = new Date();
    updateTodayLabel();
  }
}

function updateTodayLabel() {
  els.todayLabel.textContent = formatDate(new Date(), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getCurrentDateKey() {
  return toDateKey(new Date());
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem(themeKey, nextTheme);
  setThemeIcon();
}

function setThemeIcon() {
  els.themeIcon.textContent = document.documentElement.dataset.theme === "dark" ? "☀" : "◐";
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date, options) {
  return new Intl.DateTimeFormat("en-US", options).format(date);
}

function formatTime(iso) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatScore(score) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}
