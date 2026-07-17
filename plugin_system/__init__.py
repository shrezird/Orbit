"""Orbit Plugin System — discovers, validates, and manages plugins.

Plugins live in data/plugins/<plugin-id>/ each with:
    manifest.json   — metadata & permissions
    main.py         — an OrbitPlugin subclass
    frontend.js     — (optional) loaded by the frontend plugin host
"""

import importlib.util
import json
import os
import sys
import traceback

from .hooks import hooks

from .api import OrbitPlugin


def discover(plugins_dir):
    """Return list of (manifest_dict, folder_path) tuples for valid plugins."""
    if not os.path.isdir(plugins_dir):
        return []
    results = []
    for entry in sorted(os.listdir(plugins_dir)):
        folder = os.path.join(plugins_dir, entry)
        if not os.path.isdir(folder):
            continue
        mp = os.path.join(folder, "manifest.json")
        if not os.path.isfile(mp):
            continue
        try:
            with open(mp, "r", encoding="utf-8") as f:
                manifest = json.load(f)
        except Exception:
            traceback.print_exc()
            continue
        if not isinstance(manifest, dict) or not isinstance(manifest.get("id"), str):
            print(f"[plugins] Invalid manifest: {mp}")
            continue
        results.append((manifest, folder))
    return results


class PluginManager:
    """Manages plugin lifecycle: load, enable, disable, unload.

    Usage in Api.__init__:
        self.plugins = PluginManager(
            plugins_dir=os.path.join(self.data_dir, "plugins"),
            storage_base=os.path.join(self.data_dir, "plugins"),
        )
        self.plugins.load_all()
    """

    def __init__(self, plugins_dir, storage_base):
        self.plugins_dir = plugins_dir
        self.storage_base = storage_base
        self.hooks = hooks
        self._instances = {}
        self._modules = {}
        self._enabled = set()
        os.makedirs(self.storage_base, exist_ok=True)


    def load_all(self, enabled_ids=None, disabled_ids=None):
        """Discover and load all valid plugins. enabled_ids acts as a
        whitelist when given; disabled_ids as a blacklist (persisted
        per-plugin toggle state)."""
        for manifest, folder in discover(self.plugins_dir):
            pid = manifest["id"]
            if enabled_ids is not None and pid not in enabled_ids:
                continue
            if disabled_ids and pid in disabled_ids:
                continue
            try:
                self._load_one(manifest, folder)
            except Exception:
                traceback.print_exc()
                print(f"[plugins] Failed to load '{pid}'")

    def load_one(self, plugin_id):
        """Load a single discovered plugin by id. True if it ends up loaded."""
        if plugin_id in self._instances:
            return True
        for manifest, folder in discover(self.plugins_dir):
            if manifest["id"] == plugin_id:
                try:
                    self._load_one(manifest, folder)
                except Exception:
                    traceback.print_exc()
                return plugin_id in self._instances
        return False

    def _load_one(self, manifest, folder):
        pid = manifest["id"]

        if pid in self._instances:
            return

        main_py = os.path.join(folder, "main.py")
        if not os.path.isfile(main_py):
            print(f"[plugins] '{pid}' has no main.py, skipping")
            return

        spec = importlib.util.spec_from_file_location(
            f"orbit_plugin_{pid}", main_py
        )
        mod = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = mod
        spec.loader.exec_module(mod)

        plugin_cls = None
        for attr_name in dir(mod):
            attr = getattr(mod, attr_name)
            if (
                isinstance(attr, type)
                and issubclass(attr, OrbitPlugin)
                and attr is not OrbitPlugin
            ):
                plugin_cls = attr
                break

        if plugin_cls is None:
            print(f"[plugins] '{pid}' main.py has no OrbitPlugin subclass")
            return

        storage_dir = os.path.join(self.storage_base, pid)
        instance = plugin_cls(
            plugin_dir=folder,
            hooks=self.hooks,
            storage_dir=storage_dir,
        )
        instance.id = pid
        instance.name = manifest.get("name", pid)
        instance.version = manifest.get("version", "0.0.0")
        instance.description = manifest.get("description", "")
        instance.author = manifest.get("author", "")
        instance.permissions = manifest.get("permissions", [])
        instance.manifest_hooks = manifest.get("hooks", [])

        self._instances[pid] = instance
        self._modules[pid] = mod
        self._enabled.add(pid)

        try:
            instance.on_load()
        except Exception:
            traceback.print_exc()

        print(f"[plugins] Loaded '{pid}' v{instance.version}")


    def unload(self, plugin_id):
        """Unload a single plugin and remove its hooks."""
        instance = self._instances.pop(plugin_id, None)
        if instance:
            self._enabled.discard(plugin_id)
            self.hooks.unregister_all(plugin_id)
            try:
                instance.on_unload()
            except Exception:
                traceback.print_exc()
        self._modules.pop(plugin_id, None)

    def unload_all(self):
        """Unload every plugin (called on app exit)."""
        for pid in list(self._instances):
            self.unload(pid)


    @property
    def loaded(self):
        """Dict of {plugin_id: OrbitPlugin instance} for enabled plugins."""
        return dict(self._instances)

    def describe_all(self):
        """Every discovered plugin (enabled or not) with its load state —
        this is what the plugins dialog lists."""
        result = []
        seen = set()
        for manifest, folder in discover(self.plugins_dir):
            pid = manifest["id"]
            if pid in seen:
                continue
            seen.add(pid)
            result.append({
                "id": pid,
                "name": manifest.get("name", pid),
                "version": manifest.get("version", "0.0.0"),
                "description": manifest.get("description", ""),
                "author": manifest.get("author", ""),
                "has_frontend": os.path.isfile(os.path.join(folder, "frontend.js")),
                "enabled": pid in self._instances,
            })
        return result

    def folder_of(self, plugin_id):
        """The plugin's folder path, whether or not it is loaded."""
        inst = self._instances.get(plugin_id)
        if inst is not None:
            return inst.dir
        for manifest, folder in discover(self.plugins_dir):
            if manifest["id"] == plugin_id:
                return folder
        return os.path.join(self.plugins_dir, plugin_id)

    def get_frontend_plugins(self):
        """Return a list of {id, name, has_frontend} for the frontend host.
        has_frontend is True if the plugin folder contains a frontend.js."""
        result = []
        for pid, inst in self._instances.items():
            folder = self._instances[pid].dir if hasattr(inst, 'dir') else None
            if folder is None:
                folder = os.path.join(self.plugins_dir, pid)
            has_fe = os.path.isfile(os.path.join(folder, "frontend.js"))
            result.append({
                "id": pid,
                "name": inst.name,
                "version": inst.version,
                "description": inst.description,
                "author": inst.author,
                "has_frontend": has_fe,
            })
        return result

    BRIDGE_SKIP = {
        "on_load", "on_unload", "on_config",
        "storage_get", "storage_set", "register_hook",
        "register_api_method",
    }

    def _instance_bridge(self, pid, inst):
        """Bridge entries {plugin_<pid>_<method>: callable} for one instance.
        Methods starting with '_' or in BRIDGE_SKIP are excluded."""
        entries = {}
        for attr_name in dir(inst):
            if attr_name.startswith("_") or attr_name in self.BRIDGE_SKIP:
                continue
            attr = getattr(inst, attr_name)
            if callable(attr):
                entries[f"plugin_{pid}_{attr_name}"] = attr
        return entries

    def get_api_bridge(self):
        """Return a dict of {method_name: callable} for Api to attach.
        Every public method on each plugin instance becomes callable
        as window.pywebview.api.plugin_<id>_<method>(...)."""
        bridge = {}
        for pid, inst in self._instances.items():
            bridge.update(self._instance_bridge(pid, inst))
        return bridge

    def bridge_names(self, plugin_id):
        """Exact bridge attribute names for one loaded plugin.
        Empty if the plugin is not loaded."""
        return list(self.bridge_for(plugin_id))

    def bridge_for(self, plugin_id):
        """Bridge entries {name: callable} for one loaded plugin.
        Empty if the plugin is not loaded."""
        inst = self._instances.get(plugin_id)
        if inst is None:
            return {}
        return self._instance_bridge(plugin_id, inst)

    def get_plugin_frontend_scripts(self):
        """Return a list of {id, name, code} for enabled plugins
        with frontend.js files. The frontend host inlines these scripts."""
        scripts = []
        for pid in self._instances:
            folder = self._instances[pid].dir if hasattr(self._instances[pid], 'dir') else os.path.join(self.plugins_dir, pid)
            fe = os.path.join(folder, "frontend.js")
            if os.path.isfile(fe):
                try:
                    with open(fe, "r", encoding="utf-8") as f:
                        scripts.append({
                            "id": pid,
                            "name": self._instances[pid].name,
                            "code": f.read(),
                        })
                except Exception:
                    traceback.print_exc()
        return scripts
