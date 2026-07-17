
"use strict";

const MAX_DROP_BYTES = 64 * 1024 * 1024;


const ICONS = {
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  pencil: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  pin: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  play: '<polygon points="6 3 20 12 6 21" fill="currentColor" stroke="none"/>',
  text: '<line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/>',
  clip: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  film: '<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  filetext: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  file: '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>',
  arrowleft: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  arrowright: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  slash: '<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  plug: '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
};

const COLORS = {
  red: "#d64545", orange: "#d9822b", yellow: "#d4b13d", green: "#57a05a",
  teal: "#3f9f96", blue: "#4a8fd4", purple: "#8a6fd6", pink: "#c9569b",
};
const COLOR_TAG_RE = new RegExp(
  `\\[(${Object.keys(COLORS).join("|")})\\s*:\\s*([^\\]]*)\\]`, "gi");

function icon(name, size = 16, filled = false) {
  const span = document.createElement("span");
  span.className = "icon";
  span.innerHTML =
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" ` +
    `fill="${filled ? "currentColor" : "none"}" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    ICONS[name] + "</svg>";
  return span;
}

const state = {
  boards: [],
  boardId: null,
  board: null,
  openCardId: null,
  composer: null,
  editingList: null,
  editBoardId: null,
  search: "",
  cardSearch: "",
  searchOpen: false,
  editingDesc: false,
  editingTitle: false,
};

let drag = null;
let modalOpenedAt = 0;
const attCache = new Map();

const HIST_LIMIT = 30;
let histUndo = [];
let histRedo = [];
let lastBoardSnap = null;

function boardDoc() {
  if (!state.board) return null;
  return { ...state.board.board,
    lists: state.board.lists.map((l) => ({ id: l.id, name: l.name,
      cards: l.cards.map((c) => {
        const copy = { ...c, tags: [...(c.tags || [])],
          attachments: (c.attachments || []).map((a) => ({ ...a })) };
        delete copy.list_id;
        return copy;
      }) })) };
}

function snapshotNow() {
  const doc = boardDoc();
  return doc ? JSON.stringify(doc) : null;
}

function commitHistory() {
  if (!lastBoardSnap) return;
  histUndo.push(lastBoardSnap);
  if (histUndo.length > HIST_LIMIT) histUndo.shift();
  histRedo = [];
}

function commitLocal() {
  commitHistory();
  lastBoardSnap = snapshotNow();
}

function clearHistory() {
  histUndo = [];
  histRedo = [];
  lastBoardSnap = null;
}

async function undoBoard() {
  if (!histUndo.length || !state.board) return;
  const snap = histUndo.pop();
  if (lastBoardSnap) histRedo.push(lastBoardSnap);
  try { await pyapi("restore_board", state.boardId, JSON.parse(snap)); }
  catch { return; }
  refreshBoard();
}

async function redoBoard() {
  if (!histRedo.length || !state.board) return;
  const snap = histRedo.pop();
  if (lastBoardSnap) histUndo.push(lastBoardSnap);
  try { await pyapi("restore_board", state.boardId, JSON.parse(snap)); }
  catch { return; }
  refreshBoard();
}

let lastView = null;
let viewEntering = false;
let composerNew = false;
let searchNew = false;
let enterCardId = null;
let enterListId = null;

function bindOverlayClose(overlay, close, extraGuard) {
  let armed = false;
  overlay.addEventListener("mousedown", (e) => { armed = e.target === overlay; });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay && armed && (!extraGuard || extraGuard())) close();
    armed = false;
  });
}

function closeOverlay(target) {
  const ov = target && target.classList && target.classList.contains("overlay")
    ? target
    : target && target.firstElementChild;
  if (!ov || ov.classList.contains("closing")) return;
  ov.classList.add("closing");
  setTimeout(() => { if (ov.parentNode) ov.remove(); }, 140);
}

const qs = (sel) => document.querySelector(sel);


function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === "class") el.className = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k === "style") Object.assign(el.style, v);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : String(c));
  }
  return el;
}


function pyapi(method, ...args) {
  if (!window.pywebview || !window.pywebview.api) {
    return Promise.reject(new Error("Backend not ready"));
  }
  return window.pywebview.api[method](...args).then(
    (res) => {
      if (res && typeof res === "object" && res.error) {
        console.error(res.error);
        throw new Error(res.error);
      }
      return res;
    },
    (err) => {
      console.error(err);
      throw err;
    }
  );
}


function fmtSize(n) {
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
  if (n < 1073741824) return (n / 1048576).toFixed(1) + " MB";
  return (n / 1073741824).toFixed(2) + " GB";
}


function renderInline(text) {
  let s = String(text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__(.+?)__/g, "<u>$1</u>");
  s = s.replace(/~~(.+?)~~/g, "<s>$1</s>");
  s = s.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(COLOR_TAG_RE,
    (_, c, t) => `<span style="color:${COLORS[c.toLowerCase()]}">${t}</span>`);
  return s;
}

function renderMarkup(text) {
  return String(text).split("\n")
    .map((line) => "<p>" + (renderInline(line) || "&nbsp;") + "</p>")
    .join("");
}

function stripMarkup(text) {
  let s = String(text);
  s = s.replace(/\*\*(.+?)\*\*/g, "$1");
  s = s.replace(/__(.+?)__/g, "$1");
  s = s.replace(/~~(.+?)~~/g, "$1");
  s = s.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1$2");
  s = s.replace(COLOR_TAG_RE, "$2");
  return s;
}

function focusEnd(el) {
  el.focus();
  const n = el.value.length;
  try { el.setSelectionRange(n, n); } catch {  }
}

function fmtDate(s) {
  if (!s) return "";
  const d = new Date(String(s).replace(" ", "T"));
  if (isNaN(d)) return String(s).split(" ")[0];
  return (d.getMonth() + 1) + "/" + d.getDate() + "/" + d.getFullYear();
}

function deleteMsg(name) {
  const s = h("span", {}, "Are you sure you want to delete ");
  const n = h("strong");
  n.innerHTML = renderInline(name);
  s.append(n, "?");
  return s;
}

function isTyping() {
  const t = document.activeElement;
  return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}

function findCard(id) {
  for (const l of (state.board ? state.board.lists : [])) {
    for (const c of l.cards) if (c.id === id) return c;
  }
  return null;
}


const attReady = new Map();

function getAttData(id) {
  if (!attCache.has(id)) {
    const p = pyapi("get_attachment_data", id).then((res) => {
      if (res.too_large) {
        const err = new Error("too large");
        err.tooLarge = true;
        err.size = res.size;
        throw err;
      }
      attReady.set(id, res);
      return res;
    });
    p.catch(() => attCache.delete(id));
    attCache.set(id, p);
  }
  return attCache.get(id);
}

function hydrate(root) {
  for (const img of root.querySelectorAll("img[data-att-id]")) {
    if (img.dataset.loaded) continue;
    const ready = attReady.get(Number(img.dataset.attId));
    if (ready) {
      img.src = ready.data_uri;
      img.dataset.loaded = "1";
      continue;
    }
    getAttData(Number(img.dataset.attId))
      .then((d) => { img.src = d.data_uri; img.dataset.loaded = "1"; })
      .catch(() => { img.closest(".card-cover") && img.remove(); });
  }
}


async function refreshBoards() {
  state.boards = await pyapi("get_boards");
}

async function refreshBoard() {
  if (state.boardId == null) {
    state.board = null;
  } else {
    try {
      state.board = await pyapi("get_board", state.boardId);
    } catch {
      state.boardId = null;
      state.board = null;
    }
  }
  lastBoardSnap = snapshotNow();
  render();
  renderModal();
}

function switchBoard(id) {
  state.boardId = id;
  state.composer = null;
  state.openCardId = null;
  state.editingList = null;
  state.cardSearch = "";
  state.searchOpen = false;
  clearHistory();
  refreshBoard();
}

async function goHome() {
  state.boardId = null;
  state.board = null;
  state.composer = null;
  state.openCardId = null;
  state.editingList = null;
  state.cardSearch = "";
  state.searchOpen = false;
  clearHistory();
  renderModal();
  try { await refreshBoards(); } catch {  }
  render();
}

async function createBoard(name, description = "") {
  try { await pyapi("create_board", name, description); } catch { return; }
  await refreshBoards();
  render();
}

async function deleteBoard(b) {
  const ok = await confirmDialog(deleteMsg(b.name));
  if (!ok) return;
  try { await pyapi("delete_board", b.id); } catch { return; }
  await refreshBoards();
  render();
}

async function saveBoardFields(id, fields) {
  try { await pyapi("update_board", id, fields); } catch {  }
  await refreshBoards();
  render();
}


function renderTopbar() {
  const bar = qs("#topbar");
  const inBoard = state.boardId != null && state.board;
  bar.hidden = !inBoard;
  const ctx = qs("#topbar-ctx");
  ctx.innerHTML = "";
  if (inBoard) {
    const nameEl = h("span", { class: "topbar-name" });
    nameEl.innerHTML = renderInline(state.board.board.name);
    ctx.append(
      h("button", { class: "icon-btn back-btn", onclick: goHome },
        icon("arrowleft", 18)),
      nameEl);
    if (state.board.board.description) {
      const descEl = h("span", { class: "topbar-desc" });
      descEl.innerHTML = "- " + renderInline(state.board.board.description);
      ctx.append(descEl);
    }
    const collapse = () => {
      state.searchOpen = false;
      state.cardSearch = "";
      renderTopbar();
      applyCardHighlights();
    };
    const right = h("div", { class: "topbar-right" });
    if (state.searchOpen) {
      const input = h("input", {
        class: "tag-search-input" + (searchNew ? " enter" : ""),
        value: state.cardSearch,
        placeholder: "Search tags…",
        oninput: (e) => {
          state.cardSearch = e.target.value;
          applyCardHighlights();
        },
        onblur: (e) => { if (!e.target.value.trim()) collapse(); },
        onkeydown: (e) => {
          if (e.key === "Escape") { e.stopPropagation(); collapse(); }
        } });
      right.append(input);
      if (searchNew) setTimeout(() => focusEnd(input), 0);
    }
    right.append(h("button", {
      class: "icon-btn tag-search-btn" + (state.searchOpen ? " on" : ""),
      onclick: () => {
        if (state.searchOpen) {
          collapse();
        } else {
          state.searchOpen = true;
          searchNew = true;
          renderTopbar();
        }
      } }, icon("tag", 16)));
    if (window.OrbitPlugin) {
      const pluginEls = window.OrbitPlugin.render("render:topbar", state);
      pluginEls.forEach((el) => {
        if (el && el.nodeType) right.append(el);
      });
    }
    ctx.append(right);
  }
  searchNew = false;
}

let lastTitle = "";

function updateWindowTitle() {
  const t = state.board
    ? "Orbit - " + stripMarkup(state.board.board.name)
    : "Orbit";
  if (t === lastTitle) return;
  lastTitle = t;
  document.title = t;
  pyapi("set_title", t).catch(() => {});
}

function applyCardHighlights() {
  const q = state.cardSearch.trim().toLowerCase().replace(/^#/, "");
  document.querySelectorAll("#lists .card").forEach((el) => {
    const card = findCard(Number(el.dataset.cardId));
    const tags = (card && card.tags) || [];
    const match = !!q && tags.some((t) => t.toLowerCase().includes(q));
    el.classList.toggle("hl", match);
    el.classList.toggle("dim", !!q && !match);
  });
}


function boardTile(b) {
  if (state.editBoardId === b.id) {
    const nameInput = h("input", { value: b.name,
      onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); save(); } } });
    const descInput = h("textarea", { rows: 2, value: b.description || "",
      placeholder: "Description",
      onkeydown: (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
      } });
    function save() {
      state.editBoardId = null;
      saveBoardFields(b.id, { name: nameInput.value, description: descInput.value });
    }
    const tile = h("div", { class: "board-tile editing" },
      nameInput, descInput,
      h("div", { class: "tile-actions" },
        h("button", { class: "btn btn-primary", onclick: save }, "Save"),
        h("button", { class: "btn btn-ghost",
          onclick: () => { state.editBoardId = null; render(); } }, "Cancel")));
    setTimeout(() => focusEnd(nameInput), 0);
    return tile;
  }

  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  const nameEl = h("div", { class: "tile-name" });
  nameEl.innerHTML = renderInline(b.name);
  let descEl = null;
  if (b.description) {
    descEl = h("div", { class: "tile-desc" });
    descEl.innerHTML = renderMarkup(b.description);
  }
  return h("div", { class: "board-tile" + (b.pinned ? " pinned" : ""),
    onclick: () => switchBoard(b.id) },
    nameEl,
    descEl,
    h("div", { class: "tile-foot" },
      h("div", { class: "tile-btns" },
        h("button", { class: "icon-btn" + (b.pinned ? " on" : ""),
          onclick: stop(() => saveBoardFields(b.id, { pinned: b.pinned ? 0 : 1 })) },
          icon("pin", 18, !!b.pinned)),
        h("button", { class: "icon-btn",
          onclick: stop(() => { state.editBoardId = b.id; render(); }) },
          icon("pencil", 18)),
        h("button", { class: "icon-btn danger",
          onclick: stop(() => deleteBoard(b)) },
          icon("trash", 18))),
      h("span", { class: "tile-date" }, fmtDate(b.created_at))));
}

function renderHome(root) {
  const groups = h("div", { class: "board-groups" });

  function fillGrid() {
    groups.innerHTML = "";
    const q = state.search.trim().toLowerCase();
    const boards = state.boards.filter((b) =>
      !q || b.name.toLowerCase().includes(q) ||
      (b.description || "").toLowerCase().includes(q));
    const pinned = boards.filter((b) => b.pinned);
    const rest = boards.filter((b) => !b.pinned);
    if (pinned.length) {
      groups.append(h("div", { class: "board-grid" }, pinned.map(boardTile)));
    }
    if (pinned.length && rest.length) {
      groups.append(h("div", { class: "board-sep" }));
    }
    if (rest.length) {
      groups.append(h("div", { class: "board-grid" }, rest.map(boardTile)));
    }
  }
  fillGrid();

  root.append(h("div", { class: "home" + (viewEntering ? " enter" : "") },
    h("div", { class: "home-controls" },
      h("div", { class: "search-box" },
        icon("search", 16),
        h("input", { class: "search-input", value: state.search,
          oninput: (e) => { state.search = e.target.value; fillGrid(); } })),
      h("button", { class: "btn btn-primary add-board-btn",
        onclick: openBoardDialog }, icon("plus", 18))),
    groups));
  const homeSlot = document.getElementById("plugin-home-slot");
  if (homeSlot) {
    homeSlot.innerHTML = "";
    if (window.OrbitPlugin) {
      const pluginsEls = window.OrbitPlugin.render("render:home", state);
      pluginsEls.forEach((el) => {
        if (el && el.nodeType) homeSlot.appendChild(el);
      });
    }
  }
}

function openBoardDialog() {
  const root = qs("#confirm-root");
  const openedAt = Date.now();
  const close = () => {
    closeOverlay(overlay);
    document.removeEventListener("keydown", onKey, true);
  };
  const onKey = (e) => {
    if (e.key === "Escape") { e.stopPropagation(); close(); }
  };
  document.addEventListener("keydown", onKey, true);

  const nameInput = h("input", { placeholder: "Name",
    onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } } });
  const descInput = h("textarea", { rows: 3, placeholder: "Description",
    onkeydown: (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
    } });

  function submit() {
    const v = nameInput.value.trim();
    if (!v) { nameInput.focus(); return; }
    const d = descInput.value;
    close();
    createBoard(v, d);
  }

  const overlay = h("div", { class: "overlay" },
    h("div", { class: "confirm-box dialog-box" },
      nameInput, descInput,
      h("div", { class: "confirm-actions" },
        h("button", { class: "btn", onclick: close }, "Cancel"),
        h("button", { class: "btn btn-primary", onclick: submit }, "Create"))));
  bindOverlayClose(overlay, close, () => Date.now() - openedAt > 400);
  root.append(overlay);
  nameInput.focus();
}


let activePlugins = [];

async function loadPluginInfo() {
  try { activePlugins = (await pyapi("get_plugin_info")) || []; }
  catch { activePlugins = []; }
}

let pluginCornerNew = true;

function pluginCorner() {
  const el = h("div", { class: "plugin-corner" + (pluginCornerNew ? " enter" : "") },
    h("button", { class: "icon-btn",
      onclick: async () => {
        await loadPluginInfo();
        openPluginsDialog();
      } }, icon("plug", 18)));
  pluginCornerNew = false;
  return el;
}

async function deletePluginFlow(p) {
  const ok = await confirmDialog(deleteMsg(p.name || p.id));
  if (ok) {
    try {
      const res = await pyapi("delete_plugin", p.id);
      if (res && res.warning) console.warn("[plugins] " + res.warning);
    } catch {  }
    if (window.OrbitPlugin) window.OrbitPlugin.unregister(p.id);
    await loadPluginInfo();
    render();
  }
  openPluginsDialog();
}

async function togglePlugin(p) {
  if (p.enabled) {
    if (window.OrbitPlugin) window.OrbitPlugin.unregister(p.id);
    try { await pyapi("set_plugin_enabled", p.id, false); }
    catch (e) { alert((e && e.message) || "Could not disable plugin"); }
  } else {
    try { await pyapi("set_plugin_enabled", p.id, true); }
    catch (e) { alert((e && e.message) || "Could not enable plugin"); return; }
    if (window.OrbitPlugin && window.OrbitPlugin.loadFrontend) {
      await window.OrbitPlugin.loadFrontend(p.id);
      setTimeout(render, 300);
    }
  }
  await loadPluginInfo();
  render();
}

function openPluginsDialog() {
  const root = qs("#confirm-root");
  const openedAt = Date.now();
  const close = () => {
    closeOverlay(overlay);
    document.removeEventListener("keydown", onKey, true);
  };
  const onKey = (e) => {
    if (e.key === "Escape") { e.stopPropagation(); close(); }
  };
  document.addEventListener("keydown", onKey, true);

  let busy = false;
  const listWrap = h("div");

  function fillRows() {
    listWrap.innerHTML = "";
    const rows = activePlugins.map((p) =>
      h("div", { class: "plugin-row" + (p.enabled ? "" : " off") },
        h("div", { class: "plugin-row-top" },
          h("div", { class: "plugin-row-name" },
            h("span", { class: "plugin-row-dot" + (p.enabled ? "" : " off") }),
            p.name || p.id,
            h("span", { class: "plugin-row-version" }, "v" + (p.version || "?"))),
          h("div", { class: "plugin-row-actions" },
            h("button", {
              class: "plugin-switch" + (p.enabled ? " on" : ""),
              onclick: async () => {
                if (busy) return;
                busy = true;
                await togglePlugin(p);
                busy = false;
                fillRows();
              } },
              h("span", { class: "plugin-switch-knob" })),
            h("button", { class: "icon-btn danger",
              onclick: () => {
                if (busy) return;
                close();
                deletePluginFlow(p);
              } },
              icon("trash", 15)))),
        p.description ? h("div", { class: "plugin-row-desc" }, p.description) : null,
        p.author ? h("div", { class: "plugin-row-author" }, "by " + p.author) : null));
    listWrap.append(rows.length
      ? h("div", { class: "plugin-rows" }, rows)
      : h("p", { class: "plugins-empty" }, "No plugins installed."));
  }
  fillRows();

  let refreshing = false;
  const refreshBtn = h("button", { class: "icon-btn plugin-refresh",
    onclick: async () => {
      if (refreshing) return;
      refreshing = true;
      const svg = refreshBtn.querySelector("svg");
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const spin = (svg && svg.animate && !reduce)
        ? svg.animate(
            [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
            { duration: 700, iterations: Infinity, easing: "linear" })
        : null;
      await loadPluginInfo();
      fillRows();
      render();
      if (spin) {
        const t = Number(spin.currentTime) || 0;
        const angle = (t % 700) / 700 * 360;
        const end = 360 * Math.ceil((angle + 180) / 360);
        spin.cancel();
        const finish = svg.animate(
          [{ transform: `rotate(${angle}deg)` }, { transform: `rotate(${end}deg)` }],
          { duration: (end - angle) / 360 * 700 * 1.5,
            easing: "cubic-bezier(0.2, 0.3, 0.3, 1)" });
        try { await finish.finished; } catch (e) {}
      }
      refreshing = false;
    } }, icon("refresh", 16));

  const overlay = h("div", { class: "overlay" },
    h("div", { class: "confirm-box dialog-box plugins-box" },
      h("div", { class: "plugins-head" },
        h("h3", {}, "Plugins"),
        h("div", { class: "plugins-head-actions" },
          h("button", { class: "icon-btn",
            onclick: () => pyapi("open_plugins_folder").catch(() => {}) },
            icon("folder", 16)),
          refreshBtn,
          h("button", { class: "icon-btn", onclick: close }, icon("x", 16)))),
      listWrap));
  bindOverlayClose(overlay, close, () => Date.now() - openedAt > 400);
  root.append(overlay);
}


function render() {
  renderTopbar();
  updateWindowTitle();
  const root = qs("#board-root");
  const view = (state.boardId == null || !state.board) ? "home" : "board:" + state.boardId;
  viewEntering = view !== lastView;
  lastView = view;
  const prevLists = root.querySelector("#lists");
  const scrollLeft = prevLists ? prevLists.scrollLeft : 0;
  const cardScrolls = {};
  root.querySelectorAll(".cards").forEach((el) => {
    cardScrolls[el.dataset.listId] = el.scrollTop;
  });

  root.innerHTML = "";
  if (view === "home") {
    renderHome(root);
    root.append(pluginCorner());
    composerNew = false;
    enterCardId = null;
    enterListId = null;
    if (window.OrbitPlugin) window.OrbitPlugin.emit("view:changed", view);
    return;
  }
  const staleHomeSlot = document.getElementById("plugin-home-slot");
  if (staleHomeSlot) staleHomeSlot.innerHTML = "";

  const listsEl = h("div", { id: "lists", class: viewEntering ? "enter" : null,
    ondragover: listsDragOver, ondrop: listsDrop });
  for (const list of state.board.lists) listsEl.append(renderList(list));
  listsEl.append(renderAddList());
  root.append(listsEl);

  root.append(h("div", { class: "hist-btns" },
    h("button", { class: "icon-btn", disabled: !histUndo.length,
      onclick: undoBoard }, icon("arrowleft", 18)),
    h("button", { class: "icon-btn", disabled: !histRedo.length,
      onclick: redoBoard }, icon("arrowright", 18))));
  root.append(pluginCorner());

  listsEl.scrollLeft = scrollLeft;
  listsEl.querySelectorAll(".cards").forEach((el) => {
    if (cardScrolls[el.dataset.listId] != null) el.scrollTop = cardScrolls[el.dataset.listId];
  });
  hydrate(listsEl);
  focusComposer(root);
  applyCardHighlights();
  composerNew = false;
  enterCardId = null;
  enterListId = null;

  if (window.OrbitPlugin) {
    window.OrbitPlugin.emit("view:changed", view);
    if (state.board && state.boardId != null) {
      window.OrbitPlugin.emit("board:opened", state.boardId, state.board.board);
    }
  }
}

function focusComposer(root) {
  if (!state.composer) return;
  const el = root.querySelector(".composer textarea, .composer input");
  if (el) {
    el.focus();
    el.scrollIntoView({ block: "nearest" });
  }
}


function renderList(list) {
  const header = h("div", {
    class: "list-header",
    draggable: state.editingList !== list.id && state.board.lists.length > 1,
    ondragstart: (e) => listDragStart(e, list.id),
    ondragend: cleanupDrag,
  });

  if (state.editingList === list.id) {
    const input = h("input", {
      value: list.name,
      onkeydown: (e) => {
        if (e.key === "Enter") e.target.blur();
        if (e.key === "Escape") { state.editingList = null; render(); }
      },
      onblur: (e) => {
        const v = e.target.value.trim();
        state.editingList = null;
        if (v && v !== list.name) {
          list.name = v;
          pyapi("rename_list", list.id, v).catch(refreshBoard);
          commitLocal();
        }
        render();
      },
    });
    header.append(input);
    setTimeout(() => focusEnd(input), 0);
  } else {
    const nameEl = h("h2", {
      onclick: () => { state.editingList = list.id; render(); },
    });
    nameEl.innerHTML = renderInline(list.name);
    header.append(
      nameEl,
      h("span", { class: "list-count" }, String(list.cards.length)),
      h("button", { class: "icon-btn danger",
        onclick: async () => {
          const ok = await confirmDialog(deleteMsg(list.name));
          if (ok) {
            pyapi("delete_list", list.id).then(() => {
              commitHistory();
              return refreshBoard();
            }).catch(() => {});
          }
        } }, icon("trash", 18)));
  }

  const cardsEl = h("div", { class: "cards", dataset: { listId: list.id } });
  for (const card of list.cards) cardsEl.append(renderCard(card, list));

  return h("section", {
    class: "list" + (list.id === enterListId ? " enter" : ""),
    dataset: { listId: list.id },
    ondragover: (e) => cardsDragOver(e, cardsEl),
    ondrop: (e) => cardsDrop(e, cardsEl, list.id) },
    header, cardsEl, renderCardComposer(list.id));
}

function renderAddList() {
  const wrap = h("div", { class: "add-list" });
  if (state.composer && state.composer.type === "list") {
    const input = h("input", {
      placeholder: "List name…",
      onkeydown: (e) => {
        if (e.key === "Enter") { e.preventDefault(); submit(); }
        if (e.key === "Escape") { state.composer = null; render(); }
      },
    });
    async function submit() {
      const v = input.value.trim();
      if (!v) return;
      input.value = "";
      let res;
      try { res = await pyapi("create_list", state.boardId, v); } catch { return; }
      enterListId = res.id;
      state.composer = null;
      commitHistory();
      refreshBoard();
    }
    wrap.append(h("div", { class: "composer" + (composerNew ? " enter" : "") }, input,
      h("div", { class: "composer-actions" },
        h("button", { class: "btn btn-primary", onclick: submit }, "Add list"),
        h("button", { class: "icon-btn",
          onclick: () => { state.composer = null; render(); } }, icon("x", 16)))));
  } else {
    wrap.append(h("button", { class: "composer-btn",
      onclick: () => {
        state.composer = { type: "list" };
        composerNew = true;
        render();
      } }, "+ Add list"));
  }
  return wrap;
}

function renderCardComposer(listId) {
  if (state.composer && state.composer.type === "card" && state.composer.listId === listId) {
    const ta = h("textarea", {
      placeholder: "Card title… (Enter to add)",
      onkeydown: (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
        if (e.key === "Escape") { state.composer = null; render(); }
      },
    });
    async function submit() {
      const v = ta.value.trim();
      if (!v) return;
      ta.value = "";
      let res;
      try { res = await pyapi("create_card", listId, v); } catch { return; }
      enterCardId = res.id;
      state.composer = null;
      commitHistory();
      refreshBoard();
    }
    return h("div", { class: "composer" + (composerNew ? " enter" : "") }, ta,
      h("div", { class: "composer-actions" },
        h("button", { class: "btn btn-primary", onclick: submit }, "Add card"),
        h("button", { class: "icon-btn",
          onclick: () => { state.composer = null; render(); } }, icon("x", 16))));
  }
  return h("button", { class: "composer-btn",
    onclick: () => {
      state.composer = { type: "card", listId };
      composerNew = true;
      render();
    } }, "+ Add a card");
}


function renderCard(card, list) {
  const cover = card.cover_id
    ? card.attachments.find((a) => a.id === card.cover_id && a.kind === "image")
    : null;
  const canDrag = state.board.lists.length > 1 || list.cards.length > 1;

  const badges = [];
  if (card.attachments.length) {
    badges.push(h("span", { class: "badge" },
      icon("clip", 13), String(card.attachments.length)));
  }

  let descEl = null;
  if (card.description) {
    descEl = h("div", { class: "card-desc" });
    descEl.innerHTML = renderMarkup(card.description);
  }

  const el = h("article", {
    class: "card" + (card.id === enterCardId ? " enter" : ""),
    draggable: canDrag,
    dataset: { cardId: card.id },
    onclick: () => openCard(card.id),
    ondragstart: (e) => cardDragStart(e, card.id),
    ondragend: cleanupDrag,
    ...fileDropProps(() => card.id),
  },
    cover ? h("img", { class: "card-cover", alt: "", dataset: { attId: cover.id } }) : null,
    h("div", { class: "card-body" },
      titleView(card.title, "card-title"),
      descEl,
      card.tags && card.tags.length
        ? h("div", { class: "card-tags" },
            card.tags.map((t) => h("span", { class: "tag-chip" }, t)))
        : null,
      badges.length ? h("div", { class: "card-badges" }, badges) : null));
  if (card.color) el.style.borderColor = card.color;
  return el;
}

function titleView(text, cls) {
  const el = h("div", { class: cls });
  el.innerHTML = renderInline(text);
  return el;
}


const cardPh = h("div", { class: "card-placeholder" });
const listPh = h("div", { class: "list-placeholder" });

function cardDragStart(e, id) {
  drag = { type: "card", id };
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", "card:" + id);
  const el = e.currentTarget;
  requestAnimationFrame(() => el.classList.add("dragging"));
  e.stopPropagation();
}

function listDragStart(e, id) {
  drag = { type: "list", id };
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", "list:" + id);
  const el = e.currentTarget.closest(".list");
  requestAnimationFrame(() => el.classList.add("drag-src"));
}

function cleanupDrag() {
  drag = null;
  cardPh.remove();
  listPh.remove();
  document.querySelectorAll(".dragging, .drag-src").forEach((el) => {
    el.classList.remove("dragging", "drag-src");
  });
}

function placePh(ph, container, before) {
  if (ph.parentNode === container && ph.nextSibling === (before || null)) return;
  container.insertBefore(ph, before || null);
}

function cardsDragOver(e, container) {
  if (!drag || drag.type !== "card") return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  const after = [...container.querySelectorAll(":scope > .card:not(.dragging)")]
    .find((el) => e.clientY < el.getBoundingClientRect().top + el.offsetHeight / 2);
  placePh(cardPh, container, after || null);
}

function cardsDrop(e, container, listId) {
  if (!drag || drag.type !== "card") return;
  e.preventDefault();
  e.stopPropagation();
  let index = 0;
  for (const el of container.children) {
    if (el === cardPh) break;
    if (el.classList.contains("card") && !el.classList.contains("dragging")) index++;
  }
  const id = drag.id;
  cleanupDrag();
  enterCardId = id;
  pyapi("move_card", id, listId, index).then(() => {
    commitHistory();
    return refreshBoard();
  }).catch(() => {});
}

function listsDragOver(e) {
  if (!drag || drag.type !== "list") return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  const container = e.currentTarget;
  const after = [...container.querySelectorAll(":scope > .list:not(.drag-src)")]
    .find((el) => e.clientX < el.getBoundingClientRect().left + el.offsetWidth / 2);
  placePh(listPh, container, after || container.querySelector(":scope > .add-list"));
}

function listsDrop(e) {
  if (!drag || drag.type !== "list") return;
  e.preventDefault();
  const container = e.currentTarget;
  let index = 0;
  for (const el of container.children) {
    if (el === listPh) break;
    if (el.classList.contains("list") && !el.classList.contains("drag-src")) index++;
  }
  const id = drag.id;
  cleanupDrag();
  enterListId = id;
  pyapi("move_list", id, index).then(() => {
    commitHistory();
    return refreshBoard();
  }).catch(() => {});
}


function isFileDrag(e) {
  return !!e.dataTransfer && [...(e.dataTransfer.types || [])].includes("Files");
}

function fileDropProps(getCardId) {
  return {
    ondragenter: (e) => {
      if (!isFileDrag(e)) return;
      const el = e.currentTarget;
      el._fh = (el._fh || 0) + 1;
      el.classList.add("file-target");
    },
    ondragover: (e) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "copy";
    },
    ondragleave: (e) => {
      if (!isFileDrag(e)) return;
      const el = e.currentTarget;
      el._fh = Math.max(0, (el._fh || 0) - 1);
      if (!el._fh) el.classList.remove("file-target");
    },
    ondrop: (e) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.currentTarget;
      el._fh = 0;
      el.classList.remove("file-target");
      uploadFiles(getCardId(), e.dataTransfer.files);
    },
  };
}

function readFileAsDataURL(f) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Could not read " + f.name));
    r.readAsDataURL(f);
  });
}

async function uploadFiles(cardId, fileList) {
  const files = [...fileList];
  if (!files.length || cardId == null) return;
  for (const f of files) {
    try {
      if (f.pywebviewFullPath) {
        await pyapi("add_attachment_from_path", cardId, f.pywebviewFullPath);
      } else if (f.size > MAX_DROP_BYTES) {
        console.warn(`${f.name} is too large for drag & drop`);
        continue;
      } else {
        const dataUrl = await readFileAsDataURL(f);
        await pyapi("add_attachment_from_data", cardId, f.name, dataUrl);
      }
    } catch {  }
  }
  commitHistory();
  refreshBoard();
}

document.addEventListener("dragover", (e) => { if (isFileDrag(e)) e.preventDefault(); });
document.addEventListener("drop", (e) => { if (isFileDrag(e)) e.preventDefault(); });


function openCard(id) {
  state.openCardId = id;
  state.editingDesc = false;
  state.editingTitle = false;
  modalOpenedAt = Date.now();
  renderModal();
  if (window.OrbitPlugin) {
    const card = findCard(id);
    if (card) {
      window.OrbitPlugin.emit("card:opened", card.id, card);
    }
  }
}

function closeModal() {
  state.openCardId = null;
  renderModal();
}

async function deleteOpenCard() {
  const card = findCard(state.openCardId);
  if (!card) return;
  const ok = await confirmDialog(deleteMsg(card.title));
  if (!ok) return;
  state.openCardId = null;
  renderModal();
  pyapi("delete_card", card.id).then(() => {
    commitHistory();
    return refreshBoard();
  }).catch(() => {});
}

function renderModal() {
  const root = qs("#modal-root");
  const prevModal = root.querySelector(".modal");
  const prevScroll = prevModal ? prevModal.scrollTop : 0;
  const card = (state.openCardId != null && state.board)
    ? findCard(state.openCardId) : null;
  if (!card) {
    state.openCardId = null;
    closeOverlay(root);
    const staleModalSlot = document.getElementById("plugin-modal-slot");
    if (staleModalSlot) staleModalSlot.innerHTML = "";
    return;
  }
  root.innerHTML = "";
  const list = state.board.lists.find((l) => l.id === card.list_id);
  const entering = Date.now() - modalOpenedAt < 200;
  const reCls = entering ? "" : " re";

  let titleEl;
  if (state.editingTitle) {
    titleEl = h("input", {
      class: "modal-title",
      value: card.title,
      onkeydown: (e) => {
        if (e.key === "Enter") e.target.blur();
        if (e.key === "Escape") {
          e.stopPropagation();
          state.editingTitle = false;
          renderModal();
        }
      },
      onblur: (e) => {
        const v = e.target.value.trim();
        state.editingTitle = false;
        if (v && v !== card.title) {
          card.title = v;
          pyapi("update_card", card.id, { title: v }).catch(refreshBoard);
          commitLocal();
        }
        render();
        renderModal();
      },
    });
    setTimeout(() => focusEnd(titleEl), 0);
  } else {
    titleEl = titleView(card.title, "modal-title-view");
    titleEl.addEventListener("click", () => {
      state.editingTitle = true;
      renderModal();
    });
  }

  const modal = h("div", { class: "modal" + reCls, ...fileDropProps(() => card.id) },
    h("div", { class: "modal-head" },
      titleEl,
      h("button", { class: "icon-btn", onclick: closeModal }, icon("x", 18))),
    (() => {
      const sub = h("div", { class: "modal-sub" }, "in ");
      const ln = h("span");
      ln.innerHTML = renderInline(list ? list.name : "?");
      sub.append(ln, ` · created ${String(card.created_at || "").split(" ")[0]}`);
      return h("div", { class: "modal-subrow" }, sub, colorSection(card));
    })(),
    tagSection(card),
    descSection(card),
    attachmentSection(card),
    h("div", { class: "modal-foot" },
      h("button", { class: "btn btn-ghost delete-card", onclick: deleteOpenCard },
        "Delete card")));

  if (window.OrbitPlugin) {
    const modalSlot = document.getElementById("plugin-modal-slot");
    if (modalSlot) {
      modalSlot.innerHTML = "";
      const pluginEls = window.OrbitPlugin.render("render:card-modal", card, state);
      pluginEls.forEach((el) => {
        if (el && el.nodeType) modalSlot.appendChild(el);
      });
    }
  }

  const overlay = h("div", { class: "overlay" + reCls }, modal);
  bindOverlayClose(overlay, closeModal, () => Date.now() - modalOpenedAt > 400);
  root.append(overlay);
  modal.scrollTop = prevScroll;
  hydrate(modal);
}

function colorSection(card) {
  function setColor(c) {
    card.color = c;
    pyapi("update_card", card.id, { color: c }).catch(refreshBoard);
    commitLocal();
    render();
    renderModal();
  }
  return h("div", { class: "color-row" },
    h("button", { class: "color-swatch none" + (card.color ? "" : " sel"),
      onclick: () => setColor("") }),
    Object.entries(COLORS).map(([name, c]) => h("button", {
      class: "color-swatch" + (card.color === c ? " sel" : ""),
      style: { background: c },
      title: name,
      onclick: () => setColor(c),
    })));
}

let refocusTagInput = false;

function boardTags() {
  const seen = new Map();
  for (const l of (state.board ? state.board.lists : [])) {
    for (const c of l.cards) {
      for (const t of (c.tags || [])) {
        if (!seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
      }
    }
  }
  return [...seen.values()];
}

function tagSection(card) {
  const tags = card.tags || [];
  function saveTags(next) {
    card.tags = next;
    pyapi("update_card", card.id, { tags: next }).catch(refreshBoard);
    commitLocal();
    render();
    renderModal();
  }
  function addTag(v, refocus = true) {
    v = (v || "").trim().replace(/^#/, "");
    if (!v) return;
    if (refocus) refocusTagInput = true;
    if (tags.some((t) => t.toLowerCase() === v.toLowerCase())) {
      input.value = "";
      return;
    }
    saveTags([...tags, v]);
  }

  const suggest = h("div", { class: "tag-suggest", hidden: true });
  function updateSuggest() {
    const q = input.value.trim().toLowerCase().replace(/^#/, "");
    const opts = boardTags().filter((t) =>
      !tags.some((x) => x.toLowerCase() === t.toLowerCase()) &&
      (!q || t.toLowerCase().includes(q))).slice(0, 50);
    suggest.innerHTML = "";
    if (!opts.length) { suggest.hidden = true; return; }
    for (const t of opts) {
      suggest.append(h("button", { class: "tag-option",
        onmousedown: (e) => { e.preventDefault(); addTag(t); } }, t));
    }
    suggest.hidden = false;
  }

  const input = h("input", { class: "tag-input", placeholder: "Add tag…",
    oninput: updateSuggest,
    onfocus: updateSuggest,
    onblur: (e) => {
      addTag(e.target.value, false);
      setTimeout(() => { suggest.hidden = true; }, 150);
    },
    onkeydown: (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        suggest.hidden = true;
        e.target.value = "";
        e.target.blur();
        return;
      }
      if (e.key !== "Enter") return;
      e.preventDefault();
      addTag(e.target.value);
    } });

  if (refocusTagInput) {
    refocusTagInput = false;
    setTimeout(() => input.focus(), 0);
  }
  return h("div", { class: "tag-row" },
    tags.map((t) => h("span", { class: "tag-chip" }, t,
      h("button", { class: "tag-x",
        onclick: () => saveTags(tags.filter((x) => x !== t)) }, icon("x", 11)))),
    h("div", { class: "tag-input-wrap" }, input, suggest));
}

let descEditFrom = 0;

function descSection(card) {
  const section = h("div", { class: "modal-section" }, h("h3", {}, "Description"));
  if (state.editingDesc) {
    const autosize = (el) => {
      el.style.height = "auto";
      el.style.height = Math.max(el.scrollHeight, descEditFrom) + "px";
    };
    const ta = h("textarea", { class: "desc-box", rows: 1,
      value: card.description || "",
      placeholder: "Add a description…",
      oninput: (e) => autosize(e.target),
      onkeydown: (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          e.target.blur();
        }
        if (e.key === "Escape") {
          e.stopPropagation();
          state.editingDesc = false;
          renderModal();
        }
      },
      onblur: (e) => {
        const v = e.target.value;
        state.editingDesc = false;
        if (v !== card.description) {
          card.description = v;
          pyapi("update_card", card.id, { description: v }).catch(refreshBoard);
          commitLocal();
        }
        render();
        renderModal();
      } });
    if (descEditFrom) ta.style.height = descEditFrom + "px";
    section.append(ta);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
      autosize(ta);
    }, 0);
  } else {
    const prev = h("div", {
      class: "desc-preview" + (card.description ? "" : " empty"),
      onclick: (e) => {
        descEditFrom = e.currentTarget.offsetHeight;
        state.editingDesc = true;
        renderModal();
      },
    });
    if (card.description) prev.innerHTML = renderMarkup(card.description);
    else prev.textContent = "Add a description…";
    section.append(prev);
  }
  return section;
}

function attachmentSection(card) {
  const section = h("div", { class: "modal-section" },
    h("h3", {}, "Attachments",
      h("button", { class: "btn add-file-btn", onclick: () => {
        pyapi("add_attachments_dialog", card.id).then((r) => {
          if (r.attachments.length) commitHistory();
          return refreshBoard();
        }).catch(() => {});
      } }, "+ Add file")));
  section.append(h("div", { class: "att-wrap" },
    card.attachments.length
      ? h("div", { class: "att-grid" },
          card.attachments.map((a) => attItem(card, a)))
      : h("div", { class: "att-empty" },
          "Drop files anywhere on this card to attach them")));
  return section;
}

const KIND_ICON = { image: "image", video: "film", audio: "music",
  document: "filetext", other: "file" };

let renameAttId = null;

function attItem(card, a) {
  const isCover = card.cover_id === a.id;
  const preview = h("div", { class: "att-preview",
    onclick: () => previewAttachment(a) });
  if (a.kind === "image") {
    preview.append(h("img", { alt: a.name, dataset: { attId: a.id } }));
    if (isCover) preview.append(h("div", { class: "cover-badge" }, "Cover"));
    preview.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      card.cover_id = isCover ? null : a.id;
      pyapi("update_card", card.id, { cover_id: card.cover_id }).catch(refreshBoard);
      commitLocal();
      render();
      renderModal();
    });
  } else {
    preview.append(h("div", { class: "att-icon" },
      icon(KIND_ICON[a.kind] || "file", 30)));
    if (a.kind === "video" || a.kind === "audio") {
      preview.append(h("div", { class: "play-badge" }, icon("play", 22, true)));
    }
  }

  let nameEl;
  if (renameAttId === a.id) {
    nameEl = h("input", { class: "att-name-input", value: a.name,
      onkeydown: (e) => {
        if (e.key === "Enter") e.target.blur();
        if (e.key === "Escape") {
          e.stopPropagation();
          renameAttId = null;
          renderModal();
        }
      },
      onblur: (e) => {
        const v = e.target.value.trim();
        renameAttId = null;
        if (v && v !== a.name) {
          pyapi("rename_attachment", a.id, v).then(() => {
            commitHistory();
            return refreshBoard();
          }).catch(() => {});
        } else {
          renderModal();
        }
      } });
    setTimeout(() => focusEnd(nameEl), 0);
  } else {
    nameEl = h("div", { class: "att-name",
      onclick: () => { renameAttId = a.id; renderModal(); } }, a.name);
  }

  return h("div", { class: "att-item" + (isCover ? " cover" : "") },
    preview,
    h("div", { class: "att-meta" }, nameEl,
      h("div", { class: "att-size" }, fmtSize(a.size))),
    h("div", { class: "att-actions" },
      h("button", {
        onclick: () => pyapi("save_attachment_as", a.id).catch(() => {}) },
        icon("download", 14)),
      h("button", { class: "danger",
        onclick: async () => {
          if (await confirmDialog(deleteMsg(a.name))) {
            pyapi("delete_attachment", a.id).then(() => {
              commitHistory();
              return refreshBoard();
            }).catch(() => {});
          }
        } }, icon("trash", 14))));
}

function previewAttachment(a) {
  if (a.kind === "image" || a.kind === "video" || a.kind === "audio") {
    openLightbox(a);
  } else {
    pyapi("open_attachment", a.id).catch(() => {});
  }
}


function lightboxOpen() {
  const ov = qs("#lightbox-root").firstElementChild;
  return !!ov && !ov.classList.contains("closing");
}

function closeLightbox() {
  closeOverlay(qs("#lightbox-root"));
}

function openLightbox(a) {
  const root = qs("#lightbox-root");
  root.innerHTML = "";
  const box = h("div", { class: "lightbox" }, h("div", { class: "loading" }, "Loading…"));
  const overlay = h("div", { class: "overlay" }, box);
  bindOverlayClose(overlay, closeLightbox);
  root.append(overlay);

  getAttData(a.id).then((d) => {
    box.innerHTML = "";
    let media;
    if (a.kind === "image") {
      media = h("img", { src: d.data_uri, alt: a.name });
    } else if (a.kind === "video") {
      media = h("video", { src: d.data_uri, controls: true, autoplay: true });
    } else {
      media = h("audio", { src: d.data_uri, controls: true, autoplay: true });
    }
    box.append(media,
      h("div", { class: "lb-name" }, `${a.name} · ${fmtSize(a.size)}`),
      h("div", { class: "lb-actions" },
        h("button", { class: "btn",
          onclick: () => pyapi("open_attachment", a.id).catch(() => {}) }, "Open externally"),
        h("button", { class: "btn",
          onclick: () => pyapi("save_attachment_as", a.id).catch(() => {}) }, "Save as…"),
        h("button", { class: "btn", onclick: closeLightbox }, "Close")));
  }).catch(async (err) => {
    closeLightbox();
    if (err && err.tooLarge) {
      const ok = await confirmDialog(
        `“${a.name}” (${fmtSize(err.size)}) is too large to preview inline. ` +
        "Open it with the system player instead?", "Open");
      if (ok) pyapi("open_attachment", a.id).catch(() => {});
    }
  });
}


function confirmDialog(message, okLabel = "Delete") {
  return new Promise((resolve) => {
    const root = qs("#confirm-root");
    const openedAt = Date.now();
    const settled = () => Date.now() - openedAt > 250;
    const done = (val) => {
      closeOverlay(overlay);
      document.removeEventListener("keydown", onKey, true);
      resolve(val);
    };
    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); done(false); }
      else if (e.key === "Enter") { e.stopPropagation(); e.preventDefault(); done(true); }
    };
    document.addEventListener("keydown", onKey, true);
    const okBtn = h("button", {
      class: okLabel === "Delete" ? "btn btn-danger" : "btn btn-primary",
      onclick: () => { if (settled()) done(true); },
    }, okLabel);
    const overlay = h("div", { class: "overlay" },
      h("div", { class: "confirm-box" },
        h("p", {}, message),
        h("div", { class: "confirm-actions" },
          h("button", { class: "btn", onclick: () => { if (settled()) done(false); } }, "Cancel"),
          okBtn)));
    bindOverlayClose(overlay, () => done(false), () => Date.now() - openedAt > 400);
    root.append(overlay);
    okBtn.focus();
  });
}


document.addEventListener("keydown", (e) => {
  const confirmOv = qs("#confirm-root").firstElementChild;
  if (confirmOv && !confirmOv.classList.contains("closing")) return;
  if (e.key === "Escape") {
    if (lightboxOpen()) closeLightbox();
    else if (state.openCardId != null) closeModal();
    else if (state.composer) { state.composer = null; render(); }
    else if (state.editBoardId != null) { state.editBoardId = null; render(); }
  } else if (e.key === "Delete" && state.openCardId != null &&
             !isTyping() && !lightboxOpen()) {
    deleteOpenCard();
  }
});


const FOOTER_PHRASES = [
  "Stay in flow. Stay in Orbit.",
  "Calm by design, designed for calm.",
  "Nothing extra, everything essential.",
  "No cloud, no accounts, no noise.",
  "Your boards never leave your machine.",
  "Gravity for scattered thoughts.",
  "Every idea in its own orbit.",
  "Plain files, honest software.",
  "Works offline, because it never went online.",
  "Launches fast, stays out of your way.",
];
qs("#footer-phrase").textContent =
  FOOTER_PHRASES[Math.floor(Math.random() * FOOTER_PHRASES.length)];

let started = false;

async function loadFonts() {
  try {
    const fonts = await pyapi("get_fonts");
    if (!fonts || !fonts.length) return;
    const rules = fonts.map((f) =>
      `@font-face{font-family:'OrbitFont';src:url(${f.data_uri}) ` +
      `format('${f.format}');font-weight:${f.weight};font-style:${f.style};` +
      "font-display:swap;}").join("\n");
    const styleEl = document.createElement("style");
    styleEl.textContent = rules +
      "\nbody{font-family:'OrbitFont','Segoe UI',system-ui,sans-serif;}";
    document.head.append(styleEl);
  } catch {  }
}

async function start() {
  if (started || !window.pywebview || !window.pywebview.api) return;
  started = true;
  loadFonts();
  try { await refreshBoards(); } catch { started = false; return; }
  await loadPluginInfo();
  render();
}

window.addEventListener("pywebviewready", start);
document.addEventListener("DOMContentLoaded", () => start());
setTimeout(() => {
  if (!started && !window.pywebview) {
    qs("#board-root").innerHTML =
      '<div class="empty-state"><p>Backend not available — launch Orbit with <b>python main.py</b>.</p></div>';
  }
}, 1500);
