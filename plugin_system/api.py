import json
import os


class OrbitPlugin:

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
        pass

    def on_unload(self):
        self._save_data()

    def on_config(self, config):
        pass


    def storage_get(self, key, default=None):
        return self._data.get(key, default)

    def storage_set(self, key, value):
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
        self.hooks.register(hook_name, callback, self.id, priority)
