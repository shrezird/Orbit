"""Orbit — a lightweight, local-first Trello-style board app.

Run:    python main.pyw           (add --debug for devtools)
Build:  pyinstaller --onefile --windowed --name Orbit --icon icon.ico
            --add-data "static;static" --add-data "font;font" main.pyw

All backend functionality is exposed to the frontend through the Api class,
attached to the pywebview window via js_api. There is no HTTP server and no
web framework; every board lives in its own folder under data/boards/ — a
human-readable board.json plus that board's attachments/ — created next to
main.pyw (or the built .exe). The font/ folder ships inside the exe.
"""

import base64
import functools
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import traceback
import uuid

import webview

import database

from plugin_system import PluginManager
from plugin_system.hooks import hooks

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
VIDEO_EXTS = {".mp4", ".webm", ".mov"}
AUDIO_EXTS = {".mp3", ".wav", ".ogg"}
DOC_EXTS = {".pdf", ".txt", ".docx", ".doc", ".rtf", ".md", ".csv", ".xlsx", ".pptx"}

MAX_INLINE_BYTES = 64 * 1024 * 1024

FALLBACK_MIME = {
    ".webp": "image/webp",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".mov": "video/quicktime",
    ".md": "text/plain",
}

FONT_EXTS = {
    ".woff2": ("font/woff2", "woff2"),
    ".woff": ("font/woff", "woff"),
    ".ttf": ("font/ttf", "truetype"),
    ".otf": ("font/otf", "opentype"),
}

FONT_WEIGHTS = [
    ("extralight", 200), ("semibold", 600), ("demibold", 600),
    ("extrabold", 800), ("thin", 100), ("light", 300), ("medium", 500),
    ("black", 900), ("heavy", 900), ("bold", 700),
]

try:
    DIALOG_OPEN = webview.FileDialog.OPEN
    DIALOG_SAVE = webview.FileDialog.SAVE
except AttributeError:
    DIALOG_OPEN = webview.OPEN_DIALOG
    DIALOG_SAVE = webview.SAVE_DIALOG


def app_dir():
    """Directory the app lives in: next to the .exe when frozen, else this file."""
    if getattr(sys, "frozen", False):
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))


def resource_path(rel):
    """Bundled read-only resources (static/, font/) — inside _MEIPASS when frozen."""
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, rel)


def classify(filename):
    ext = os.path.splitext(filename)[1].lower()
    if ext in IMAGE_EXTS:
        return "image"
    if ext in VIDEO_EXTS:
        return "video"
    if ext in AUDIO_EXTS:
        return "audio"
    if ext in DOC_EXTS:
        return "document"
    return "other"


def guess_mime(filename):
    mime = mimetypes.guess_type(filename)[0]
    if mime:
        return mime
    return FALLBACK_MIME.get(os.path.splitext(filename)[1].lower(), "application/octet-stream")


def plain_name(name):
    """Formatting-free sort key for board names."""
    s = re.sub(r"\[(?:red|orange|yellow|green|teal|blue|purple|pink)\s*:\s*",
               "", str(name), flags=re.I)
    return re.sub(r"[*_~\]]", "", s).lower()


def api_method(fn):
    """Convert exceptions into {'error': ...} so the frontend can handle them."""

    @functools.wraps(fn)
    def wrapper(self, *args, **kwargs):
        try:
            return fn(self, *args, **kwargs)
        except Exception as exc:
            traceback.print_exc()
            return {"error": f"{type(exc).__name__}: {exc}"}

    return wrapper


def plugin_api_method(fn):
    """api_method for plugin bridge callables — these are already bound to
    their plugin instance, so no 'self' parameter is involved."""

    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except Exception as exc:
            traceback.print_exc()
            return {"error": f"{type(exc).__name__}: {exc}"}

    return wrapper


