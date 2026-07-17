import json
import os
import socket
import struct
import sys
import threading
import time
import uuid

from plugin_system.api import OrbitPlugin

OP_HANDSHAKE = 0
OP_FRAME = 1
OP_CLOSE = 2
OP_PING = 3
OP_PONG = 4


class ActivityRejected(Exception):
    pass


def _clip(text, limit=128):
    s = str(text)
    if len(s) < 2:
        return None
    return s[:limit]


def _plural(n, word):
    return f"{n} {word}" + ("" if n == 1 else "s")


class DiscordIPC:

    def __init__(self, client_id, timeout=8.0, should_abort=None):
        self.client_id = str(client_id)
        self.timeout = timeout
        self._abort = should_abort or (lambda: False)
        self._pipe = None

    @staticmethod
    def _candidates():
        if sys.platform == "win32":
            return [r"\\?\pipe\discord-ipc-%d" % i for i in range(10)]
        base = (os.environ.get("XDG_RUNTIME_DIR")
                or os.environ.get("TMPDIR") or "/tmp")
        paths = []
        for i in range(10):
            paths.append(os.path.join(base, "discord-ipc-%d" % i))
            paths.append(os.path.join(base, "app", "com.discordapp.Discord",
                                      "discord-ipc-%d" % i))
            paths.append(os.path.join(base, "snap.discord",
                                      "discord-ipc-%d" % i))
        return paths

    def _open_pipe(self):
        if sys.platform == "win32":
            for path in self._candidates():
                try:
                    return open(path, "r+b", buffering=0)
                except OSError:
                    continue
            raise ConnectionError("Discord is not running")
        for path in self._candidates():
            s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            try:
                s.settimeout(4)
                s.connect(path)
                s.settimeout(0.5)
                return s
            except OSError:
                s.close()
        raise ConnectionError("Discord is not running")

    def connect(self):
        self._pipe = self._open_pipe()
        self._send(OP_HANDSHAKE, {"v": 1, "client_id": self.client_id})
        op, data = self._recv()
        if op != OP_FRAME:
            msg = (data or {}).get("message", "handshake rejected")
            self.close()
            raise ConnectionError(f"Discord: {msg}")
        if isinstance(data, dict) and data.get("evt") == "ERROR":
            msg = ((data.get("data") or {}).get("message")) or "handshake rejected"
            self.close()
            raise ConnectionError(f"Discord: {msg}")
        return data

    def _send(self, op, payload):
        raw = json.dumps(payload).encode("utf-8")
        data = struct.pack("<II", op, len(raw)) + raw
        if hasattr(self._pipe, "sendall"):
            self._pipe.sendall(data)
        else:
            self._pipe.write(data)

    def _read_exact(self, n):
        end = time.time() + self.timeout
        buf = b""
        if sys.platform == "win32":
            import ctypes
            import msvcrt
            handle = ctypes.c_void_p(msvcrt.get_osfhandle(self._pipe.fileno()))
            avail = ctypes.c_ulong(0)
            while len(buf) < n:
                if self._abort():
                    raise ConnectionError("aborted")
                if time.time() > end:
                    raise ConnectionError("Discord did not respond")
                ok = ctypes.windll.kernel32.PeekNamedPipe(
                    handle, None, 0, None, ctypes.byref(avail), None)
                if not ok:
                    raise ConnectionError("Discord closed the connection")
                if avail.value == 0:
                    time.sleep(0.05)
                    continue
                chunk = self._pipe.read(min(n - len(buf), avail.value))
                if not chunk:
                    raise ConnectionError("Discord closed the connection")
                buf += chunk
            return buf
        while len(buf) < n:
            if self._abort():
                raise ConnectionError("aborted")
            if time.time() > end:
                raise ConnectionError("Discord did not respond")
            try:
                chunk = self._pipe.recv(n - len(buf))
            except TimeoutError:
                continue
            if not chunk:
                raise ConnectionError("Discord closed the connection")
            buf += chunk
        return buf

    def _recv(self):
        op, length = struct.unpack("<II", self._read_exact(8))
        data = json.loads(self._read_exact(length) or b"{}")
        return op, data

    def _roundtrip(self, payload):
        self._send(OP_FRAME, payload)
        for _ in range(5):
            op, data = self._recv()
            if op == OP_PING:
                self._send(OP_PONG, data)
                continue
            if op == OP_CLOSE:
                raise ConnectionError("Discord closed the connection")
            if isinstance(data, dict) and data.get("evt") == "ERROR":
                msg = ((data.get("data") or {}).get("message")) or "command rejected"
                raise ActivityRejected(msg)
            return data
        raise ConnectionError("No response from Discord")

    def set_activity(self, activity):
        return self._roundtrip({
            "cmd": "SET_ACTIVITY",
            "args": {"pid": os.getpid(), "activity": activity},
            "nonce": uuid.uuid4().hex,
        })

    def clear_activity_nowait(self):
        self._send(OP_FRAME, {
            "cmd": "SET_ACTIVITY",
            "args": {"pid": os.getpid(), "activity": None},
            "nonce": uuid.uuid4().hex,
        })

    def close(self):
        pipe, self._pipe = self._pipe, None
        if pipe is not None:
            try:
                pipe.close()
            except Exception:
                pass


