"""Base class for Orbit plugins. Plugin authors subclass this."""

import json
import os


class OrbitPlugin:
    """Base class for all Orbit plugins.

    Plugin authors create a subclass in their plugin's main.py:

        from plugin_system.api import OrbitPlugin

        class MyPlugin(OrbitPlugin):
            def on_load(self):
                self.register_hook("on_app_start", self._on_start)

            def _on_start(self):
                print("Hello from MyPlugin!")
    """

    id = None
    name = None
    version = None
    description = None
    author = None
    permissions = None

    def __init__(self, plugin_dir, hooks, storage_dir):
        self.dir = plugin_dir
        self.hooks = hooks
        self._storage_dir = storage_dir
        os.makedirs(storage_dir, exist_ok=True)
        self._data = self._load_data()


    def on_load(self):
        """Called after the plugin is instantiated.
        Override to register hooks, start background threads, etc."""
        pass

    def on_unload(self):
        """Called when the plugin is disabled or Orbit exits.
        Override to stop threads, close connections, save state.
        Base implementation saves persistent data to disk."""
        self._save_data()

    def on_config(self, config):
        """Called when user changes plugin settings.
        config is a dict from the frontend settings panel."""
        pass


    def storage_get(self, key, default=None):
        """Read a value from this plugin's persistent JSON store."""
        return self._data.get(key, default)

    def storage_set(self, key, value):
        """Write a value to this plugin's persistent JSON store.
        Auto-saves to disk."""
        self._data[key] = value
        self._save_data()

    def _load_data(self):
        path = os.path.join(self._storage_dir, "data.json")
        if os.path.isfile(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}

    def _save_data(self):
        path = os.path.join(self._storage_dir, "data.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self._data, f, indent=2, ensure_ascii=False)


    def register_hook(self, hook_name, callback, priority=100):
        """Shortcut: self.hooks.register(hook_name, callback, self.id, priority)"""
        self.hooks.register(hook_name, callback, self.id, priority)
