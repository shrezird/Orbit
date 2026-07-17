"""JSON-file storage for Orbit — one self-contained folder per board.

Every board lives in its own folder, data/boards/<board name>/:

    board.json      the board document (below)
    attachments/    the board's files, one folder per card named after it

    { "id": 1, "name": "...", "description": "", "pinned": 0,
      "pinned_at": null, "created_at": "...",
      "lists": [
        { "id": 2, "name": "...",
          "cards": [
            { "id": 3, "title": "...", "description": "", "color": "",
              "tags": [], "cover_id": null, "created_at": "...",
              "attachments": [
                { "id": 4, "name": "pic.png", "file": "Card title/….png",
                  "kind": "image", "size": 123, "created_at": "..." } ] } ] } ] }

Writes are atomic (temp file + replace) so a crash can never corrupt a save.
IDs are unique across all boards; the next free ID is computed at load time.
"""

import json
import os
import re
import shutil
import threading
from datetime import datetime

RESERVED_NAMES = {"con", "prn", "aux", "nul"} \
    | {f"com{i}" for i in range(1, 10)} | {f"lpt{i}" for i in range(1, 10)}


def now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def strip_markup(text):
    """Remove Orbit's inline formatting syntax (for filenames/titles)."""
    s = str(text)
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
    s = re.sub(r"__(.+?)__", r"\1", s)
    s = re.sub(r"~~(.+?)~~", r"\1", s)
    s = re.sub(r"(^|[^*])\*([^*]+)\*(?!\*)", r"\1\2", s)
    s = re.sub(r"\[(?:red|orange|yellow|green|teal|blue|purple|pink)"
               r"\s*:\s*([^\]]*)\]", r"\1", s, flags=re.I)
    return s


def _safe_name(raw):
    """Reduce a board/card name to something a folder can be called."""
    name = strip_markup(raw)
    name = re.sub(r'[\\/:*?"<>|]', "", name)
    return re.sub(r"\s+", " ", name).strip(" .")[:60].strip(" .")


def board_dirname(board, taken):
    """Filesystem-safe folder name derived from the board's name."""
    name = _safe_name(board["name"])
    if not name or name.lower() in RESERVED_NAMES:
        name = f"board_{board['id']}"
    if name.lower() in taken:
        name = f"{name}_{board['id']}"
    return name


def card_dirname(card, taken):
    """Filesystem-safe folder name derived from the card's title."""
    name = _safe_name(card["title"])
    if not name or name.lower() in RESERVED_NAMES:
        name = f"card_{card['id']}"
    if name.lower() in taken:
        name = f"{name}_{card['id']}"
    return name


def card_folder(card):
    """The folder the card's files currently live in (None if no attachments)."""
    if card["attachments"]:
        return card["attachments"][0]["file"].split("/", 1)[0]
    return None


def atomic_write(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path)


def _max_id(board):
    m = board["id"]
    for l in board["lists"]:
        m = max(m, l["id"])
        for c in l["cards"]:
            m = max(m, c["id"])
            for a in c["attachments"]:
                m = max(m, a["id"])
    return m


class Store:
    """All boards in memory, guarded by a lock; each board saves to its folder."""

    def __init__(self, boards_dir):
        self.dir = boards_dir
        self.lock = threading.RLock()
        self.boards = []
        self._dirs = {}
        os.makedirs(boards_dir, exist_ok=True)
        for entry in sorted(os.listdir(boards_dir)):
            path = os.path.join(boards_dir, entry, "board.json")
            if not os.path.isfile(path):
                continue
            with open(path, "r", encoding="utf-8") as f:
                board = json.load(f)
            self.boards.append(board)
            self._dirs[board["id"]] = entry
        self._next = max((_max_id(b) for b in self.boards), default=0) + 1
        for board in self.boards:
            self.save_board(board)

    def new_id(self):
        i = self._next
        self._next = i + 1
        return i

    def board_dir(self, board):
        """The board's own folder (holds board.json and attachments/)."""
        return os.path.join(self.dir, self._dirs[board["id"]])

    def attach_dir(self, board):
        """Where this board's attachment files live."""
        return os.path.join(self.board_dir(board), "attachments")

    def save_board(self, board):
        """Write the board into <board name>/board.json, renaming its folder
        if the board was renamed."""
        taken = {d.lower() for bid, d in self._dirs.items()
                 if bid != board["id"]}
        dirname = board_dirname(board, taken)
        old = self._dirs.get(board["id"])
        if old and old.lower() != dirname.lower():
            try:
                os.rename(os.path.join(self.dir, old),
                          os.path.join(self.dir, dirname))
            except OSError:
                dirname = old
        path = os.path.join(self.dir, dirname)
        os.makedirs(path, exist_ok=True)
        atomic_write(os.path.join(path, "board.json"), board)
        self._dirs[board["id"]] = dirname

    def remove_board(self, board):
        """Drop the board and delete its folder, attachments included."""
        self.boards.remove(board)
        dirname = self._dirs.pop(board["id"], None)
        if dirname:
            shutil.rmtree(os.path.join(self.dir, dirname), ignore_errors=True)


    def board(self, board_id):
        for b in self.boards:
            if b["id"] == board_id:
                return b
        return None

    def find_list(self, list_id):
        for b in self.boards:
            for l in b["lists"]:
                if l["id"] == list_id:
                    return b, l
        return None, None

    def find_card(self, card_id):
        for b in self.boards:
            for l in b["lists"]:
                for c in l["cards"]:
                    if c["id"] == card_id:
                        return b, l, c
        return None, None, None

    def find_attachment(self, attachment_id):
        for b in self.boards:
            for l in b["lists"]:
                for c in l["cards"]:
                    for a in c["attachments"]:
                        if a["id"] == attachment_id:
                            return b, l, c, a
        return None, None, None, None
