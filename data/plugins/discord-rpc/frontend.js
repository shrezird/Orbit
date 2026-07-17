
(function () {
  "use strict";

  const PID = "discord-rpc";
  let timer = null;
  let badges = [];
  let lastStatus = null;
  let lastSent = "";

  function snapshot() {
    if (typeof state === "undefined" || !state) return null;
    const strip = (typeof stripMarkup === "function") ? stripMarkup : (x) => x;
    const inBoard = state.boardId != null && !!state.board;
    const snap = {
      view: inBoard ? "board" : "home",
      board_name: null,
      card_title: null,
      editing: false,
      lists: 0,
      cards: 0,
      boards: Array.isArray(state.boards) ? state.boards.length : 0,
    };
    if (inBoard) {
      snap.board_name = String(strip(state.board.board.name)).slice(0, 100);
      snap.lists = state.board.lists.length;
      snap.cards = state.board.lists.reduce((n, l) => n + l.cards.length, 0);
      if (state.openCardId != null) {
        for (const l of state.board.lists) {
          for (const c of l.cards) {
            if (c.id === state.openCardId) {
              snap.card_title = String(strip(c.title)).slice(0, 100);
            }
          }
        }
        snap.editing = !!(state.editingTitle || state.editingDesc);
      }
    }
    return snap;
  }

  async function push() {
    let snap = null;
    try { snap = snapshot(); } catch (e) {  }
    if (!snap) return;
    const key = JSON.stringify(snap);
    if (key === lastSent) return;
    try {
      await pluginApi(PID, "set_context", snap);
      lastSent = key;
    } catch (e) {  }
  }

  async function refreshStatus() {
    try { lastStatus = await pluginApi(PID, "get_status"); }
    catch (e) { lastStatus = null; }
    badges = badges.filter((b) => document.contains(b));
    badges.forEach(paint);
  }

  const CONN_SVG =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round">' +
    '<path d="M5 12.55a11 11 0 0 1 14.08 0"/>' +
    '<path d="M1.42 9a16 16 0 0 1 21.16 0"/>' +
    '<path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>' +
    '<line x1="12" y1="20" x2="12.01" y2="20"/></svg>';

  function paint(el) {
    const s = lastStatus;
    let color = "#d64545";
    if (s && s.enabled && s.connected) {
      color = "#57a05a";
    } else if (s && s.enabled && s.has_client_id) {
      color = "#d4b13d";
    }
    el.style.color = color;
    el.innerHTML = CONN_SVG;
  }

  async function onClick() {
    try { lastStatus = await pluginApi(PID, "toggle"); } catch (e) { return; }
    badges.forEach(paint);
  }

  OrbitPlugin.register({
    id: PID,
    name: "Discord Rich Presence",

    hooks: {
      "render:topbar": () => {
        const badge = document.createElement("button");
        badge.className = "icon-btn";
        badge.addEventListener("click", onClick);
        badges.push(badge);
        paint(badge);
        return badge;
      },
      "view:changed": () => push(),
      "board:opened": () => push(),
      "card:opened": () => push(),
    },

    onLoad() {
      let tick = 0;
      timer = setInterval(() => {
        tick++;
        if (tick % 6 === 0) lastSent = "";
        push();
        refreshStatus();
      }, 5000);
      push();
      refreshStatus();
    },

    onUnload() {
      if (timer) clearInterval(timer);
      timer = null;
      badges = [];
    },
  });
})();