class Api:
    """Everything the frontend can do, reachable as window.pywebview.api.*"""

    def __init__(self, base_dir=None):
        self.base_dir = base_dir or app_dir()
        self.data_dir = os.path.join(self.base_dir, "data")
        self.font_dir = resource_path("font")
        os.makedirs(self.data_dir, exist_ok=True)
        self.boards_dir = os.path.join(self.data_dir, "boards")
        self.store = database.Store(self.boards_dir)

        self.plugins = PluginManager(
            plugins_dir=os.path.join(self.data_dir, "plugins"),
            storage_base=os.path.join(self.data_dir, "plugins"),
        )
        self._plugins_config_path = os.path.join(
            self.data_dir, "plugins", "plugins-config.json")
        self.plugins.load_all(disabled_ids=self._load_disabled())
        bridge = self.plugins.get_api_bridge()
        for name, func in bridge.items():
            setattr(self, name, plugin_api_method(func))
        hooks.fire("on_app_start")


    def _load_disabled(self):
        """Persisted set of plugin ids the user has toggled off."""
        try:
            with open(self._plugins_config_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            return set(cfg.get("disabled", []))
        except Exception:
            return set()

    def _save_disabled(self, disabled):
        database.atomic_write(self._plugins_config_path,
                              {"disabled": sorted(disabled)})

    @api_method
    def set_plugin_enabled(self, plugin_id, enabled):
        """Toggle a plugin on/off at runtime; the choice persists."""
        disabled = self._load_disabled()
        if enabled:
            if plugin_id not in self.plugins.loaded:
                if not self.plugins.load_one(plugin_id):
                    return {"error": "Plugin could not be loaded"}
                for name, func in self.plugins.bridge_for(plugin_id).items():
                    setattr(self, name, plugin_api_method(func))
                hooks.fire_for(plugin_id, "on_app_start")
            disabled.discard(plugin_id)
            self._save_disabled(disabled)
        else:
            disabled.add(plugin_id)
            self._save_disabled(disabled)
            for name in self.plugins.bridge_names(plugin_id):
                if name in self.__dict__:
                    delattr(self, name)
            self.plugins.unload(plugin_id)
        return {"ok": True, "enabled": bool(enabled)}

    @api_method
    def call_plugin_method(self, plugin_id, method, args=None):
        """Fixed dispatcher for plugin bridge calls. It exists at page load,
        so plugins enabled at runtime are callable even though pywebview
        only generates JS stubs once — and lookups are per-plugin, so flat
        plugin_<id>_<method> name ambiguity cannot misroute a call."""
        fn = self.plugins.bridge_for(plugin_id).get(
            f"plugin_{plugin_id}_{method}")
        if fn is None:
            return {"error": f"Plugin method '{plugin_id}.{method}' not available"}
        return plugin_api_method(fn)(*(args or []))

    @api_method
    def get_plugin_frontend_scripts(self):
        """Return list of {id, name, code} for enabled plugins.
        The frontend plugin host calls this to inject plugin JS."""
        return self.plugins.get_plugin_frontend_scripts()

    @api_method
    def get_plugin_info(self):
        """Metadata for every installed plugin, enabled or not."""
        return self.plugins.describe_all()

    @api_method
    def open_plugins_folder(self):
        """Open data/plugins in the system file browser."""
        path = self.plugins.plugins_dir
        os.makedirs(path, exist_ok=True)
        if sys.platform == "win32":
            os.startfile(path)
        elif sys.platform == "darwin":
            subprocess.Popen(["open", path])
        else:
            subprocess.Popen(["xdg-open", path])
        return {"ok": True}

    @api_method
    def delete_plugin(self, plugin_id):
        """Unload a plugin, detach its API bridge, and delete its folder."""
        inst = self.plugins.loaded.get(plugin_id)
        folder = self.plugins.folder_of(plugin_id)
        if inst is None and not os.path.isdir(folder):
            return {"error": "Plugin not found"}
        for name in self.plugins.bridge_names(plugin_id):
            if name in self.__dict__:
                delattr(self, name)
        self.plugins.unload(plugin_id)

        base = os.path.normcase(os.path.realpath(self.plugins.plugins_dir))

        def remove_dir(path):
            """rmtree only real directories inside data/plugins; a junction or
            symlink is unlinked without touching what it points at."""
            if not os.path.isdir(path):
                return
            parent_real = os.path.realpath(os.path.dirname(path))
            expected = os.path.normcase(
                os.path.join(parent_real, os.path.basename(path)))
            real = os.path.normcase(os.path.realpath(path))
            if real == expected and real.startswith(base + os.sep):
                shutil.rmtree(path, ignore_errors=True)
            else:
                try:
                    os.rmdir(path)
                except OSError:
                    pass

        remove_dir(folder)
        storage_dir = os.path.join(self.plugins.storage_base, plugin_id)
        if os.path.normcase(os.path.abspath(storage_dir)) \
                != os.path.normcase(os.path.abspath(folder)):
            remove_dir(storage_dir)
        if os.path.isdir(folder):
            return {"ok": True, "removed": False,
                    "warning": "Plugin unloaded, but its folder could not be fully removed"}
        disabled = self._load_disabled()
        if plugin_id in disabled:
            disabled.discard(plugin_id)
            self._save_disabled(disabled)
        return {"ok": True, "removed": True}


    def _board_summary(self, b):
        return {k: v for k, v in b.items() if k != "lists"}

    @api_method
    def get_boards(self):
        with self.store.lock:
            boards = self.store.boards
            pinned = [b for b in boards if b.get("pinned")]
            rest = [b for b in boards if not b.get("pinned")]
            pinned.sort(key=lambda b: b.get("pinned_at") or "", reverse=True)
            rest.sort(key=lambda b: plain_name(b["name"]))
            return [self._board_summary(b) for b in pinned + rest]

    @api_method
    def create_board(self, name, description=""):
        ctx = hooks.fire_ctx("before_board_create", {"name": name, "description": description})
        name = ctx.get("name", name)
        description = ctx.get("description", description)
        name = (name or "").strip() or "Untitled board"
        with self.store.lock:
            board = {
                "id": self.store.new_id(),
                "name": name,
                "description": (description or "").strip(),
                "pinned": 0,
                "pinned_at": None,
                "created_at": database.now(),
                "lists": [],
            }
            self.store.boards.append(board)
            self.store.save_board(board)
            os.makedirs(self.store.attach_dir(board), exist_ok=True)
        hooks.fire("after_board_create", board["id"], board["name"])
        return {"id": board["id"], "name": name}

    @api_method
    def update_board(self, board_id, fields):
        ctx = hooks.fire_ctx("before_board_update", {"board_id": board_id, "fields": dict(fields or {})})
        board_id = ctx.get("board_id", board_id)
        fields = ctx.get("fields", fields)
        allowed = {"name", "description", "pinned"}
        updates = {k: v for k, v in (fields or {}).items() if k in allowed}
        if not updates:
            return {"ok": True}
        if "name" in updates:
            updates["name"] = (updates["name"] or "").strip()
            if not updates["name"]:
                return {"error": "Board name cannot be empty"}
        if "description" in updates:
            updates["description"] = (updates["description"] or "").strip()
        with self.store.lock:
            board = self.store.board(board_id)
            if board is None:
                return {"error": "Board not found"}
            if "pinned" in updates:
                pinned = 1 if updates.pop("pinned") else 0
                if pinned != board["pinned"]:
                    board["pinned"] = pinned
                    board["pinned_at"] = database.now() if pinned else None
            old_values = {k: board.get(k) for k in updates if k in board}
            board.update(updates)
            self.store.save_board(board)
        hooks.fire("after_board_update", board_id, updates, old_values)
        return {"ok": True}

    @api_method
    def delete_board(self, board_id):
        ctx = hooks.fire_ctx("before_board_delete", {"board_id": board_id})
        if ctx.get("veto"):
            return {"error": "Deletion blocked by a plugin"}
        with self.store.lock:
            board = self.store.board(board_id)
            if board is None:
                return {"error": "Board not found"}
            self.store.remove_board(board)
        hooks.fire("after_board_delete", board_id)
        return {"ok": True}

    @api_method
    def get_board(self, board_id):
        """Full nested snapshot: board, lists, cards, attachment metadata."""
        with self.store.lock:
            board = self.store.board(board_id)
            if board is None:
                return {"error": "Board not found"}
            hooks.fire("on_board_open", board_id, board["name"])
            lists = []
            for l in board["lists"]:
                cards = []
                for c in l["cards"]:
                    card = {k: v for k, v in c.items() if k != "attachments"}
                    card["list_id"] = l["id"]
                    card["attachments"] = [dict(a) for a in c["attachments"]]
                    cards.append(card)
                lists.append({"id": l["id"], "name": l["name"], "cards": cards})
            return {"board": self._board_summary(board), "lists": lists}

    @api_method
    def restore_board(self, board_id, doc):
        """Replace a board's content with a snapshot (frontend undo/redo)."""
        if not isinstance(doc, dict) or doc.get("id") != board_id \
                or not isinstance(doc.get("lists"), list):
            return {"error": "Invalid snapshot"}
        with self.store.lock:
            board = self.store.board(board_id)
            if board is None:
                return {"error": "Board not found"}
            board.clear()
            board.update(doc)
            self._reconcile_attachments(board)
            self.store.save_board(board)
        return {"ok": True}


    @api_method
    def create_list(self, board_id, name):
        ctx = hooks.fire_ctx("before_list_create", {"board_id": board_id, "name": name})
        board_id = ctx.get("board_id", board_id)
        name = ctx.get("name", name)
        name = (name or "").strip() or "Untitled list"
        with self.store.lock:
            board = self.store.board(board_id)
            if board is None:
                return {"error": "Board not found"}
            lst = {"id": self.store.new_id(), "name": name, "cards": []}
            board["lists"].append(lst)
            self.store.save_board(board)
        hooks.fire("after_list_create", board_id, lst["id"])
        return {"id": lst["id"]}

    @api_method
    def rename_list(self, list_id, name):
        name = (name or "").strip()
        if not name:
            return {"error": "List name cannot be empty"}
        with self.store.lock:
            board, lst = self.store.find_list(list_id)
            if lst is None:
                return {"error": "List not found"}
            old_name = lst["name"]
            lst["name"] = name
            self.store.save_board(board)
        hooks.fire("after_list_rename", list_id, name, old_name)
        return {"ok": True}

    @api_method
    def delete_list(self, list_id):
        ctx = hooks.fire_ctx("before_list_delete", {"list_id": list_id})
        if ctx.get("veto"):
            return {"error": "Deletion blocked by a plugin"}
        with self.store.lock:
            board, lst = self.store.find_list(list_id)
            if lst is None:
                return {"error": "List not found"}
            board_id = board["id"]
            folders = [database.card_folder(c) for c in lst["cards"]]
            board["lists"].remove(lst)
            self.store.save_board(board)
            attach_dir = self.store.attach_dir(board)
        for folder in folders:
            if folder:
                shutil.rmtree(os.path.join(attach_dir, folder),
                              ignore_errors=True)
        hooks.fire("after_list_delete", list_id, board_id)
        return {"ok": True}

    @api_method
    def move_list(self, list_id, new_index):
        hooks.fire_ctx("before_list_move", {"list_id": list_id, "new_index": new_index})
        with self.store.lock:
            board, lst = self.store.find_list(list_id)
            if lst is None:
                return {"error": "List not found"}
            board["lists"].remove(lst)
            new_index = max(0, min(int(new_index), len(board["lists"])))
            board["lists"].insert(new_index, lst)
            self.store.save_board(board)
        hooks.fire("after_list_move", list_id, new_index)
        return {"ok": True}


    @api_method
    def create_card(self, list_id, title):
        ctx = hooks.fire_ctx("before_card_create", {"list_id": list_id, "title": title})
        list_id = ctx.get("list_id", list_id)
        title = ctx.get("title", title)
        title = (title or "").strip()
        if not title:
            return {"error": "Card title cannot be empty"}
        with self.store.lock:
            board, lst = self.store.find_list(list_id)
            if lst is None:
                return {"error": "List not found"}
            card = {
                "id": self.store.new_id(),
                "title": title,
                "description": "",
                "color": "",
                "tags": [],
                "cover_id": None,
                "created_at": database.now(),
                "attachments": [],
            }
            lst["cards"].append(card)
            self.store.save_board(board)
        hooks.fire("after_card_create", card["id"], card["title"], list_id)
        return {"id": card["id"]}

    @api_method
    def update_card(self, card_id, fields):
        ctx = hooks.fire_ctx("before_card_update", {"card_id": card_id, "fields": dict(fields or {})})
        card_id = ctx.get("card_id", card_id)
        fields = ctx.get("fields", fields)
        allowed = {"title", "description", "color", "tags", "cover_id"}
        updates = {k: v for k, v in (fields or {}).items() if k in allowed}
        if not updates:
            return {"ok": True}
        if "title" in updates and not (updates["title"] or "").strip():
            return {"error": "Card title cannot be empty"}
        if "color" in updates:
            color = (updates["color"] or "").strip()
            if color and not re.fullmatch(r"#[0-9a-fA-F]{6}", color):
                return {"error": "Invalid color"}
            updates["color"] = color
        if "tags" in updates:
            tags = updates["tags"] or []
            if not isinstance(tags, list):
                return {"error": "Tags must be a list"}
            clean, seen = [], set()
            for t in tags:
                t = str(t).strip().lstrip("#")[:32]
                if t and t.lower() not in seen:
                    seen.add(t.lower())
                    clean.append(t)
            updates["tags"] = clean[:20]
        with self.store.lock:
            board, _, card = self.store.find_card(card_id)
            if card is None:
                return {"error": "Card not found"}
            if "cover_id" in updates:
                cover = updates["cover_id"]
                if not cover:
                    updates["cover_id"] = None
                else:
                    att = next((a for a in card["attachments"]
                                if a["id"] == cover), None)
                    if att is None or att["kind"] != "image":
                        return {"error": "Cover must be an image attached to this card"}
            old_values = {k: card.get(k) for k in updates if k in card}
            card.update(updates)
            if "title" in updates:
                self._sync_card_folder(board, card)
            self.store.save_board(board)
        hooks.fire("after_card_update", card_id, updates, old_values)
        return {"ok": True}

    @api_method
    def delete_card(self, card_id):
        ctx = hooks.fire_ctx("before_card_delete", {"card_id": card_id})
        if ctx.get("veto"):
            return {"error": "Deletion blocked by a plugin"}
        with self.store.lock:
            board, lst, card = self.store.find_card(card_id)
            if card is None:
                return {"error": "Card not found"}
            board_id = board["id"]
            lst["cards"].remove(card)
            self.store.save_board(board)
            folder = database.card_folder(card)
            attach_dir = self.store.attach_dir(board)
        if folder:
            shutil.rmtree(os.path.join(attach_dir, folder), ignore_errors=True)
        hooks.fire("after_card_delete", card_id, board_id)
        return {"ok": True}

    @api_method
    def move_card(self, card_id, list_id, new_index):
        hooks.fire_ctx("before_card_move", {"card_id": card_id, "to_list_id": list_id, "new_index": new_index})
        with self.store.lock:
            board_a, old_list, card = self.store.find_card(card_id)
            if card is None:
                return {"error": "Card not found"}
            board_b, new_list = self.store.find_list(list_id)
            if new_list is None:
                return {"error": "List not found"}
            old_list["cards"].remove(card)
            new_index = max(0, min(int(new_index), len(new_list["cards"])))
            new_list["cards"].insert(new_index, card)
            if board_b is not board_a:
                self._move_card_folder(board_a, board_b, card)
            self.store.save_board(board_a)
            if board_b is not board_a:
                self.store.save_board(board_b)
        old_list_id = old_list["id"] if old_list else None
        hooks.fire("after_card_move", card_id, old_list_id, list_id, new_index)
        return {"ok": True}


    @api_method
    def add_attachments_dialog(self, card_id):
        """Open the native file picker and attach every selected file."""
        if not webview.windows:
            return {"error": "No application window"}
        paths = webview.windows[0].create_file_dialog(
            DIALOG_OPEN, allow_multiple=True)
        if not paths:
            return {"attachments": []}
        added = []
        for path in paths:
            added.append(self._store_attachment(
                card_id, os.path.basename(path),
                lambda dest, src=path: shutil.copy2(src, dest)))
        if added:
            hooks.fire("after_attachment_add", card_id, [dict(a) for a in added])
        return {"attachments": added}

    @api_method
    def add_attachment_from_path(self, card_id, path):
        """Attach a file dropped from the OS when its full path is known."""
        if not path or not os.path.isfile(path):
            return {"error": "File not found: %s" % path}
        return self._store_attachment(
            card_id, os.path.basename(path),
            lambda dest: shutil.copy2(path, dest))

    @api_method
    def add_attachment_from_data(self, card_id, filename, data_b64):
        """Fallback for drops where only file bytes are available (base64)."""
        if data_b64.startswith("data:"):
            data_b64 = data_b64.split(",", 1)[1]
        raw = base64.b64decode(data_b64)

        def writer(dest):
            with open(dest, "wb") as f:
                f.write(raw)

        return self._store_attachment(card_id, filename, writer)

    @api_method
    def get_attachment_data(self, attachment_id):
        """Return the file as a data URI for inline preview/playback."""
        att, path = self._find_attachment(attachment_id)
        size = os.path.getsize(path)
        if size > MAX_INLINE_BYTES:
            return {"too_large": True, "size": size,
                    "name": att["name"], "kind": att["kind"]}
        with open(path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
        mime = guess_mime(att["name"])
        return {"name": att["name"], "kind": att["kind"],
                "size": size, "mime": mime,
                "data_uri": f"data:{mime};base64,{b64}"}

    @api_method
    def open_attachment(self, attachment_id):
        """Open with the system default application."""
        _, path = self._find_attachment(attachment_id)
        if sys.platform == "win32":
            os.startfile(path)
        elif sys.platform == "darwin":
            subprocess.Popen(["open", path])
        else:
            subprocess.Popen(["xdg-open", path])
        return {"ok": True}

    @api_method
    def save_attachment_as(self, attachment_id):
        """Copy the attachment to a user-chosen location (download)."""
        att, path = self._find_attachment(attachment_id)
        if not webview.windows:
            return {"error": "No application window"}
        dest = webview.windows[0].create_file_dialog(
            DIALOG_SAVE, save_filename=att["name"])
        if not dest:
            return {"saved": False}
        if isinstance(dest, (list, tuple)):
            dest = dest[0]
        shutil.copy2(path, dest)
        return {"saved": True, "path": dest}

    @api_method
    def rename_attachment(self, attachment_id, name):
        """Change the display name; the original extension is preserved."""
        name = (name or "").strip()
        if not name:
            return {"error": "Name cannot be empty"}
        with self.store.lock:
            board, _, _, att = self.store.find_attachment(attachment_id)
            if att is None:
                return {"error": "Attachment not found"}
            ext = os.path.splitext(att["name"])[1]
            if ext and not name.lower().endswith(ext.lower()):
                name += ext
            att["name"] = name
            self.store.save_board(board)
        return {"ok": True, "name": name}

    @api_method
    def delete_attachment(self, attachment_id):
        with self.store.lock:
            board, _, card, att = self.store.find_attachment(attachment_id)
            if att is None:
                return {"error": "Attachment not found"}
            card["attachments"].remove(att)
            if card.get("cover_id") == attachment_id:
                card["cover_id"] = None
            self.store.save_board(board)
        hooks.fire("after_attachment_delete", attachment_id, card["id"])
        return {"ok": True}


    @api_method
    def set_title(self, title):
        """Update the native window title (e.g. 'Orbit - <board name>')."""
        if webview.windows:
            webview.windows[0].set_title(str(title)[:200])
        return {"ok": True}


    @api_method
    def get_fonts(self):
        """Bundled font files (font/), as data URIs the UI can inject."""
        fonts = []
        if not os.path.isdir(self.font_dir):
            return fonts
        for fname in sorted(os.listdir(self.font_dir)):
            ext = os.path.splitext(fname)[1].lower()
            if ext not in FONT_EXTS:
                continue
            path = os.path.join(self.font_dir, fname)
            if os.path.getsize(path) > 8 * 1024 * 1024:
                continue
            mime, fmt = FONT_EXTS[ext]
            with open(path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("ascii")
            low = fname.lower()
            weight = 400
            for key, w in FONT_WEIGHTS:
                if key in low:
                    weight = w
                    break
            style = "italic" if ("italic" in low or "oblique" in low) else "normal"
            fonts.append({"data_uri": f"data:{mime};base64,{b64}",
                          "format": fmt, "weight": weight, "style": style})
        return fonts


    def _card_folders_taken(self, board, card):
        """Folder names the board's other cards already use (lowercased)."""
        taken = set()
        for l in board["lists"]:
            for c in l["cards"]:
                if c is not card:
                    folder = database.card_folder(c)
                    if folder:
                        taken.add(folder.lower())
        return taken

    def _sync_card_folder(self, board, card):
        """Rename the card's attachment folder to match its current title."""
        old = database.card_folder(card)
        if old is None:
            return
        root = self.store.attach_dir(board)
        taken = self._card_folders_taken(board, card)
        if os.path.isdir(root):
            taken |= {d.lower() for d in os.listdir(root)
                      if d.lower() != old.lower()}
        new = database.card_dirname(card, taken)
        if new == old:
            return
        try:
            os.rename(os.path.join(root, old), os.path.join(root, new))
        except OSError:
            return
        for att in card["attachments"]:
            att["file"] = f"{new}/" + att["file"].split("/", 1)[1]

    def _move_card_folder(self, board_a, board_b, card):
        """A card's files live with its board — move them when the card moves."""
        folder = database.card_folder(card)
        if folder is None:
            return
        src = os.path.join(self.store.attach_dir(board_a), folder)
        if not os.path.isdir(src):
            return
        dst_root = self.store.attach_dir(board_b)
        os.makedirs(dst_root, exist_ok=True)
        taken = self._card_folders_taken(board_b, card)
        taken |= {d.lower() for d in os.listdir(dst_root)}
        new = database.card_dirname(card, taken)
        try:
            shutil.move(src, os.path.join(dst_root, new))
        except OSError:
            return
        if new != folder:
            for att in card["attachments"]:
                att["file"] = f"{new}/" + att["file"].split("/", 1)[1]

    def _reconcile_attachments(self, board):
        """After a snapshot restore, attachment paths may predate a folder
        rename; re-point them at the files' real location, then re-sync
        folder names to the restored titles."""
        root = self.store.attach_dir(board)
        index = None
        for l in board["lists"]:
            for c in l["cards"]:
                for att in c["attachments"]:
                    if os.path.isfile(os.path.join(root, *att["file"].split("/"))):
                        continue
                    if index is None:
                        index = {}
                        for dirpath, _, files in os.walk(root):
                            for fn in files:
                                rel = os.path.relpath(os.path.join(dirpath, fn),
                                                      root)
                                index[fn] = rel.replace(os.sep, "/")
                    stored = att["file"].split("/")[-1]
                    if stored in index:
                        att["file"] = index[stored]
                self._sync_card_folder(board, c)

    def _store_attachment(self, card_id, original_name, writer):
        with self.store.lock:
            board, _, card = self.store.find_card(card_id)
            if card is None:
                raise ValueError("Card not found")
            ext = os.path.splitext(original_name)[1].lower()
            ext = "".join(ch for ch in ext if ch.isalnum() or ch == ".")[:12]
            root = self.store.attach_dir(board)
            folder = database.card_folder(card)
            if folder is None:
                taken = self._card_folders_taken(board, card)
                if os.path.isdir(root):
                    taken |= {d.lower() for d in os.listdir(root)}
                folder = database.card_dirname(card, taken)
            abs_dir = os.path.join(root, folder)
            os.makedirs(abs_dir, exist_ok=True)
            stored = uuid.uuid4().hex + ext
            abs_path = os.path.join(abs_dir, stored)
            writer(abs_path)
            att = {
                "id": self.store.new_id(),
                "name": original_name,
                "file": f"{folder}/{stored}",
                "kind": classify(original_name),
                "size": os.path.getsize(abs_path),
                "created_at": database.now(),
            }
            card["attachments"].append(att)
            self.store.save_board(board)
            return {"id": att["id"], "name": att["name"],
                    "kind": att["kind"], "size": att["size"]}

    def _find_attachment(self, attachment_id):
        with self.store.lock:
            board, _, _, att = self.store.find_attachment(attachment_id)
            if att is None:
                raise ValueError("Attachment not found")
            path = os.path.join(self.store.attach_dir(board),
                                *att["file"].split("/"))
        if not os.path.isfile(path):
            raise ValueError(f"Attachment file missing: {att['name']}")
        return att, path


def main():
    api = Api()
    webview.create_window(
        "Orbit",
        resource_path(os.path.join("static", "index.html")),
        js_api=api,
        width=1280,
        height=800,
        min_size=(940, 600),
        maximized=True,
        background_color="#161616",
    )
    try:
        webview.start(debug="--debug" in sys.argv)
    finally:
        hooks.fire("on_app_exit")
        api.plugins.unload_all()


if __name__ == "__main__":
    main()
