# Orbit

**Simply beautiful, beautifully simple.**

Orbit is a local-first kanban board app for your desktop. Boards, lists, cards, checklists, tags, and attachments — all stored as plain files on your machine. No account, no cloud, no telemetry, works fully offline.

<!-- Add a screenshot here: ![Orbit screenshot](docs/screenshot.png) -->

## Features

- **Boards → lists → cards**, with drag-and-drop everywhere (cards, lists, checklist items).
- **Rich cards** — descriptions, accent colors, up to 20 tags, multiple checklists, and cover images.
- **Attachments** — drop images, video, audio, and documents straight onto a card. Images get an in-app lightbox; everything else opens with your system's default app. Drag-and-drop supports files up to 64 MB; bigger files can still be attached via the file picker (they just won't preview inline).
- **Inline text formatting** in names, titles, and descriptions (see [Formatting](#formatting)).
- **Search** across boards and within a board, including `#tag` search.
- **Pinned boards** for the things you're actually working on.
- **Plain-file storage** — every board is a folder with a human-readable `board.json` and its attachments. Back up or sync by copying a folder (see [Where your data lives](#where-your-data-lives)).
- **Plugins** — extend Orbit with Python backend plugins and optional JavaScript UI (see [Plugins](#plugins)).
- **Custom font** — drop any `.ttf`/`.otf`/`.woff`/`.woff2` into the `font/` folder and Orbit uses it (weight and style are inferred from the filename).

## Getting started

### Requirements

- Python 3.9+ (developed on 3.14)
- [pywebview](https://pywebview.flowrl.com/) 5.1+
- **Windows:** the WebView2 runtime (preinstalled on Windows 10/11)
- **Linux:** pywebview needs a webview backend — GTK (`python3-gi`, WebKit2) or Qt (`pywebview[qt]`)
- **macOS:** uses the built-in WebKit; no extra dependencies

### Run from source

```
git clone https://github.com/shrezird/orbit.git
cd orbit
pip install pywebview
python main.pyw
```

On Windows you can also double-click `main.pyw` to launch without a console window.

Run with `--debug` to open the webview developer tools:

```
python main.pyw --debug
```

### Build a standalone executable (Windows)

Double-click **`build.bat`**, or run the equivalent by hand:

```
pip install -r requirements.txt
python -m PyInstaller --noconfirm --clean --onefile --windowed ^
    --name Orbit --icon icon.ico ^
    --add-data "static;static" --add-data "font;font" ^
    --add-data "plugin_system;plugin_system" main.pyw
```

The result is a single portable `dist/Orbit.exe`. The `static/`, `font/`, and `plugin_system/` folders are bundled inside the exe; your data lives in a `data/` folder created **next to the exe**, so you can keep Orbit on a USB stick. (Because fonts are bundled, swap the font *before* building.)

On macOS/Linux the same PyInstaller command works with `:` instead of `;` in the `--add-data` arguments.

## Where your data lives

Everything is stored under `data/`, next to `main.pyw` (or next to `Orbit.exe` when running the built executable):

```
data/
├── boards/
│   └── <Board Name>/
│       ├── board.json              # the whole board: lists, cards, checklists…
│       └── attachments/
│           └── <Card Title>/       # one folder per card that has attachments
│               └── <uuid>.<ext>
└── plugins/
    ├── plugins-config.json         # which plugins are disabled
    └── <plugin-id>/                # one folder per installed plugin
        ├── manifest.json
        ├── main.py
        ├── frontend.js             # optional
        └── data.json               # the plugin's saved settings (created at runtime)
```

Folder names mirror your board and card names and are kept in sync when you rename things, so the data directory stays browsable by hand. All writes are atomic (write-to-temp, then rename), so a crash won't corrupt a board.

**Backups:** copy the `data/` folder. **Moving to another machine:** paste it next to the exe/`main.pyw` there. That's it.

## Formatting

Board names, list names, card titles, and descriptions support lightweight inline markup:

| You type | You get |
|---|---|
| `**text**` | **bold** |
| `*text*` | *italic* |
| `__text__` | <u>underline</u> |
| `~~text~~` | ~~strikethrough~~ |
| `[red: text]` | colored text |

Available colors: `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple`, `pink`.

## Plugins

Orbit has a two-sided plugin system: a **Python backend plugin** (required) and an optional **JavaScript frontend** that runs inside the app window.

Manage plugins from the plugins panel inside Orbit — enable, disable, delete, or open the plugins folder. To install a plugin, drop its folder into `data/plugins/` and restart Orbit (or re-enable it from the panel).

> ⚠️ **Plugins are trusted code.** A plugin is ordinary Python running with the same permissions as Orbit itself. Only install plugins from sources you trust. The `permissions` field in a plugin's manifest is declarative/informational — it is not enforced by a sandbox.

### Writing a plugin

A minimal plugin is a folder in `data/plugins/` with two files:

**`manifest.json`**

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "orbit": ">=1.0.0",
  "description": "What it does",
  "author": "you",
  "permissions": [],
  "hooks": ["after_card_create"]
}
```

`id` is required and must match the values you use everywhere else; the rest is metadata shown in the plugins panel.

**`main.py`** — subclass `OrbitPlugin`:

```python
from plugin_system.api import OrbitPlugin


class MyPlugin(OrbitPlugin):

    def on_load(self):
        self.register_hook("after_card_create", self.card_created)

    def card_created(self, card_id, title, list_id):
        count = self.storage_get("count", 0) + 1
        self.storage_set("count", count)          # persisted to data.json

    def get_count(self):                          # public method → callable from the frontend
        return {"count": self.storage_get("count", 0)}
```

What the base class gives you:

- `on_load()` / `on_unload()` — lifecycle; called when the plugin is enabled/disabled and at app start/exit.
- `self.storage_get(key, default)` / `self.storage_set(key, value)` — simple persistent key-value store (JSON file in your plugin's folder).
- `self.register_hook(name, callback, priority=100)` — subscribe to app events (lower priority runs first).
- `self.dir` — your plugin's folder path.

Every **public method** (name not starting with `_`, excluding the base-class methods) is automatically exposed to the frontend and callable as `pluginApi("my-plugin", "get_count")`. Return JSON-serializable values; return `{"error": "message"}` to signal a failure (the frontend call will throw).

### Backend hooks

`before_*` hooks receive a single mutable `ctx` dict — **create/update** hooks apply any edits you make to it, **delete** hooks can block the operation by setting `ctx["veto"] = True`, and **move** hooks are observe-only. `after_*` hooks receive plain arguments.

| Hook | Arguments |
|---|---|
| `on_app_start` / `on_app_exit` | — |
| `on_board_open` | `board_id, board_name` |
| `before_board_create` | ctx: `name`, `description` |
| `after_board_create` | `board_id, name` |
| `before_board_update` | ctx: `board_id`, `fields` |
| `after_board_update` | `board_id, updates, old_values` |
| `before_board_delete` | ctx: `board_id` *(veto)* |
| `after_board_delete` | `board_id` |
| `before_list_create` | ctx: `board_id`, `name` |
| `after_list_create` | `board_id, list_id` |
| `after_list_rename` | `list_id, name, old_name` |
| `before_list_delete` | ctx: `list_id` *(veto)* |
| `after_list_delete` | `list_id, board_id` |
| `before_list_move` / `after_list_move` | `list_id, new_index` |
| `before_card_create` | ctx: `list_id`, `title` |
| `after_card_create` | `card_id, title, list_id` |
| `before_card_update` | ctx: `card_id`, `fields` |
| `after_card_update` | `card_id, updates, old_values` |
| `before_card_delete` | ctx: `card_id` *(veto)* |
| `after_card_delete` | `card_id, board_id` |
| `before_card_move` | ctx: `card_id`, `to_list_id`, `new_index` |
| `after_card_move` | `card_id, old_list_id, to_list_id, new_index` |
| `after_attachment_add` | `card_id, attachments` |
| `after_attachment_delete` | `attachment_id, card_id` |

### Frontend (optional)

Add a `frontend.js` to your plugin folder and it is injected into the app window. Register with the global `OrbitPlugin` host:

```js
OrbitPlugin.register({
  id: "my-plugin",

  onLoad() { /* runs once when injected */ },
  onUnload() { /* clean up */ },

  hooks: {
    // render slots: return a DOM element and Orbit places it in the UI
    "render:topbar":     (state) => myButton,
    "render:home":       (state) => myHomeWidget,
    "render:card-modal": (card, state) => myCardSection,

    // events: observe what the user is doing
    "view:changed":  (view) => {},
    "board:opened":  (boardId, board) => {},
    "card:opened":   (cardId, card) => {},
  },
});
```

Call your backend from the frontend with:

```js
const res = await pluginApi("my-plugin", "get_count");
```

## Project structure

```
orbit/
├── main.pyw               # app entry point + the pywebview JS↔Python API
├── database.py            # file-backed board store (atomic JSON writes)
├── plugin_system/         # plugin loader, base class, and hook registry
│   ├── __init__.py        #   PluginManager: discovery, load/unload, API bridge
│   ├── api.py             #   OrbitPlugin base class
│   └── hooks.py           #   HookRegistry (fire / fire_ctx / veto)
├── static/                # the entire frontend (vanilla JS, no build step)
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   └── plugin-host.js     #   frontend plugin host (OrbitPlugin global)
├── font/                  # app font(s), bundled into the exe
├── data/                  # your boards + installed plugins (created at runtime)
├── build.bat              # one-click Windows build (PyInstaller)
├── requirements.txt
└── icon.ico
```

There is no frontend toolchain — `static/` is served to the webview as-is, so editing a file and restarting the app is the whole dev loop.

## Contributing

Issues and pull requests are welcome.

- Keep the zero-build-step, zero-heavy-dependency spirit: the only runtime dependency is pywebview.
- Run from source with `--debug` to get devtools while working on the frontend.
- If you build something useful as a plugin rather than a core change, even better — that's what the plugin system is for.