class DiscordRPCPlugin(OrbitPlugin):
    UPDATE_MIN_INTERVAL = 5
    RETRY_INTERVAL = 15
    FE_CTX_FRESH = 30


    def on_load(self):
        self._lock = threading.Lock()
        self._wake = threading.Event()
        self._running = True
        self._connected = False
        self._status = "starting"
        self._last_error = ""
        self._session_start = int(time.time())
        self._board_start = self._session_start
        self._ctx = {"view": "home"}
        self._fe_ctx_at = 0.0

        self.register_hook("on_board_open", self._on_board_open)
        self.register_hook("on_app_exit", self._on_exit)

        self._thread = threading.Thread(target=self._loop, daemon=True,
                                        name="discord-rpc")
        self._thread.start()
        self._wake.set()

    def on_unload(self):
        self._stop()
        super().on_unload()

    def _on_exit(self):
        self._stop()

    def _stop(self):
        self._running = False
        self._wake.set()
        t = getattr(self, "_thread", None)
        if t is not None and t.is_alive() and t is not threading.current_thread():
            t.join(timeout=3)


    def _on_board_open(self, board_id, board_name):
        if time.time() - self._fe_ctx_at < self.FE_CTX_FRESH:
            return
        try:
            import database
            board_name = database.strip_markup(board_name)
        except Exception:
            pass
        self._merge_ctx({"view": "board",
                         "board_name": str(board_name)[:100]},
                        from_frontend=False)


    def set_context(self, ctx):
        if not isinstance(ctx, dict):
            return {"error": "context must be an object"}
        self._merge_ctx(ctx, from_frontend=True)
        return {"ok": True}

    def _merge_ctx(self, ctx, from_frontend):
        with self._lock:
            if from_frontend:
                self._fe_ctx_at = time.time()
            if "board_name" in ctx \
                    and ctx.get("board_name") != self._ctx.get("board_name"):
                self._board_start = int(time.time())
            self._ctx.update(ctx)
        self._wake.set()

    def toggle(self):
        return self.set_enabled(not self.storage_get("enabled", True))

    def set_enabled(self, enabled):
        self.storage_set("enabled", bool(enabled))
        self._wake.set()
        return self.get_status()

    def set_client_id(self, client_id):
        client_id = str(client_id or "").strip()
        if client_id and not client_id.isdigit():
            return {"error": "A Discord application ID is a long number — "
                             "copy it from discord.com/developers/applications"}
        self.storage_set("client_id", client_id)
        self._wake.set()
        return self.get_status()

    def get_status(self):
        return {
            "enabled": bool(self.storage_get("enabled", True)),
            "connected": bool(self._connected),
            "has_client_id": bool(str(self.storage_get("client_id", "")).strip()),
            "status": self._status,
            "last_error": self._last_error,
        }


    def _loop(self):
        ipc = None
        connected_id = None
        last_sent = None
        last_send_at = 0.0

        def drop(clear=False):
            nonlocal ipc, connected_id, last_sent
            if ipc is not None:
                if clear:
                    try:
                        ipc.clear_activity_nowait()
                    except Exception:
                        pass
                ipc.close()
            ipc = None
            connected_id = None
            last_sent = None
            self._connected = False

        while True:
            self._wake.wait(timeout=self.RETRY_INTERVAL)
            self._wake.clear()
            if not self._running:
                break

            enabled = bool(self.storage_get("enabled", True))
            client_id = str(self.storage_get("client_id", "")).strip()
            if not enabled or not client_id:
                self._status = "disabled" if not enabled else "no client id"
                drop(clear=True)
                continue

            if ipc is not None and connected_id != client_id:
                drop()

            if ipc is None:
                candidate = DiscordIPC(
                    client_id, should_abort=lambda: not self._running)
                try:
                    candidate.connect()
                except Exception as exc:
                    candidate.close()
                    self._status = "waiting for Discord"
                    self._last_error = str(exc)
                    continue
                ipc = candidate
                connected_id = client_id
                self._connected = True
                self._status = "connected"
                self._last_error = ""

            activity = self._build_activity()
            if activity == last_sent:
                continue
            since = time.time() - last_send_at
            if since < self.UPDATE_MIN_INTERVAL:
                end = time.time() + self.UPDATE_MIN_INTERVAL - since
                while self._running and time.time() < end:
                    time.sleep(0.2)
                if not self._running:
                    break
                activity = self._build_activity()
            try:
                ipc.set_activity(activity)
                last_sent = activity
                last_send_at = time.time()
            except ActivityRejected as exc:
                last_sent = activity
                last_send_at = time.time()
                self._status = "rejected by Discord"
                self._last_error = str(exc)
            except Exception as exc:
                drop()
                self._status = "reconnecting"
                self._last_error = str(exc)
                self._wake.set()

        drop(clear=True)


    def _build_activity(self):
        with self._lock:
            ctx = dict(self._ctx)
            board_start = self._board_start
        timer_mode = self.storage_get("timer_mode", "session")
        start = board_start if timer_mode == "board" else self._session_start

        if ctx.get("view") == "board" and ctx.get("board_name"):
            details = "Board: " + str(ctx["board_name"])
            card = ctx.get("card_title")
            if card:
                verb = "Editing" if ctx.get("editing") else "Viewing"
                state = f"{verb} card: {card}"
            else:
                state = (_plural(int(ctx.get("lists") or 0), "list")
                         + " · "
                         + _plural(int(ctx.get("cards") or 0), "card"))
        else:
            details = "Browsing boards"
            boards = ctx.get("boards")
            state = _plural(int(boards), "board") if isinstance(boards, int) else None

        activity = {
            "details": _clip(details) or "Using Orbit",
            "timestamps": {"start": start},
        }
        state = _clip(state) if state else None
        if state:
            activity["state"] = state
        image = str(self.storage_get("large_image", "orbit") or "").strip()
        if image:
            activity["assets"] = {"large_image": image[:256],
                                  "large_text": "Orbit"}
        return activity
